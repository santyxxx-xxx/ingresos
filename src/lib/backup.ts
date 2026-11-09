import { supabase } from './supabase';
import {
  CAT_COLS,
  GROUP_COLS,
  REC_COLS,
  TX_COLS,
  catFromRow,
  fail,
  groupFromRow,
  recFromRow,
  txFromRow,
  type CatRow,
  type GroupRow,
  type RecRow,
  type TxRow
} from './data';
import type { BackupFile, Category, Group, Recurring, Transaction } from './types';
import { shiftMonth, todayISO, uid as newId } from './utils';

async function fetchAll<T>(table: string, cols: string, uid: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select(cols)
      .eq('user_id', uid)
      .order('created_at')
      .range(from, from + 999);
    if (error) fail(error);
    out.push(...((data ?? []) as unknown as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function exportBackup(uid: string): Promise<'shared' | 'downloaded'> {
  const [groups, cats, txs, recs] = await Promise.all([
    fetchAll<GroupRow>('category_groups', GROUP_COLS, uid),
    fetchAll<CatRow>('categories', CAT_COLS, uid),
    fetchAll<TxRow>('transactions', TX_COLS, uid),
    fetchAll<RecRow>('recurring', REC_COLS, uid)
  ]);
  const data: BackupFile = {
    app: 'ingresos',
    version: 3,
    exportedAt: new Date().toISOString(),
    groups: groups.map(groupFromRow),
    categories: cats.map(catFromRow),
    transactions: txs.map(txFromRow),
    recurring: recs.map(recFromRow)
  };
  const json = JSON.stringify(data, null, 2);
  const name = `ingresos-copia-${todayISO()}.json`;
  const file = new File([json], name, { type: 'application/json' });

  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try {
      await nav.share({ files: [file], title: 'Copia de Ingresos' });
      return 'shared';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') throw e;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}

const isType = (t: unknown) => t === 'expense' || t === 'income';
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);
const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Acepta copias de cualquier versión de la app */
export async function parseBackup(file: File): Promise<BackupFile> {
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  const d = data as Record<string, unknown>;
  if (!d || d.app !== 'ingresos' || !Array.isArray(d.categories) || !Array.isArray(d.transactions)) {
    throw new Error('Este archivo no es una copia de Ingresos.');
  }
  const groups: Group[] = (Array.isArray(d.groups) ? (d.groups as Array<Record<string, unknown>>) : [])
    .filter((g) => g && typeof g.id === 'string' && typeof g.name === 'string')
    .map((g, i) => ({
      id: g.id as string,
      name: (g.name as string).slice(0, 40) || 'Grupo',
      emoji: str(g.emoji, '📁'),
      order: typeof g.order === 'number' ? g.order : i
    }));
  const groupIds = new Set(groups.map((g) => g.id));

  const categories: Category[] = (d.categories as Array<Record<string, unknown>>)
    .filter((c) => c && typeof c.id === 'string' && typeof c.name === 'string' && isType(c.type))
    .map((c, i) => ({
      id: c.id as string,
      name: (c.name as string).slice(0, 60) || 'Sin nombre',
      emoji: str(c.emoji, '🏷️'),
      type: c.type as Category['type'],
      parentId: typeof c.parentId === 'string' ? c.parentId : null,
      groupId: typeof c.groupId === 'string' && groupIds.has(c.groupId) ? c.groupId : null,
      budget: typeof c.budget === 'number' && c.budget > 0 ? Math.round(c.budget) : null,
      order: typeof c.order === 'number' ? c.order : i,
      createdAt: str(c.createdAt, new Date().toISOString())
    }));
  for (const c of categories) {
    const p = c.parentId ? categories.find((x) => x.id === c.parentId) : undefined;
    if (!p || p.parentId || p.type !== c.type) c.parentId = null;
    if (c.parentId) {
      c.groupId = null;
      c.budget = null;
    }
  }
  const catIds = new Set(categories.map((c) => c.id));

  const recurring: Recurring[] = (Array.isArray(d.recurring) ? (d.recurring as Array<Record<string, unknown>>) : [])
    .filter((r) => r && typeof r.id === 'string' && isType(r.type) && typeof r.amount === 'number' && r.amount > 0)
    .map((r) => ({
      id: r.id as string,
      type: r.type as Recurring['type'],
      amount: Math.round(r.amount as number),
      categoryId: typeof r.categoryId === 'string' && catIds.has(r.categoryId) ? r.categoryId : null,
      place: str(r.place),
      dayOfMonth: Math.min(31, Math.max(1, Number(r.dayOfMonth) || 1)),
      startDate: isDate(r.startDate) ? (r.startDate as string) : todayISO(),
      active: r.active !== false
    }));
  const recIds = new Set(recurring.map((r) => r.id));

  const transactions: Transaction[] = (d.transactions as Array<Record<string, unknown>>)
    .filter((t) => t && typeof t.amount === 'number' && isType(t.type) && isDate(t.date))
    .map((t) => ({
      id: typeof t.id === 'string' ? t.id : newId(),
      type: t.type as Transaction['type'],
      amount: Math.max(0, Math.round(t.amount as number)),
      categoryId: typeof t.categoryId === 'string' && catIds.has(t.categoryId) ? t.categoryId : null,
      place: str(t.place),
      date: t.date as string,
      createdAt: str(t.createdAt, new Date().toISOString()),
      recurringId: typeof t.recurringId === 'string' && recIds.has(t.recurringId) ? t.recurringId : null
    }));

  return { app: 'ingresos', version: 3, exportedAt: str(d.exportedAt), groups, categories, transactions, recurring };
}

/** Reemplaza todos los datos de la cuenta por los de la copia */
export async function restoreBackup(uid: string, b: BackupFile) {
  for (const table of ['transactions', 'recurring', 'categories', 'category_groups']) {
    const { error } = await supabase.from(table).delete().eq('user_id', uid);
    if (error) fail(error);
  }
  const insert = async (table: string, rows: object[]) => {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from(table).insert(rows.slice(i, i + 500));
      if (error) fail(error);
    }
  };
  await insert(
    'category_groups',
    b.groups.map((g) => ({ user_id: uid, id: g.id, name: g.name, emoji: g.emoji, sort_order: g.order }))
  );
  const catRow = (c: Category) => ({
    user_id: uid,
    id: c.id,
    name: c.name,
    emoji: c.emoji,
    type: c.type,
    parent_id: c.parentId,
    group_id: c.groupId,
    monthly_budget_cents: c.budget,
    sort_order: c.order
  });
  await insert('categories', b.categories.filter((c) => !c.parentId).map(catRow));
  await insert('categories', b.categories.filter((c) => c.parentId).map(catRow));
  await insert(
    'recurring',
    b.recurring.map((r) => ({
      user_id: uid,
      id: r.id,
      type: r.type,
      amount_cents: r.amount,
      category_id: r.categoryId,
      place: r.place,
      day_of_month: r.dayOfMonth,
      start_date: r.startDate,
      active: r.active,
      // los meses anteriores vienen en la copia; el actual se genera de nuevo sin duplicar (id fijo por mes)
      last_month: `${shiftMonth(todayISO().slice(0, 7), -1)}-01`
    }))
  );
  await insert(
    'transactions',
    b.transactions.map((t) => ({
      user_id: uid,
      id: t.id,
      type: t.type,
      amount_cents: t.amount,
      category_id: t.categoryId,
      place: t.place,
      date: t.date,
      recurring_id: t.recurringId
    }))
  );
}

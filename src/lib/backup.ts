import { supabase } from './supabase';
import { catFromRow, fail, txFromRow } from './data';
import type { BackupFile, Category, Transaction } from './types';
import { todayISO } from './utils';

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
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function exportBackup(uid: string): Promise<'shared' | 'downloaded'> {
  const [cats, txs] = await Promise.all([
    fetchAll<Parameters<typeof catFromRow>[0]>('categories', 'id,name,emoji,type,parent_id,sort_order,created_at', uid),
    fetchAll<Parameters<typeof txFromRow>[0]>('transactions', 'id,type,amount_cents,category_id,place,date,created_at', uid)
  ]);
  const data: BackupFile = {
    app: 'ingresos',
    version: 2,
    exportedAt: new Date().toISOString(),
    categories: cats.map(catFromRow),
    transactions: txs.map(txFromRow)
  };
  const json = JSON.stringify(data, null, 2);
  const name = `ingresos-respaldo-${todayISO()}.json`;
  const file = new File([json], name, { type: 'application/json' });

  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try {
      await nav.share({ files: [file], title: 'Respaldo Ingresos' });
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

export async function parseBackup(file: File): Promise<BackupFile> {
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  const d = data as { app?: string; categories?: unknown[]; transactions?: unknown[]; exportedAt?: string };
  if (!d || d.app !== 'ingresos' || !Array.isArray(d.categories) || !Array.isArray(d.transactions)) {
    throw new Error('Este archivo no es un respaldo de Ingresos.');
  }
  const categories: Category[] = (d.categories as Array<Record<string, unknown>>)
    .filter((c) => c && typeof c.id === 'string' && typeof c.name === 'string' && isType(c.type))
    .map((c, i) => ({
      id: c.id as string,
      name: (c.name as string).slice(0, 60) || 'Sin nombre',
      emoji: (c.emoji as string) || '🏷️',
      type: c.type as Category['type'],
      parentId: typeof c.parentId === 'string' ? c.parentId : null,
      order: typeof c.order === 'number' ? c.order : i,
      createdAt: typeof c.createdAt === 'string' ? c.createdAt : new Date().toISOString()
    }));
  const ids = new Set(categories.map((c) => c.id));
  // Solo un nivel de subcategorías y padres existentes
  for (const c of categories) {
    const p = c.parentId ? categories.find((x) => x.id === c.parentId) : undefined;
    if (!p || p.parentId || p.type !== c.type) c.parentId = null;
  }
  const transactions: Transaction[] = (d.transactions as Array<Record<string, unknown>>)
    .filter(
      (t) =>
        t &&
        typeof t.amount === 'number' &&
        isType(t.type) &&
        typeof t.date === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(t.date)
    )
    .map((t) => ({
      id: typeof t.id === 'string' ? t.id : crypto.randomUUID(),
      type: t.type as Transaction['type'],
      amount: Math.max(0, Math.round(t.amount as number)),
      categoryId: typeof t.categoryId === 'string' && ids.has(t.categoryId) ? t.categoryId : null,
      place: typeof t.place === 'string' ? t.place : '',
      date: t.date as string,
      createdAt: typeof t.createdAt === 'string' ? t.createdAt : new Date().toISOString()
    }));
  return { app: 'ingresos', version: 2, exportedAt: d.exportedAt ?? '', categories, transactions };
}

/** Reemplaza todos los datos de la cuenta por los del respaldo */
export async function restoreBackup(uid: string, b: BackupFile) {
  const del1 = await supabase.from('transactions').delete().eq('user_id', uid);
  if (del1.error) fail(del1.error);
  const del2 = await supabase.from('categories').delete().eq('user_id', uid);
  if (del2.error) fail(del2.error);

  const catRow = (c: Category) => ({
    user_id: uid,
    id: c.id,
    name: c.name,
    emoji: c.emoji,
    type: c.type,
    parent_id: c.parentId,
    sort_order: c.order
  });
  const parents = b.categories.filter((c) => !c.parentId).map(catRow);
  const subs = b.categories.filter((c) => c.parentId).map(catRow);
  for (const rows of [parents, subs]) {
    if (!rows.length) continue;
    const { error } = await supabase.from('categories').insert(rows);
    if (error) fail(error);
  }
  for (let i = 0; i < b.transactions.length; i += 500) {
    const rows = b.transactions.slice(i, i + 500).map((t) => ({
      user_id: uid,
      id: t.id,
      type: t.type,
      amount_cents: t.amount,
      category_id: t.categoryId,
      place: t.place,
      date: t.date
    }));
    const { error } = await supabase.from('transactions').insert(rows);
    if (error) fail(error);
  }
}

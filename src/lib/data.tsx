import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { friendlyError, supabase } from './supabase';
import type { Category, Group, Recurring, Transaction, TxType } from './types';
import { todayISO } from './utils';

/* ---------- Mapeo filas de Supabase <-> app ---------- */

export interface GroupRow {
  id: string;
  name: string;
  emoji: string;
  sort_order: number;
}
export interface CatRow {
  id: string;
  name: string;
  emoji: string;
  type: TxType;
  parent_id: string | null;
  group_id: string | null;
  monthly_budget_cents: number | null;
  sort_order: number;
  created_at: string;
}
export interface TxRow {
  id: string;
  type: TxType;
  amount_cents: number;
  category_id: string | null;
  place: string;
  date: string;
  created_at: string;
  recurring_id: string | null;
}
export interface RecRow {
  id: string;
  type: TxType;
  amount_cents: number;
  category_id: string | null;
  place: string;
  day_of_month: number;
  start_date: string;
  active: boolean;
}

export const GROUP_COLS = 'id,name,emoji,sort_order';
export const CAT_COLS = 'id,name,emoji,type,parent_id,group_id,monthly_budget_cents,sort_order,created_at';
export const TX_COLS = 'id,type,amount_cents,category_id,place,date,created_at,recurring_id';
export const REC_COLS = 'id,type,amount_cents,category_id,place,day_of_month,start_date,active';

export const groupFromRow = (r: GroupRow): Group => ({ id: r.id, name: r.name, emoji: r.emoji, order: r.sort_order });

export const catFromRow = (r: CatRow): Category => ({
  id: r.id,
  name: r.name,
  emoji: r.emoji,
  type: r.type,
  parentId: r.parent_id,
  groupId: r.group_id,
  budget: r.monthly_budget_cents == null ? null : Number(r.monthly_budget_cents),
  order: r.sort_order,
  createdAt: r.created_at
});

export const txFromRow = (r: TxRow): Transaction => ({
  id: r.id,
  type: r.type,
  amount: Number(r.amount_cents),
  categoryId: r.category_id,
  place: r.place ?? '',
  date: r.date.slice(0, 10),
  createdAt: r.created_at,
  recurringId: r.recurring_id ?? null
});

export const recFromRow = (r: RecRow): Recurring => ({
  id: r.id,
  type: r.type,
  amount: Number(r.amount_cents),
  categoryId: r.category_id,
  place: r.place ?? '',
  dayOfMonth: r.day_of_month,
  startDate: r.start_date.slice(0, 10),
  active: r.active
});

export function fail(e: unknown): never {
  throw new Error(friendlyError(e));
}

/* ---------- Contexto ---------- */

export type RecurringInput = Omit<Recurring, 'id'> & { id?: string };

interface DataCtx {
  uid: string;
  groups: Group[];
  categories: Category[];
  catMap: Map<string, Category>;
  groupMap: Map<string, Group>;
  recurring: Recurring[];
  loaded: boolean;
  loadError: string | null;
  /** Cambia cada vez que se modifican movimientos: las vistas vuelven a consultar */
  txVersion: number;
  refresh: () => void;
  saveTransaction: (t: Pick<Transaction, 'type' | 'amount' | 'categoryId' | 'place' | 'date'> & { id?: string }) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  saveCategory: (c: {
    id?: string;
    name: string;
    emoji: string;
    type: TxType;
    parentId?: string | null;
    groupId?: string | null;
    budget?: number | null;
  }) => Promise<void>;
  deleteCategory: (c: Category) => Promise<void>;
  saveGroup: (g: { id?: string; name: string; emoji: string }) => Promise<void>;
  deleteGroup: (g: Group) => Promise<void>;
  saveRecurring: (r: RecurringInput) => Promise<void>;
  deleteRecurring: (id: string) => Promise<void>;
}

const Ctx = createContext<DataCtx | null>(null);

export function useData() {
  const c = useContext(Ctx);
  if (!c) throw new Error('DataProvider missing');
  return c;
}

export function DataProvider({ uid, children }: { uid: string; children: ReactNode }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recurring, setRecurring] = useState<Recurring[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [txVersion, setTxVersion] = useState(0);
  const bump = useCallback(() => setTxVersion((v) => v + 1), []);

  const loadMeta = useCallback(async () => {
    const [g, c, r] = await Promise.all([
      supabase.from('category_groups').select(GROUP_COLS).eq('user_id', uid).order('sort_order').order('created_at'),
      supabase.from('categories').select(CAT_COLS).eq('user_id', uid).order('sort_order').order('created_at'),
      supabase.from('recurring').select(REC_COLS).eq('user_id', uid).order('created_at')
    ]);
    const err = g.error || c.error || r.error;
    if (err) {
      setLoadError(friendlyError(err));
      return;
    }
    setGroups((g.data as unknown as GroupRow[]).map(groupFromRow));
    setCategories((c.data as unknown as CatRow[]).map(catFromRow));
    setRecurring((r.data as unknown as RecRow[]).map(recFromRow));
    setLoadError(null);
    setLoaded(true);
  }, [uid]);

  /** Crea los movimientos recurrentes que ya tocan */
  const runRecurring = useCallback(async () => {
    const { data, error } = await supabase.rpc('generate_recurring', { p_today: todayISO() });
    if (!error && Number(data) > 0) bump();
  }, [bump]);

  useEffect(() => {
    setLoaded(false);
    loadMeta();
    runRecurring();
  }, [loadMeta, runRecurring]);

  const refresh = useCallback(() => {
    loadMeta();
    runRecurring();
    bump();
  }, [loadMeta, runRecurring, bump]);

  // Al volver a la pestaña o a la app, trae lo hecho en otros dispositivos
  useEffect(() => {
    let last = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 5000) return;
      last = Date.now();
      refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('online', refresh);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('online', refresh);
    };
  }, [refresh]);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const groupMap = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  const saveTransaction: DataCtx['saveTransaction'] = useCallback(
    async (t) => {
      const row = { type: t.type, amount_cents: t.amount, category_id: t.categoryId, place: t.place, date: t.date };
      const { error } = t.id
        ? await supabase.from('transactions').update(row).eq('user_id', uid).eq('id', t.id)
        : await supabase.from('transactions').insert({ ...row, user_id: uid });
      if (error) fail(error);
      bump();
    },
    [uid, bump]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('user_id', uid).eq('id', id);
      if (error) fail(error);
      bump();
    },
    [uid, bump]
  );

  const saveCategory: DataCtx['saveCategory'] = useCallback(
    async (c) => {
      const isRoot = !c.parentId;
      const patch: Record<string, unknown> = { name: c.name, emoji: c.emoji };
      if (c.groupId !== undefined && isRoot) patch.group_id = c.groupId;
      if (c.budget !== undefined) patch.monthly_budget_cents = c.budget && c.budget > 0 ? c.budget : null;
      if (c.id) {
        const { error } = await supabase.from('categories').update(patch).eq('user_id', uid).eq('id', c.id);
        if (error) fail(error);
      } else {
        const maxOrder = categories.reduce((m, x) => Math.max(m, x.order), 0);
        const { error } = await supabase.from('categories').insert({
          ...patch,
          user_id: uid,
          type: c.type,
          parent_id: c.parentId ?? null,
          sort_order: maxOrder + 1
        });
        if (error) fail(error);
      }
      await loadMeta();
    },
    [uid, categories, loadMeta]
  );

  const deleteCategory = useCallback(
    async (c: Category) => {
      if (c.parentId) {
        // Subcategoría: sus movimientos pasan a la categoría principal
        const { error: e1 } = await supabase
          .from('transactions')
          .update({ category_id: c.parentId })
          .eq('user_id', uid)
          .eq('category_id', c.id);
        if (e1) fail(e1);
      }
      // Categoría principal: la base de datos borra sus subcategorías y deja sus movimientos en "Sin categoría"
      const { error } = await supabase.from('categories').delete().eq('user_id', uid).eq('id', c.id);
      if (error) fail(error);
      await loadMeta();
      bump();
    },
    [uid, loadMeta, bump]
  );

  const saveGroup: DataCtx['saveGroup'] = useCallback(
    async (g) => {
      if (g.id) {
        const { error } = await supabase
          .from('category_groups')
          .update({ name: g.name, emoji: g.emoji })
          .eq('user_id', uid)
          .eq('id', g.id);
        if (error) fail(error);
      } else {
        const maxOrder = groups.reduce((m, x) => Math.max(m, x.order), 0);
        const { error } = await supabase
          .from('category_groups')
          .insert({ user_id: uid, name: g.name, emoji: g.emoji, sort_order: maxOrder + 1 });
        if (error) fail(error);
      }
      await loadMeta();
    },
    [uid, groups, loadMeta]
  );

  const deleteGroup = useCallback(
    async (g: Group) => {
      // Las categorías del grupo quedan sin grupo (no se borran)
      const { error } = await supabase.from('category_groups').delete().eq('user_id', uid).eq('id', g.id);
      if (error) fail(error);
      await loadMeta();
    },
    [uid, loadMeta]
  );

  const saveRecurring = useCallback(
    async (r: RecurringInput) => {
      const row = {
        type: r.type,
        amount_cents: r.amount,
        category_id: r.categoryId,
        place: r.place,
        day_of_month: r.dayOfMonth,
        start_date: r.startDate,
        active: r.active
      };
      const { error } = r.id
        ? await supabase.from('recurring').update(row).eq('user_id', uid).eq('id', r.id)
        : await supabase.from('recurring').insert({ ...row, user_id: uid });
      if (error) fail(error);
      await loadMeta();
      await runRecurring();
      bump();
    },
    [uid, loadMeta, runRecurring, bump]
  );

  const deleteRecurring = useCallback(
    async (id: string) => {
      // Los movimientos ya creados se conservan
      const { error } = await supabase.from('recurring').delete().eq('user_id', uid).eq('id', id);
      if (error) fail(error);
      await loadMeta();
    },
    [uid, loadMeta]
  );

  return (
    <Ctx.Provider
      value={{
        uid,
        groups,
        categories,
        catMap,
        groupMap,
        recurring,
        loaded,
        loadError,
        txVersion,
        refresh,
        saveTransaction,
        deleteTransaction,
        saveCategory,
        deleteCategory,
        saveGroup,
        deleteGroup,
        saveRecurring,
        deleteRecurring
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

/* ---------- Consultas de movimientos ---------- */

export function lastDayOfMonth(month: string) {
  const [y, m] = month.split('-').map(Number);
  return `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
}

// Caché en memoria para que cambiar de pestaña o de mes sea instantáneo
const rangeCache = new Map<string, Transaction[]>();

/** Movimientos entre dos meses (inclusive), del más nuevo al más viejo */
export function useTxRange(fromMonth: string, toMonth: string) {
  const { uid, txVersion } = useData();
  const key = `${uid}:${fromMonth}:${toMonth}`;
  const [data, setData] = useState<Transaction[] | undefined>(() => rangeCache.get(key));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reqId = useRef(0);

  useEffect(() => {
    setData(rangeCache.get(key));
    const id = ++reqId.current;
    setLoading(true);
    (async () => {
      const { data: rows, error: e } = await supabase
        .from('transactions')
        .select(TX_COLS)
        .eq('user_id', uid)
        .gte('date', `${fromMonth}-01`)
        .lte('date', lastDayOfMonth(toMonth))
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10000);
      if (id !== reqId.current) return;
      setLoading(false);
      if (e) {
        setError(friendlyError(e));
        return;
      }
      const list = (rows as unknown as TxRow[]).map(txFromRow);
      rangeCache.set(key, list);
      setData(list);
      setError(null);
    })();
  }, [key, uid, fromMonth, toMonth, txVersion]);

  return { data, error, loading };
}

export function useMonthTx(month: string) {
  return useTxRange(month, month);
}

/** Lugares usados antes (para sugerencias), del más usado al menos usado */
export async function fetchPlaces(uid: string, type: TxType): Promise<string[]> {
  const { data, error } = await supabase
    .from('place_usage')
    .select('place,uses')
    .eq('user_id', uid)
    .eq('type', type)
    .order('uses', { ascending: false })
    .limit(40);
  if (error) return [];
  return (data as unknown as Array<{ place: string }>).map((r) => r.place);
}

/** Cantidad de movimientos por categoría (todas las fechas) */
export async function fetchCategoryUsage(uid: string): Promise<Map<string, number>> {
  const { data, error } = await supabase.from('category_usage').select('category_id,tx_count').eq('user_id', uid);
  if (error) return new Map();
  return new Map(
    (data as unknown as Array<{ category_id: string; tx_count: number }>).map((r) => [r.category_id, r.tx_count])
  );
}

export async function fetchUncategorizedCount(uid: string, type: TxType): Promise<number> {
  const { count } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', uid)
    .eq('type', type)
    .is('category_id', null);
  return count ?? 0;
}

/* ---------- Ayudas de categorías ---------- */

export const UNCATEGORIZED = { name: 'Sin categoría', emoji: '❔' };
export const NO_GROUP = { id: '__nogroup__', name: 'Sin grupo', emoji: '📂' };

export function topLevel(categories: Category[], type: TxType) {
  return categories.filter((c) => c.type === type && !c.parentId);
}

export function childrenOf(categories: Category[], id: string) {
  return categories.filter((c) => c.parentId === id);
}

/** Categoría principal de una categoría o subcategoría */
export function rootOf(map: Map<string, Category>, id: string | null): Category | undefined {
  const c = id ? map.get(id) : undefined;
  if (!c) return undefined;
  return c.parentId ? map.get(c.parentId) ?? c : c;
}

/** Grupo al que pertenece un movimiento (por su categoría principal) */
export function groupIdOf(map: Map<string, Category>, categoryId: string | null): string | null {
  return rootOf(map, categoryId)?.groupId ?? null;
}

/** Datos para mostrar un movimiento: emoji, nombre y "Padre › Sub" si aplica */
export function catInfo(map: Map<string, Category>, id: string | null) {
  const c = id ? map.get(id) : undefined;
  if (!c) return { ...UNCATEGORIZED, full: UNCATEGORIZED.name, rootId: null as string | null };
  const parent = c.parentId ? map.get(c.parentId) : undefined;
  return {
    name: c.name,
    emoji: c.emoji,
    full: parent ? `${parent.name} › ${c.name}` : c.name,
    rootId: parent ? parent.id : c.id
  };
}

/** Agrupa categorías principales por grupo, en el orden de los grupos */
export function byGroup(roots: Category[], groups: Group[]) {
  const sections: Array<{ group: Group | null; items: Category[] }> = groups.map((g) => ({
    group: g,
    items: roots.filter((c) => c.groupId === g.id)
  }));
  const loose = roots.filter((c) => !c.groupId || !groups.some((g) => g.id === c.groupId));
  if (loose.length) sections.push({ group: null, items: loose });
  return sections.filter((s) => s.items.length > 0);
}

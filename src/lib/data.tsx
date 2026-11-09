import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { friendlyError, supabase } from './supabase';
import type { Category, Transaction, TxType } from './types';

/* ---------- Mapeo filas de Supabase <-> app ---------- */

interface CatRow {
  id: string;
  name: string;
  emoji: string;
  type: TxType;
  parent_id: string | null;
  sort_order: number;
  created_at: string;
}
interface TxRow {
  id: string;
  type: TxType;
  amount_cents: number;
  category_id: string | null;
  place: string;
  date: string;
  created_at: string;
}

const CAT_COLS = 'id,name,emoji,type,parent_id,sort_order,created_at';
const TX_COLS = 'id,type,amount_cents,category_id,place,date,created_at';

export const catFromRow = (r: CatRow): Category => ({
  id: r.id,
  name: r.name,
  emoji: r.emoji,
  type: r.type,
  parentId: r.parent_id,
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
  createdAt: r.created_at
});

export function fail(e: unknown): never {
  throw new Error(friendlyError(e));
}

/* ---------- Contexto ---------- */

interface DataCtx {
  uid: string;
  categories: Category[];
  catMap: Map<string, Category>;
  catsLoaded: boolean;
  catsError: string | null;
  /** Cambia cada vez que se modifican movimientos: las vistas vuelven a consultar */
  txVersion: number;
  refresh: () => void;
  saveTransaction: (t: Pick<Transaction, 'type' | 'amount' | 'categoryId' | 'place' | 'date'> & { id?: string }) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  saveCategory: (c: { id?: string; name: string; emoji: string; type: TxType; parentId?: string | null }) => Promise<void>;
  deleteCategory: (c: Category) => Promise<void>;
}

const Ctx = createContext<DataCtx | null>(null);

export function useData() {
  const c = useContext(Ctx);
  if (!c) throw new Error('DataProvider missing');
  return c;
}

export function DataProvider({ uid, children }: { uid: string; children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [catsLoaded, setCatsLoaded] = useState(false);
  const [catsError, setCatsError] = useState<string | null>(null);
  const [txVersion, setTxVersion] = useState(0);

  const loadCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from('categories')
      .select(CAT_COLS)
      .eq('user_id', uid)
      .order('sort_order')
      .order('created_at');
    if (error) {
      setCatsError(friendlyError(error));
      return;
    }
    setCategories((data as CatRow[]).map(catFromRow));
    setCatsError(null);
    setCatsLoaded(true);
  }, [uid]);

  useEffect(() => {
    setCatsLoaded(false);
    loadCategories();
  }, [loadCategories]);

  const refresh = useCallback(() => {
    loadCategories();
    setTxVersion((v) => v + 1);
  }, [loadCategories]);

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

  const saveTransaction: DataCtx['saveTransaction'] = useCallback(
    async (t) => {
      const row = {
        type: t.type,
        amount_cents: t.amount,
        category_id: t.categoryId,
        place: t.place,
        date: t.date
      };
      const { error } = t.id
        ? await supabase.from('transactions').update(row).eq('user_id', uid).eq('id', t.id)
        : await supabase.from('transactions').insert({ ...row, user_id: uid });
      if (error) fail(error);
      setTxVersion((v) => v + 1);
    },
    [uid]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('user_id', uid).eq('id', id);
      if (error) fail(error);
      setTxVersion((v) => v + 1);
    },
    [uid]
  );

  const saveCategory: DataCtx['saveCategory'] = useCallback(
    async (c) => {
      if (c.id) {
        const { error } = await supabase
          .from('categories')
          .update({ name: c.name, emoji: c.emoji })
          .eq('user_id', uid)
          .eq('id', c.id);
        if (error) fail(error);
      } else {
        const maxOrder = categories.reduce((m, x) => Math.max(m, x.order), 0);
        const { error } = await supabase.from('categories').insert({
          user_id: uid,
          name: c.name,
          emoji: c.emoji,
          type: c.type,
          parent_id: c.parentId ?? null,
          sort_order: maxOrder + 1
        });
        if (error) fail(error);
      }
      await loadCategories();
    },
    [uid, categories, loadCategories]
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
      // Categoría principal: la base de datos borra sus subcategorías y deja
      // sus movimientos en "Sin categoría"
      const { error } = await supabase.from('categories').delete().eq('user_id', uid).eq('id', c.id);
      if (error) fail(error);
      await loadCategories();
      setTxVersion((v) => v + 1);
    },
    [uid, loadCategories]
  );

  return (
    <Ctx.Provider
      value={{
        uid,
        categories,
        catMap,
        catsLoaded,
        catsError,
        txVersion,
        refresh,
        saveTransaction,
        deleteTransaction,
        saveCategory,
        deleteCategory
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

/* ---------- Consultas ---------- */

function lastDayOfMonth(month: string) {
  const [y, m] = month.split('-').map(Number);
  return `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
}

// Caché en memoria para que cambiar de pestaña o de mes sea instantáneo
const monthCache = new Map<string, Transaction[]>();

export function useMonthTx(month: string) {
  const { uid, txVersion } = useData();
  const key = `${uid}:${month}`;
  const [data, setData] = useState<Transaction[] | undefined>(() => monthCache.get(key));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reqId = useRef(0);

  useEffect(() => {
    setData(monthCache.get(key));
    const id = ++reqId.current;
    setLoading(true);
    (async () => {
      const { data: rows, error: e } = await supabase
        .from('transactions')
        .select(TX_COLS)
        .eq('user_id', uid)
        .gte('date', `${month}-01`)
        .lte('date', lastDayOfMonth(month))
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5000);
      if (id !== reqId.current) return;
      setLoading(false);
      if (e) {
        setError(friendlyError(e));
        return;
      }
      const list = (rows as TxRow[]).map(txFromRow);
      monthCache.set(key, list);
      setData(list);
      setError(null);
    })();
  }, [key, uid, month, txVersion]);

  return { data, error, loading };
}

export function clearDataCache() {
  monthCache.clear();
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
  return (data as Array<{ place: string }>).map((r) => r.place);
}

/** Cantidad de movimientos por categoría (todas las fechas) */
export async function fetchCategoryUsage(uid: string): Promise<Map<string, number>> {
  const { data, error } = await supabase.from('category_usage').select('category_id,tx_count').eq('user_id', uid);
  if (error) return new Map();
  return new Map((data as Array<{ category_id: string; tx_count: number }>).map((r) => [r.category_id, r.tx_count]));
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

export function topLevel(categories: Category[], type: TxType) {
  return categories.filter((c) => c.type === type && !c.parentId);
}

export function childrenOf(categories: Category[], id: string) {
  return categories.filter((c) => c.parentId === id);
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


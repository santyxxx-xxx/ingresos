import { supabase } from './supabase';
import { db, getMeta, setMeta } from './db';
import type { Category, Transaction } from './types';

/*
 * Sincronización "local primero":
 * - La app siempre lee y escribe en IndexedDB (funciona sin internet).
 * - Cada cambio local queda con dirty = 1.
 * - sync(): primero descarga lo nuevo de la nube (por synced_at), luego sube lo pendiente.
 * - Conflictos: gana el cambio con updated_at más reciente (también lo exige el servidor).
 */

const PAGE = 1000;
const OVERLAP_MS = 5000;

function iso(ms: number) {
  return new Date(ms || 0).toISOString();
}

/** Safari es quisquilloso con fracciones de 6 dígitos: se recortan a 3 */
export function parseTs(s: string): number {
  return Date.parse(s.replace(/(\.\d{3})\d+/, '$1').replace(' ', 'T'));
}

interface RemoteCategory {
  user_id: string;
  id: string;
  name: string;
  emoji: string;
  type: 'expense' | 'income';
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted: boolean;
  synced_at: string;
}

interface RemoteTransaction {
  user_id: string;
  id: string;
  type: 'expense' | 'income';
  amount_cents: number;
  category_id: string | null;
  place: string;
  date: string;
  created_at: string;
  updated_at: string;
  deleted: boolean;
  synced_at: string;
}

const catToRemote = (c: Category, uid: string) => ({
  user_id: uid,
  id: c.id,
  name: c.name.slice(0, 60) || 'Sin nombre',
  emoji: c.emoji || '🏷️',
  type: c.type,
  sort_order: c.order,
  created_at: iso(c.createdAt),
  updated_at: iso(c.updatedAt),
  deleted: !!c.deleted
});

const catFromRemote = (r: RemoteCategory): Category => ({
  id: r.id,
  name: r.name,
  emoji: r.emoji,
  type: r.type,
  order: r.sort_order,
  createdAt: parseTs(r.created_at),
  updatedAt: parseTs(r.updated_at),
  deleted: r.deleted ? 1 : 0,
  dirty: 0
});

const txToRemote = (t: Transaction, uid: string) => ({
  user_id: uid,
  id: t.id,
  type: t.type,
  amount_cents: Math.max(0, Math.round(t.amount)),
  category_id: t.categoryId,
  place: t.place ?? '',
  date: t.date,
  created_at: iso(t.createdAt),
  updated_at: iso(t.updatedAt),
  deleted: !!t.deleted
});

const txFromRemote = (r: RemoteTransaction): Transaction => ({
  id: r.id,
  type: r.type,
  amount: Number(r.amount_cents),
  categoryId: r.category_id,
  place: r.place ?? '',
  date: r.date.slice(0, 10),
  createdAt: parseTs(r.created_at),
  updatedAt: parseTs(r.updated_at),
  deleted: r.deleted ? 1 : 0,
  dirty: 0
});

async function pullTable<R extends { synced_at: string; updated_at: string; id: string }, L extends { updatedAt: number; dirty: 0 | 1 }>(
  uid: string,
  name: 'categories' | 'transactions',
  table: typeof db.categories | typeof db.transactions,
  fromRemote: (r: R) => L
): Promise<number> {
  if (!supabase) return 0;
  const cursorKey = `cursor:${name}:${uid}`;
  const cursor = Number((await getMeta(cursorKey)) ?? 0);
  let since = iso(Math.max(0, cursor - OVERLAP_MS));
  let maxSeen = cursor;
  let changed = 0;

  for (;;) {
    const { data, error } = await supabase
      .from(name)
      .select('*')
      .eq('user_id', uid)
      .gte('synced_at', since)
      .order('synced_at', { ascending: true })
      .limit(PAGE);
    if (error) throw error;
    const rows = (data ?? []) as R[];
    if (rows.length === 0) break;

    await db.transaction('rw', table, async () => {
      for (const r of rows) {
        const local = (await (table as typeof db.transactions).get(r.id)) as unknown as L | undefined;
        const remoteUpdated = parseTs(r.updated_at);
        // Si aquí hay un cambio local más nuevo sin subir, se conserva
        if (local && local.dirty && local.updatedAt > remoteUpdated) continue;
        if (local && !local.dirty && local.updatedAt === remoteUpdated) continue;
        await (table as typeof db.transactions).put(fromRemote(r) as unknown as Transaction);
        changed++;
      }
    });

    for (const r of rows) maxSeen = Math.max(maxSeen, parseTs(r.synced_at));
    if (rows.length < PAGE) break;
    const lastTs = rows[rows.length - 1].synced_at;
    if (lastTs === since) break; // evita bucles con muchos registros en el mismo instante
    since = lastTs;
  }

  await setMeta(cursorKey, String(maxSeen));
  return changed;
}

async function pushTable<L extends { id: string; updatedAt: number }>(
  uid: string,
  name: 'categories' | 'transactions',
  table: typeof db.categories | typeof db.transactions,
  toRemote: (row: L, uid: string) => object
): Promise<number> {
  if (!supabase) return 0;
  const dirty = (await (table as typeof db.transactions).where('dirty').equals(1).toArray()) as unknown as L[];
  for (let i = 0; i < dirty.length; i += 500) {
    const chunk = dirty.slice(i, i + 500);
    const { error } = await supabase
      .from(name)
      .upsert(
        chunk.map((r) => toRemote(r, uid)),
        { onConflict: 'user_id,id' }
      );
    if (error) throw error;
    // Solo se limpia si no cambió mientras se subía
    await db.transaction('rw', table, async () => {
      for (const r of chunk) {
        const cur = (await (table as typeof db.transactions).get(r.id)) as unknown as L | undefined;
        if (cur && cur.updatedAt === r.updatedAt) await (table as typeof db.transactions).update(r.id, { dirty: 0 });
      }
    });
  }
  return dirty.length;
}

export async function pendingCount() {
  const [a, b] = await Promise.all([
    db.categories.where('dirty').equals(1).count(),
    db.transactions.where('dirty').equals(1).count()
  ]);
  return a + b;
}

/**
 * Asocia los datos de este dispositivo a la cuenta. Si el dispositivo tenía datos sin
 * cuenta, se suben y se mezclan con los de la nube. Devuelve false si los datos locales
 * pertenecen a otra cuenta (no debería pasar: al cerrar sesión se limpian).
 */
export async function claimLocal(uid: string): Promise<boolean> {
  const owner = await getMeta('owner');
  if (!owner) {
    await setMeta('owner', uid);
    return true;
  }
  return owner === uid;
}

export async function syncOnce(uid: string) {
  // Categorías antes que movimientos; descargar antes de subir
  const pulledC = await pullTable<RemoteCategory, Category>(uid, 'categories', db.categories, catFromRemote);
  const pulledT = await pullTable<RemoteTransaction, Transaction>(uid, 'transactions', db.transactions, txFromRemote);
  const pushedC = await pushTable<Category>(uid, 'categories', db.categories, catToRemote);
  const pushedT = await pushTable<Transaction>(uid, 'transactions', db.transactions, txToRemote);
  await setMeta(`lastSync:${uid}`, String(Date.now()));
  return { pulled: pulledC + pulledT, pushed: pushedC + pushedT };
}

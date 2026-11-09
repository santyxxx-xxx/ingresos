import Dexie, { type Table } from 'dexie';
import type { Category, Transaction, TxType } from './types';
import { uid } from './utils';

interface Meta {
  key: string;
  value: string;
}

class IngresosDB extends Dexie {
  categories!: Table<Category, string>;
  transactions!: Table<Transaction, string>;
  meta!: Table<Meta, string>;

  constructor() {
    super('ingresos');
    this.version(1).stores({
      categories: 'id, type, order',
      transactions: 'id, date, categoryId, type, [type+date]'
    });
    this.version(2)
      .stores({
        categories: 'id, type, order, dirty',
        transactions: 'id, date, categoryId, type, dirty',
        meta: 'key'
      })
      .upgrade(async (tx) => {
        // 1) Las categorías base pasan a tener un id fijo, igual en todos los dispositivos
        const cats = tx.table('categories');
        const txs = tx.table('transactions');
        const all = (await cats.toArray()) as Category[];
        const taken = new Set(all.map((c) => c.id));
        for (const c of all) {
          const baseId = baseIdFor(c.name, c.type);
          if (!baseId || baseId === c.id || taken.has(baseId)) continue;
          taken.add(baseId);
          await cats.delete(c.id);
          await cats.add({ ...c, id: baseId });
          await txs.where('categoryId').equals(c.id).modify({ categoryId: baseId });
        }
        // 2) Campos de sincronización
        await cats.toCollection().modify((c: Category) => {
          c.updatedAt = c.createdAt || Date.now();
          c.deleted = 0;
          c.dirty = 1;
        });
        await txs.toCollection().modify((t: Transaction) => {
          t.updatedAt = t.createdAt || Date.now();
          t.deleted = 0;
          t.dirty = 1;
        });
      });
  }
}

export const db = new IngresosDB();

/* ---------- Categorías base ---------- */

const BASE: Array<[string, string, string, TxType]> = [
  ['base-comida', 'Comida', '🍽️', 'expense'],
  ['base-transporte', 'Transporte', '🚕', 'expense'],
  ['base-hogar', 'Hogar', '🏠', 'expense'],
  ['base-salud', 'Salud', '💊', 'expense'],
  ['base-ocio', 'Ocio', '🎬', 'expense'],
  ['base-educacion', 'Educación', '📚', 'expense'],
  ['base-ropa', 'Ropa', '👕', 'expense'],
  ['base-otros', 'Otros', '📦', 'expense'],
  ['base-sueldo', 'Sueldo', '💼', 'income'],
  ['base-freelance', 'Freelance', '💻', 'income'],
  ['base-otros-ingresos', 'Otros ingresos', '✨', 'income']
];

function baseIdFor(name: string, type: TxType): string | null {
  const hit = BASE.find(([, n, , t]) => n === name && t === type);
  return hit ? hit[0] : null;
}

/**
 * Categorías base con id fijo y updatedAt = 0: si la cuenta ya tiene esas
 * categorías (editadas o borradas), la versión de la nube siempre gana.
 */
export function baseCategories(): Category[] {
  return BASE.map(([id, name, emoji, type], i) => ({
    id,
    name,
    emoji,
    type,
    order: i,
    createdAt: 0,
    updatedAt: 0,
    deleted: 0,
    dirty: 1
  }));
}

db.on('populate', (tx) => {
  tx.table('categories').bulkAdd(baseCategories());
});

/** Deja el dispositivo como recién instalado (al cerrar sesión) */
export async function resetLocal() {
  await db.transaction('rw', db.categories, db.transactions, db.meta, async () => {
    await db.transactions.clear();
    await db.categories.clear();
    await db.meta.clear();
    await db.categories.bulkAdd(baseCategories());
  });
}

export async function getMeta(key: string) {
  return (await db.meta.get(key))?.value ?? null;
}
export function setMeta(key: string, value: string) {
  return db.meta.put({ key, value });
}

/* ---------- Movimientos ---------- */

export function txInMonth(month: string) {
  return db.transactions
    .where('date')
    .between(`${month}-01`, `${month}-31`, true, true)
    .filter((t) => !t.deleted)
    .toArray();
}

export async function saveTransaction(
  t: Pick<Transaction, 'type' | 'amount' | 'categoryId' | 'place' | 'date'> & { id?: string }
) {
  const now = Date.now();
  if (t.id) {
    await db.transactions.update(t.id, {
      type: t.type,
      amount: t.amount,
      categoryId: t.categoryId,
      place: t.place,
      date: t.date,
      updatedAt: now,
      dirty: 1
    });
    return t.id;
  }
  const id = uid();
  await db.transactions.add({ ...t, id, createdAt: now, updatedAt: now, deleted: 0, dirty: 1 });
  return id;
}

export function deleteTransaction(id: string) {
  return db.transactions.update(id, { deleted: 1, dirty: 1, updatedAt: Date.now() });
}

/* ---------- Categorías ---------- */

export async function saveCategory(c: { id?: string; name: string; emoji: string; type: TxType }) {
  const now = Date.now();
  if (c.id) {
    await db.categories.update(c.id, { name: c.name, emoji: c.emoji, updatedAt: now, dirty: 1 });
    return c.id;
  }
  const last = await db.categories.orderBy('order').last();
  const id = uid();
  await db.categories.add({
    id,
    name: c.name,
    emoji: c.emoji,
    type: c.type,
    order: (last?.order ?? 0) + 1,
    createdAt: now,
    updatedAt: now,
    deleted: 0,
    dirty: 1
  });
  return id;
}

/** Borra la categoría; sus movimientos pasan a "Sin categoría" (categoryId = null). */
export async function deleteCategory(id: string) {
  const now = Date.now();
  await db.transaction('rw', db.categories, db.transactions, async () => {
    await db.transactions
      .where('categoryId')
      .equals(id)
      .modify({ categoryId: null, updatedAt: now, dirty: 1 });
    await db.categories.update(id, { deleted: 1, dirty: 1, updatedAt: now });
  });
}

export function countTxInCategory(id: string) {
  return db.transactions
    .where('categoryId')
    .equals(id)
    .filter((t) => !t.deleted)
    .count();
}

import Dexie, { type Table } from 'dexie';
import type { Category, Transaction, TxType } from './types';
import { uid } from './utils';

class IngresosDB extends Dexie {
  categories!: Table<Category, string>;
  transactions!: Table<Transaction, string>;

  constructor() {
    super('ingresos');
    this.version(1).stores({
      categories: 'id, type, order',
      transactions: 'id, date, categoryId, type, [type+date]'
    });
  }
}

export const db = new IngresosDB();

const BASE: Array<[string, string, TxType]> = [
  ['Comida', '🍽️', 'expense'],
  ['Transporte', '🚕', 'expense'],
  ['Hogar', '🏠', 'expense'],
  ['Salud', '💊', 'expense'],
  ['Ocio', '🎬', 'expense'],
  ['Educación', '📚', 'expense'],
  ['Ropa', '👕', 'expense'],
  ['Otros', '📦', 'expense'],
  ['Sueldo', '💼', 'income'],
  ['Freelance', '💻', 'income'],
  ['Otros ingresos', '✨', 'income']
];

export function baseCategories(): Category[] {
  const now = Date.now();
  return BASE.map(([name, emoji, type], i) => ({
    id: uid(),
    name,
    emoji,
    type,
    order: i,
    createdAt: now + i
  }));
}

db.on('populate', (tx) => {
  tx.table('categories').bulkAdd(baseCategories());
});

/* ---------- Movimientos ---------- */

export function monthRange(month: string): [string, string] {
  return [`${month}-01`, `${month}-31`];
}

export function txInMonth(month: string) {
  const [a, b] = monthRange(month);
  return db.transactions.where('date').between(a, b, true, true).toArray();
}

export async function saveTransaction(t: Omit<Transaction, 'id' | 'createdAt'> & { id?: string }) {
  if (t.id) {
    await db.transactions.update(t.id, {
      type: t.type,
      amount: t.amount,
      categoryId: t.categoryId,
      place: t.place,
      date: t.date
    });
    return t.id;
  }
  const id = uid();
  await db.transactions.add({ ...t, id, createdAt: Date.now() });
  return id;
}

export function deleteTransaction(id: string) {
  return db.transactions.delete(id);
}

/* ---------- Categorías ---------- */

export async function saveCategory(c: { id?: string; name: string; emoji: string; type: TxType }) {
  if (c.id) {
    await db.categories.update(c.id, { name: c.name, emoji: c.emoji });
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
    createdAt: Date.now()
  });
  return id;
}

/** Borra la categoría; sus movimientos pasan a "Sin categoría" (categoryId = null). */
export async function deleteCategory(id: string) {
  await db.transaction('rw', db.categories, db.transactions, async () => {
    await db.transactions.where('categoryId').equals(id).modify({ categoryId: null });
    await db.categories.delete(id);
  });
}

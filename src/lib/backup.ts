import { db } from './db';
import type { BackupFile, Category, Transaction } from './types';
import { todayISO } from './utils';

function stripSync<T extends { dirty: unknown; deleted: unknown }>(row: T): Omit<T, 'dirty' | 'deleted'> {
  const copy: Partial<T> = { ...row };
  delete copy.dirty;
  delete copy.deleted;
  return copy as Omit<T, 'dirty' | 'deleted'>;
}

export async function buildBackup(): Promise<BackupFile> {
  return {
    app: 'ingresos',
    version: 1,
    exportedAt: new Date().toISOString(),
    categories: (await db.categories.toArray())
      .filter((c) => !c.deleted)
      .map(stripSync),
    transactions: (await db.transactions.toArray())
      .filter((t) => !t.deleted)
      .map(stripSync)
  };
}

export async function exportBackup(): Promise<'shared' | 'downloaded'> {
  const data = await buildBackup();
  const json = JSON.stringify(data, null, 2);
  const name = `ingresos-respaldo-${todayISO()}.json`;
  const file = new File([json], name, { type: 'application/json' });

  // En móvil, el menú de compartir permite guardar en Archivos/Drive
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

function isCategory(c: unknown): c is Category {
  const o = c as Category;
  return !!o && typeof o.id === 'string' && typeof o.name === 'string' &&
    (o.type === 'expense' || o.type === 'income');
}

function isTransaction(t: unknown): t is Transaction {
  const o = t as Transaction;
  return !!o && typeof o.id === 'string' && typeof o.amount === 'number' &&
    (o.type === 'expense' || o.type === 'income') && typeof o.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(o.date);
}

export async function parseBackup(file: File): Promise<BackupFile> {
  const text = await file.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  return validateBackup(data);
}

export function validateBackup(data: unknown): BackupFile {
  const d = data as Partial<BackupFile>;
  if (!d || d.app !== 'ingresos' || !Array.isArray(d.categories) || !Array.isArray(d.transactions)) {
    throw new Error('Este archivo no es un respaldo de Ingresos.');
  }
  const categories = d.categories.filter(isCategory).map((c, i) => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji || '🏷️',
    type: c.type,
    order: typeof c.order === 'number' ? c.order : i,
    createdAt: typeof c.createdAt === 'number' ? c.createdAt : Date.now()
  }));
  const catIds = new Set(categories.map((c) => c.id));
  const transactions = d.transactions.filter(isTransaction).map((t) => ({
    id: t.id,
    type: t.type,
    amount: Math.round(t.amount),
    categoryId: t.categoryId && catIds.has(t.categoryId) ? t.categoryId : null,
    place: typeof t.place === 'string' ? t.place : '',
    date: t.date,
    createdAt: typeof t.createdAt === 'number' ? t.createdAt : Date.now()
  }));
  return { app: 'ingresos', version: 1, exportedAt: d.exportedAt ?? '', categories, transactions };
}

/**
 * Reemplaza todos los datos por los del respaldo. Lo que no está en el archivo se
 * marca como borrado (y se sincroniza), lo del archivo se marca como cambio nuevo.
 */
export async function restoreBackup(b: BackupFile) {
  const now = Date.now();
  await db.transaction('rw', db.categories, db.transactions, async () => {
    const catIds = new Set(b.categories.map((c) => c.id));
    const txIds = new Set(b.transactions.map((t) => t.id));
    await db.categories
      .filter((c) => !catIds.has(c.id) && !c.deleted)
      .modify({ deleted: 1, dirty: 1, updatedAt: now });
    await db.transactions
      .filter((t) => !txIds.has(t.id) && !t.deleted)
      .modify({ deleted: 1, dirty: 1, updatedAt: now });
    await db.categories.bulkPut(
      b.categories.map((c) => ({ ...c, updatedAt: now, deleted: 0 as const, dirty: 1 as const }))
    );
    await db.transactions.bulkPut(
      b.transactions.map((t) => ({ ...t, updatedAt: now, deleted: 0 as const, dirty: 1 as const }))
    );
  });
}

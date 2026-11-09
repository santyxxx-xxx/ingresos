export type TxType = 'expense' | 'income';

/** Campos de sincronización comunes */
interface Syncable {
  /** ms epoch del último cambio (gana el más reciente) */
  updatedAt: number;
  /** 1 = borrado (se conserva para propagar el borrado a otros dispositivos) */
  deleted: 0 | 1;
  /** 1 = tiene cambios sin subir a la nube */
  dirty: 0 | 1;
}

export interface Category extends Syncable {
  id: string;
  name: string;
  emoji: string;
  type: TxType;
  order: number;
  createdAt: number;
}

export interface Transaction extends Syncable {
  id: string;
  type: TxType;
  /** Monto en centavos (entero) para evitar errores de redondeo */
  amount: number;
  /** null = "Sin categoría" */
  categoryId: string | null;
  place: string;
  /** YYYY-MM-DD */
  date: string;
  createdAt: number;
}

export interface BackupFile {
  app: 'ingresos';
  version: 1;
  exportedAt: string;
  categories: Array<Omit<Category, 'dirty' | 'deleted' | 'updatedAt'> & Partial<Syncable>>;
  transactions: Array<Omit<Transaction, 'dirty' | 'deleted' | 'updatedAt'> & Partial<Syncable>>;
}

export type TxType = 'expense' | 'income';

export interface Category {
  id: string;
  name: string;
  emoji: string;
  type: TxType;
  /** null = categoría principal; si tiene valor, es subcategoría de esa categoría */
  parentId: string | null;
  order: number;
  createdAt: string;
}

export interface Transaction {
  id: string;
  type: TxType;
  /** Monto en centavos (entero) para evitar errores de redondeo */
  amount: number;
  /** null = "Sin categoría". Puede ser una categoría o una subcategoría */
  categoryId: string | null;
  place: string;
  /** YYYY-MM-DD */
  date: string;
  createdAt: string;
}

export interface BackupFile {
  app: 'ingresos';
  version: 2;
  exportedAt: string;
  categories: Category[];
  transactions: Transaction[];
}

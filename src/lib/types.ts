export type TxType = 'expense' | 'income';

export interface Category {
  id: string;
  name: string;
  emoji: string;
  type: TxType;
  order: number;
  createdAt: number;
}

export interface Transaction {
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
  categories: Category[];
  transactions: Transaction[];
}

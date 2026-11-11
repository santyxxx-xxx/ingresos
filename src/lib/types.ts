export type TxType = 'expense' | 'income';

/** Sección: a quién o a qué pertenece un movimiento, ej. Casa, Personal, Hijo */
export interface Group {
  id: string;
  name: string;
  emoji: string;
  order: number;
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
  type: TxType;
  /** null = categoría principal; si tiene valor, es subcategoría de esa categoría */
  parentId: string | null;
  /** Solo en categorías principales */
  groupId: string | null;
  /** Presupuesto mensual en centavos (solo categorías principales de gasto) */
  budget: number | null;
  order: number;
  createdAt: string;
}

export interface Transaction {
  id: string;
  type: TxType;
  /** Monto en centavos (entero) */
  amount: number;
  /** null = "Sin categoría". Puede ser una categoría o una subcategoría */
  categoryId: string | null;
  place: string;
  /** YYYY-MM-DD */
  date: string;
  createdAt: string;
  recurringId: string | null;
  /** Sección (Casa, Personal, Hijo…); null = sin sección */
  sectionId: string | null;
}

export type Frequency = 'monthly' | 'weekly';

export interface Recurring {
  id: string;
  /** Cada mes (día del mes) o cada semana (día de la semana) */
  frequency: Frequency;
  /** 1 = lunes … 7 = domingo (solo semanales) */
  dayOfWeek: number | null;
  type: TxType;
  amount: number;
  categoryId: string | null;
  place: string;
  dayOfMonth: number;
  startDate: string;
  active: boolean;
  sectionId: string | null;
}

export interface BackupFile {
  app: 'ingresos';
  version: 3;
  exportedAt: string;
  groups: Group[];
  categories: Category[];
  transactions: Transaction[];
  recurring: Recurring[];
}

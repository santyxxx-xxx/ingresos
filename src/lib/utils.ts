export function uid(): string {
  // crypto.randomUUID solo existe en contextos seguros (HTTPS / localhost)
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    /* noop */
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

const usd = new Intl.NumberFormat('es-EC', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

/** Formatea centavos como USD: 123456 -> "$1.234,56" */
export function money(cents: number): string {
  return usd.format(cents / 100).replace(/\s/g, '').replace('US$', '$');
}

export function moneyParts(cents: number): { int: string; dec: string; sign: string } {
  const s = money(Math.abs(cents));
  const m = s.match(/^(.*?)([.,]\d{2})$/);
  return { sign: cents < 0 ? '−' : '', int: m ? m[1] : s, dec: m ? m[2] : '' };
}

/** "12,5" o "12.50" -> 1250 centavos. Devuelve NaN si no es válido. */
export function parseAmount(input: string): number {
  const clean = input.replace(/[^\d.,]/g, '');
  if (!clean || !/\d/.test(clean)) return NaN;
  const commas = (clean.match(/,/g) || []).length;
  const dots = (clean.match(/\./g) || []).length;
  let normalized = clean;
  if (commas && dots) {
    // Mixto: el último separador es el decimal
    const dec = clean.lastIndexOf(',') > clean.lastIndexOf('.') ? ',' : '.';
    const thou = dec === ',' ? '.' : ',';
    normalized = clean.split(thou).join('').replace(dec, '.');
  } else if (commas + dots === 1) {
    normalized = clean.replace(',', '.');
  } else if (commas + dots > 1) {
    normalized = clean.replace(/[.,]/g, '');
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(/\.00$/, '').replace('.', ',');
}

export function todayISO(): string {
  const d = new Date();
  return toISODate(d);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function currentMonth(): string {
  return todayISO().slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function dayLabel(iso: string): string {
  const today = todayISO();
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (iso === today) return 'Hoy';
  if (iso === toISODate(y)) return 'Ayer';
  const [yy, mm, dd] = iso.split('-').map(Number);
  const d = new Date(yy, mm - 1, dd);
  const s = d.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function shortDate(iso: string): string {
  const [yy, mm, dd] = iso.split('-').map(Number);
  return new Date(yy, mm - 1, dd).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' });
}

export function haptic(pattern: number | number[] = 12) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* iOS no soporta vibrate: se ignora */
  }
}

export function normalizePlace(p: string): string {
  return p.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

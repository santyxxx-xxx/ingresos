import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, txInMonth } from './db';
import type { Category, Transaction } from './types';

export const UNCATEGORIZED = { name: 'Sin categoría', emoji: '❔' };

export function useCategories() {
  const list = useLiveQuery(() => db.categories.orderBy('order').toArray(), []);
  const map = useMemo(() => {
    const m = new Map<string, Category>();
    (list ?? []).forEach((c) => m.set(c.id, c));
    return m;
  }, [list]);
  return { list: list ?? [], map, loading: list === undefined };
}

export function catInfo(map: Map<string, Category>, id: string | null) {
  const c = id ? map.get(id) : undefined;
  return c ? { name: c.name, emoji: c.emoji } : UNCATEGORIZED;
}

export function useMonthTx(month: string): Transaction[] | undefined {
  return useLiveQuery(() => txInMonth(month), [month]);
}

export type ThemePref = 'light' | 'dark' | 'system';

function applyTheme(pref: ThemePref) {
  const dark =
    pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0E0F0E' : '#EFE7DA');
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(() => {
    try {
      return (localStorage.getItem('theme') as ThemePref) || 'system';
    } catch {
      return 'system';
    }
  });

  useEffect(() => {
    applyTheme(pref);
    try {
      localStorage.setItem('theme', pref);
    } catch {
      /* noop */
    }
    if (pref !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const fn = () => applyTheme('system');
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, [pref]);

  return [pref, setPref] as const;
}

import { useEffect, useState } from 'react';

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

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { getMeta, resetLocal } from './db';
import { claimLocal, pendingCount, syncOnce } from './sync';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

interface AccountCtx {
  enabled: boolean;
  ready: boolean;
  session: Session | null;
  email: string | null;
  status: SyncStatus;
  lastSync: number | null;
  pending: number;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  /** 'session' = ya entró; 'confirm' = debe confirmar el correo primero */
  signUp: (email: string, password: string) => Promise<'session' | 'confirm'>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
}

const Ctx = createContext<AccountCtx | null>(null);

export function useAccount() {
  const c = useContext(Ctx);
  if (!c) throw new Error('AccountProvider missing');
  return c;
}

export function friendlyAuthError(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  if (/invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos.';
  if (/already registered|already exists/i.test(msg)) return 'Ese correo ya tiene una cuenta. Entra con tu contraseña.';
  if (/email not confirmed/i.test(msg)) return 'Primero confirma tu correo con el enlace que te llegó.';
  if (/password should be at least|weak password/i.test(msg)) return 'La contraseña debe tener al menos 6 caracteres.';
  if (/rate limit|too many|security purposes/i.test(msg)) return 'Demasiados intentos. Espera un momento y vuelve a probar.';
  if (/invalid.*email|unable to validate email/i.test(msg)) return 'Ese correo no es válido.';
  if (/fetch|network/i.test(msg)) return 'Sin conexión. Necesitas internet para entrar.';
  return msg;
}

const SYNC_DEBOUNCE = 1500;
const SYNC_INTERVAL = 60_000;

export function AccountProvider({ children }: { children: ReactNode }) {
  const enabled = !!supabase;
  const [ready, setReady] = useState(!enabled);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<string | null>(null);
  const running = useRef(false);
  const again = useRef(false);
  const uid = session?.user.id ?? null;

  const pending = useLiveQuery(pendingCount, []) ?? 0;

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const sync = useCallback(async () => {
    if (!uid || claimed !== uid) return;
    if (running.current) {
      again.current = true;
      return;
    }
    if (!navigator.onLine) {
      setStatus('offline');
      return;
    }
    running.current = true;
    setStatus('syncing');
    try {
      do {
        again.current = false;
        await syncOnce(uid);
      } while (again.current);
      setLastSync(Date.now());
      setStatus('synced');
      setError(null);
    } catch (e) {
      setStatus(navigator.onLine ? 'error' : 'offline');
      setError(friendlyAuthError(e));
    } finally {
      running.current = false;
    }
  }, [uid, claimed]);

  // Al entrar: asociar los datos de este dispositivo a la cuenta
  useEffect(() => {
    if (!uid) {
      setClaimed(null);
      setLastSync(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const ok = await claimLocal(uid);
      if (!ok) {
        await resetLocal();
        await claimLocal(uid);
      }
      const ls = await getMeta(`lastSync:${uid}`);
      if (cancelled) return;
      setLastSync(ls ? Number(ls) : null);
      setClaimed(uid);
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  // Primera sincronización al entrar / abrir la app
  useEffect(() => {
    if (claimed && claimed === uid) sync();
  }, [claimed, uid, sync]);

  // Cambios locales → subir en un momento
  useEffect(() => {
    if (!pending || claimed !== uid || !uid) return;
    const t = window.setTimeout(sync, SYNC_DEBOUNCE);
    return () => clearTimeout(t);
  }, [pending, claimed, uid, sync]);

  // Al volver el internet, al volver a la app y cada minuto: traer cambios de otros dispositivos
  useEffect(() => {
    if (!uid) return;
    const onVisible = () => document.visibilityState === 'visible' && sync();
    window.addEventListener('online', sync);
    document.addEventListener('visibilitychange', onVisible);
    const iv = window.setInterval(() => document.visibilityState === 'visible' && sync(), SYNC_INTERVAL);
    return () => {
      window.removeEventListener('online', sync);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(iv);
    };
  }, [uid, sync]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return;
    const { error: e } = await supabase.auth.signInWithPassword({ email, password });
    if (e) throw new Error(friendlyAuthError(e));
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) return 'confirm' as const;
    const { data, error: e } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin }
    });
    if (e) throw new Error(friendlyAuthError(e));
    // Supabase devuelve un usuario sin identidades si el correo ya existía
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error('Ese correo ya tiene una cuenta. Entra con tu contraseña.');
    }
    return data.session ? ('session' as const) : ('confirm' as const);
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    // Intenta subir lo pendiente antes de salir
    if (uid && navigator.onLine) {
      try {
        await syncOnce(uid);
      } catch {
        /* se avisa antes en la interfaz */
      }
    }
    await supabase.auth.signOut();
    await resetLocal();
    setStatus('idle');
    setError(null);
  }, [uid]);

  return (
    <Ctx.Provider
      value={{
        enabled,
        ready,
        session,
        email: session?.user.email ?? null,
        status,
        lastSync,
        pending,
        error,
        signIn,
        signUp,
        signOut,
        syncNow: sync
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function timeAgo(ms: number): string {
  const diff = (Date.now() - ms) / 1000;
  if (diff < 45) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.round(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.round(diff / 3600)} h`;
  return new Date(ms).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' });
}

/** Ignora la pantalla de bienvenida si el usuario eligió seguir sin cuenta */
export function useSkipLogin() {
  const [skip, setSkip] = useState(() => {
    try {
      return localStorage.getItem('skip-login') === '1';
    } catch {
      return false;
    }
  });
  const set = (v: boolean) => {
    try {
      if (v) localStorage.setItem('skip-login', '1');
      else localStorage.removeItem('skip-login');
    } catch {
      /* noop */
    }
    setSkip(v);
  };
  return [skip, set] as const;
}


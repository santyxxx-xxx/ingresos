import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { db } from './db';
import { buildBackup, restoreBackup, validateBackup } from './backup';

export interface RemoteInfo {
  updatedAt: string;
  txCount: number;
  catCount: number;
  device: string | null;
}

export type CloudStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'error';

interface CloudCtx {
  enabled: boolean;
  ready: boolean;
  session: Session | null;
  email: string | null;
  info: RemoteInfo | null | undefined; // undefined = cargando, null = sin respaldo
  /** Este dispositivo ya respaldó o restauró con esta cuenta → respaldo automático activo */
  linked: boolean;
  status: CloudStatus;
  error: string | null;
  sendCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  backupNow: () => Promise<void>;
  restoreFromCloud: () => Promise<number>;
  refreshInfo: () => Promise<void>;
}

const Ctx = createContext<CloudCtx | null>(null);

export function useCloud() {
  const c = useContext(Ctx);
  if (!c) throw new Error('CloudProvider missing');
  return c;
}

const linkKey = (uid: string) => `cloud-linked:${uid}`;
const AUTO_DELAY = 4000;

function deviceName() {
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android';
  if (/Mac/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows';
  return 'Navegador';
}

function friendlyError(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  if (/rate limit|too many|security purposes/i.test(msg)) return 'Demasiados intentos. Espera un momento y vuelve a probar.';
  if (/expired|invalid/i.test(msg) && /token|otp|code/i.test(msg)) return 'El código no es válido o ya venció. Pide uno nuevo.';
  if (/fetch|network|Failed to fetch/i.test(msg)) return 'Sin conexión. Inténtalo cuando tengas internet.';
  if (/relation .*backups.* does not exist|schema cache/i.test(msg)) return 'La nube aún no está configurada (falta la tabla de respaldos).';
  return msg;
}

export function CloudProvider({ children }: { children: ReactNode }) {
  const enabled = !!supabase;
  const [ready, setReady] = useState(!enabled);
  const [session, setSession] = useState<Session | null>(null);
  const [info, setInfo] = useState<RemoteInfo | null | undefined>(undefined);
  const [linked, setLinked] = useState(false);
  const [status, setStatus] = useState<CloudStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const uid = session?.user.id ?? null;

  // Sesión
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!uid) {
      setLinked(false);
      setInfo(undefined);
      return;
    }
    try {
      setLinked(localStorage.getItem(linkKey(uid)) === '1');
    } catch {
      setLinked(false);
    }
  }, [uid]);

  const markLinked = useCallback(() => {
    if (!uid) return;
    try {
      localStorage.setItem(linkKey(uid), '1');
    } catch {
      /* noop */
    }
    setLinked(true);
  }, [uid]);

  const refreshInfo = useCallback(async () => {
    if (!supabase || !uid) return;
    const { data, error: e } = await supabase
      .from('backups')
      .select('updated_at, tx_count, cat_count, device')
      .eq('user_id', uid)
      .maybeSingle();
    if (e) {
      setError(friendlyError(e));
      return;
    }
    setInfo(
      data
        ? { updatedAt: data.updated_at, txCount: data.tx_count, catCount: data.cat_count, device: data.device }
        : null
    );
  }, [uid]);

  useEffect(() => {
    if (uid) refreshInfo();
  }, [uid, refreshInfo]);

  const upload = useCallback(async () => {
    if (!supabase || !uid) return;
    if (!navigator.onLine) {
      pending.current = true;
      setStatus('offline');
      return;
    }
    setStatus('saving');
    try {
      const b = await buildBackup();
      const now = new Date().toISOString();
      const { error: e } = await supabase.from('backups').upsert(
        {
          user_id: uid,
          data: b,
          tx_count: b.transactions.length,
          cat_count: b.categories.length,
          device: deviceName(),
          updated_at: now
        },
        { onConflict: 'user_id' }
      );
      if (e) throw e;
      pending.current = false;
      setInfo({ updatedAt: now, txCount: b.transactions.length, catCount: b.categories.length, device: deviceName() });
      setStatus('saved');
      setError(null);
    } catch (e) {
      pending.current = true;
      setStatus('error');
      setError(friendlyError(e));
    }
  }, [uid]);

  // Respaldo automático: cualquier cambio en los datos dispara una subida (con espera)
  const snapshot = useLiveQuery(
    () => (linked ? Promise.all([db.transactions.count(), db.categories.toArray(), db.transactions.toArray()]) : null),
    [linked]
  );
  const skipFirst = useRef(true);
  useEffect(() => {
    skipFirst.current = true;
  }, [linked]);
  useEffect(() => {
    if (!linked || !snapshot) return;
    // la primera lectura al abrir la app no es un cambio: no se sube
    if (skipFirst.current) {
      skipFirst.current = false;
      if (!pending.current) return;
    }
    clearTimeout(timer.current);
    timer.current = window.setTimeout(upload, AUTO_DELAY);
    return () => clearTimeout(timer.current);
  }, [snapshot, linked, upload]);

  // Reintenta al recuperar conexión
  useEffect(() => {
    const on = () => {
      if (pending.current && linked) upload();
    };
    window.addEventListener('online', on);
    return () => window.removeEventListener('online', on);
  }, [linked, upload]);

  const sendCode = useCallback(async (email: string) => {
    if (!supabase) return;
    setError(null);
    const { error: e } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (e) throw new Error(friendlyError(e));
  }, []);

  const verifyCode = useCallback(async (email: string, code: string) => {
    if (!supabase) return;
    setError(null);
    const { error: e } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
    if (e) throw new Error(friendlyError(e));
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    clearTimeout(timer.current);
    await supabase.auth.signOut();
    setStatus('idle');
    setError(null);
  }, []);

  const backupNow = useCallback(async () => {
    await upload();
    markLinked();
  }, [upload, markLinked]);

  const restoreFromCloud = useCallback(async () => {
    if (!supabase || !uid) throw new Error('Inicia sesión primero.');
    const { data, error: e } = await supabase.from('backups').select('data').eq('user_id', uid).maybeSingle();
    if (e) throw new Error(friendlyError(e));
    if (!data) throw new Error('No hay un respaldo en la nube para esta cuenta.');
    const b = validateBackup(data.data);
    await restoreBackup(b);
    markLinked();
    setStatus('saved');
    return b.transactions.length;
  }, [uid, markLinked]);

  return (
    <Ctx.Provider
      value={{
        enabled,
        ready,
        session,
        email: session?.user.email ?? null,
        info,
        linked,
        status,
        error,
        sendCode,
        verifyCode,
        signOut,
        backupNow,
        restoreFromCloud,
        refreshInfo
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 45) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.round(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.round(diff / 3600)} h`;
  const d = new Date(iso);
  return d.toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' });
}

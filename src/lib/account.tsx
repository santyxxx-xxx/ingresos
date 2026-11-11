import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { friendlyError, supabase } from './supabase';

interface AccountCtx {
  ready: boolean;
  session: Session | null;
  email: string | null;
  /** Nombre para el saludo (guardado en la cuenta o tomado de Google) */
  name: string | null;
  setName: (name: string) => Promise<void>;
  /** true si hay que mostrar el tutorial automáticamente (cuentas nuevas que no lo han visto) */
  showTutorialOnStart: boolean;
  markTutorialSeen: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  /** 'session' = ya entró; 'confirm' = debe confirmar el correo primero */
  signUp: (email: string, password: string) => Promise<'session' | 'confirm'>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AccountCtx | null>(null);

/** Fecha desde la que las cuentas nuevas ven el tutorial al entrar */
const TUTORIAL_SINCE = '2026-11-11T15:50:00';

export function useAccount() {
  const c = useContext(Ctx);
  if (!c) throw new Error('AccountProvider missing');
  return c;
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(friendlyError(error));
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin }
    });
    if (error) throw new Error(friendlyError(error));
    // Supabase devuelve un usuario sin identidades si el correo ya existía
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error('Ese correo ya tiene una cuenta. Entra con tu contraseña.');
    }
    return data.session ? ('session' as const) : ('confirm' as const);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) throw new Error(friendlyError(error));
  }, []);

  const setName = useCallback(async (name: string) => {
    const { data, error } = await supabase.auth.updateUser({ data: { name } });
    if (error) throw new Error(friendlyError(error));
    if (data.user) setSession((s) => (s ? { ...s, user: data.user! } : s));
  }, []);

  const meta = (session?.user.user_metadata ?? {}) as Record<string, unknown>;
  const rawName =
    (typeof meta.name === 'string' && meta.name) ||
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.given_name === 'string' && meta.given_name) ||
    '';
  const name = rawName.trim() ? rawName.trim().split(/\s+/)[0] : null;

  // El tutorial se muestra solo a cuentas creadas desde que existe (las anteriores ya conocen la app)
  // y que aún no lo vieron. Se guarda en la propia cuenta, así no vuelve a salir en otro dispositivo.
  const createdAt = session?.user.created_at ?? '';
  const showTutorialOnStart = !!session && createdAt >= TUTORIAL_SINCE && meta.tutorial_seen !== true;

  const markTutorialSeen = useCallback(async () => {
    const { data, error } = await supabase.auth.updateUser({ data: { tutorial_seen: true } });
    if (!error && data.user) setSession((s) => (s ? { ...s, user: data.user! } : s));
  }, []);

  return (
    <Ctx.Provider
      value={{
        ready,
        session,
        email: session?.user.email ?? null,
        name,
        setName,
        showTutorialOnStart,
        markTutorialSeen,
        signInWithGoogle,
        signIn,
        signUp,
        signOut
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

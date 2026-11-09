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
  signInWithGoogle: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  /** 'session' = ya entró; 'confirm' = debe confirmar el correo primero */
  signUp: (email: string, password: string) => Promise<'session' | 'confirm'>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AccountCtx | null>(null);

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

  return (
    <Ctx.Provider
      value={{ ready, session, email: session?.user.email ?? null, name, setName, signInWithGoogle, signIn, signUp, signOut }}
    >
      {children}
    </Ctx.Provider>
  );
}

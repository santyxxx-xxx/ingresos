import { createClient } from '@supabase/supabase-js';

// Variables de entorno (Vercel → Settings → Environment Variables):
//   VITE_SUPABASE_URL       URL del proyecto
//   VITE_SUPABASE_ANON_KEY  clave publicable (pública por diseño; el acceso lo controla RLS)
const url = import.meta.env.VITE_SUPABASE_URL || 'https://qebcqxfkwbxvezdqffwq.supabase.co';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_0pfOccP65EROb48MdMe9cA_gjmPoTqt';

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

export function friendlyError(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  if (/invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos.';
  if (/already registered|already exists/i.test(msg)) return 'Ese correo ya tiene una cuenta. Entra con tu contraseña.';
  if (/email not confirmed/i.test(msg)) return 'Primero confirma tu correo con el enlace que te llegó.';
  if (/password should be at least|weak password/i.test(msg)) return 'La contraseña debe tener al menos 6 caracteres.';
  if (/rate limit|too many|security purposes/i.test(msg)) return 'Demasiados intentos. Espera un momento y vuelve a probar.';
  if (/invalid.*email|unable to validate email/i.test(msg)) return 'Ese correo no es válido.';
  if (/failed to fetch|network|load failed/i.test(msg)) return 'Sin conexión a internet. Revisa tu conexión e inténtalo de nuevo.';
  if (/JWT|session/i.test(msg)) return 'Tu sesión venció. Vuelve a entrar.';
  return msg;
}

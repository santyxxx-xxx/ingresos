import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// La clave publicable es segura en el navegador: el acceso real lo controlan las
// políticas RLS de la tabla `backups` (cada usuario solo ve su propia fila).
const url = import.meta.env.VITE_SUPABASE_URL || 'https://qebcqxfkwbxvezdqffwq.supabase.co';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_0pfOccP65EROb48MdMe9cA_gjmPoTqt';

export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;

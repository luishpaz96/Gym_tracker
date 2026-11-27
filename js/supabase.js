// Cliente de Supabase (librería UMD cargada por CDN con SRI en index.html).
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

let client = null;
export function getClient() {
  if (client) return client;
  if (!window.supabase?.createClient) throw new Error('No se pudo cargar la librería de Supabase (¿sin conexión?).');
  client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  });
  return client;
}

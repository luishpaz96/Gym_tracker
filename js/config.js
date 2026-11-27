// Configuración pública. La anon key es pública por diseño: la seguridad la da RLS (ver supabase/schema.sql).
// Pega aquí los valores de tu proyecto (Supabase → Project Settings → API). NUNCA pongas la service_role key.
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';

// Se activa al conectar un proveedor SMS (Twilio) en Supabase → Authentication → Providers → Phone.
export const PHONE_AUTH_ENABLED = false;

export const MIN_PASSWORD = 10;
export const APP_URL = 'https://luishpaz96.github.io/gym_tracker/';

export const isConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

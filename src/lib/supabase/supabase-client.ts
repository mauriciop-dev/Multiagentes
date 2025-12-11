import { createClient } from '@supabase/supabase-js';

// Intentar leer variables inyectadas por Vite (definidas en vite.config.ts)
// Se soportan tanto prefijos NEXT_PUBLIC_ como VITE_
const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// Valores por defecto para evitar crashes si no hay env vars, permitiendo cargar la UI de configuración
const DEFAULT_URL = 'https://placeholder.supabase.co';
const DEFAULT_KEY = 'placeholder';

// Cliente principal (singleton)
export const supabase = createClient(
  envUrl || DEFAULT_URL,
  envKey || DEFAULT_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);

// Helper para crear clientes dinámicos cuando el usuario ingresa credenciales manualmente
export const createManualClient = (url: string, key: string) => {
  let cleanUrl = url.trim();
  if (!cleanUrl.startsWith('http')) {
    cleanUrl = `https://${cleanUrl}`;
  }
  cleanUrl = cleanUrl.replace(/\/$/, '');
  
  return createClient(cleanUrl, key.trim());
};

export const isConfigured = !!(envUrl && envKey && !envUrl.includes('placeholder'));
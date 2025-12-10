import { createClient } from '@supabase/supabase-js';

// Lectura estricta de variables de entorno con prefijo NEXT_PUBLIC para el cliente
const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Bandera para saber si el entorno está configurado correctamente desde el despliegue
export const isEnvConfigured = !!(envUrl && envKey && !envUrl.includes('placeholder'));

// Cliente por defecto:
// Si hay variables, usa las reales.
// Si NO hay variables, usa un placeholder temporal para no romper el build, 
// pero la UI lo detectará con `isEnvConfigured` y pedirá datos manuales.
export const supabase = createClient(
  envUrl || 'https://placeholder.supabase.co',
  envKey || 'placeholder'
);

// Helper para crear un cliente manualmente (cuando el usuario mete datos en la UI)
export const createManualClient = (url: string, key: string) => {
  let cleanUrl = url.trim();
  if (!cleanUrl.startsWith('http')) {
    cleanUrl = `https://${cleanUrl}`;
  }
  cleanUrl = cleanUrl.replace(/\/$/, '');
  
  return createClient(cleanUrl, key.trim(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
};
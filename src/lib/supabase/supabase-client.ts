import { createClient } from '@supabase/supabase-js';

// Cliente placeholder seguro
// Este cliente se usa solo para inicializar tipos y evitar errores de build.
// El cliente REAL se crea dinámicamente en page.tsx o actions.ts usando las variables del servidor.
export const supabase = createClient(
  'https://placeholder.supabase.co',
  'placeholder',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);

export const createManualClient = (url: string, key: string) => {
  let cleanUrl = url.trim();
  if (!cleanUrl.startsWith('http')) {
    cleanUrl = `https://${cleanUrl}`;
  }
  cleanUrl = cleanUrl.replace(/\/$/, '');
  
  return createClient(cleanUrl, key.trim(), {
    auth: {
      persistSession: true, // Permitir persistencia cuando se inyecta desde el server
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  });
};

export const isEnvConfigured = false; // Deprecated, logic moved to page.tsx
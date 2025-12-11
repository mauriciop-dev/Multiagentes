import { createClient } from '@supabase/supabase-js';

// Intentar leer variables inyectadas por Vite
const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// DIAGNÓSTICO EN CONSOLA (Para desarrollo)
if (!envUrl || !envKey) {
  console.error("🚨 ERROR CRÍTICO: Faltan variables de entorno de Supabase.");
  console.error("URL definida:", !!envUrl);
  console.error("KEY definida:", !!envKey);
}

// Configuración estricta: Si no hay variables, usamos strings vacíos o inválidos
// para que el intento de conexión falle con un error real (ej. "Invalid URL" o "Connection Refused")
// en lugar de conectarse a un proyecto de prueba 'placeholder'.
// No lanzamos error aquí para evitar pantalla blanca (crash) al cargar el módulo,
// permitiendo que el componente UI capture y muestre el error.

export const supabase = createClient(
  envUrl || 'https://invalid-config-missing-url.com',
  envKey || 'invalid-config-missing-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);
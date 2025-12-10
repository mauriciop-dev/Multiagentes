import { createClient } from '@supabase/supabase-js';

// CRÍTICO PARA NEXT.JS:
// Las variables NEXT_PUBLIC_ deben accederse explícitamente con process.env.NOMBRE
// para que el bundler las reemplace en tiempo de construcción.
// No usar funciones intermedias (como getEnv) para estas variables.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Advertencia en consola si faltan (ayuda a depurar en local y Vercel)
if (!supabaseUrl || !supabaseKey) {
  console.warn(
    '⚠️ Variables de Supabase no detectadas. \n' +
    'Asegúrate de que NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY estén configuradas en Vercel o .env.local'
  );
}

// Cliente robusto con fallback para evitar crash inicial
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-key'
);

export { supabaseUrl, supabaseKey };
import { createClient } from '@supabase/supabase-js';

// En Next.js App Router, las variables NEXT_PUBLIC_ se reemplazan en tiempo de build.
// No uses funciones complejas para leerlas o el bundler puede fallar en detectarlas.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Verificación para depuración en consola del navegador
if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Supabase Keys faltantes. Asegúrate de hacer REDEPLOY en Vercel después de agregar las variables.');
}

// Usamos un fallback vacío para que el build no rompa, pero la app validará en runtime (page.tsx)
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-key'
);

export { supabaseUrl, supabaseKey };
import { createClient } from '@supabase/supabase-js';

// En Next.js, las variables deben accederse DIRECTAMENTE como process.env.NEXT_PUBLIC_VARIABLE
// para que el compilador las reemplace por su valor real en el navegador.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Verificación básica para evitar crash si faltan, pero usará placeholder
const finalUrl = supabaseUrl || 'https://placeholder.supabase.co';
const finalKey = supabaseKey || 'placeholder-key';

export const supabase = createClient(finalUrl, finalKey);

// Exportamos las vars para verificarlas en la UI si es necesario
export { finalUrl as supabaseUrl, finalKey as supabaseKey };
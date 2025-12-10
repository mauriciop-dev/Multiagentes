import { createClient } from '@supabase/supabase-js';

// Obtenemos las variables y limpiamos espacios en blanco accidentales (común al copiar/pegar)
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

// Usamos valores placeholder solo si las variables están totalmente vacías para evitar errores de compilación,
// pero esto causará errores de conexión en tiempo de ejecución si no se configuran.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-key'
);

// No exportamos las variables individuales para forzar el uso del cliente `supabase`

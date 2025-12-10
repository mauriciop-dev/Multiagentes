import { createClient } from '@supabase/supabase-js';

// Access environment variables explicitly. 
// In Next.js, process.env.NEXT_PUBLIC_VAR is replaced by the string value at build time.
// We treat process.env as the primary source, with a fallback for Vite/other environments if needed.

const getSupabaseUrl = () => {
  // @ts-ignore
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) {
    return process.env.NEXT_PUBLIC_SUPABASE_URL;
  }
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env?.NEXT_PUBLIC_SUPABASE_URL) {
    // @ts-ignore
    return import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
  }
  return '';
};

const getSupabaseKey = () => {
  // @ts-ignore
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  }
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    // @ts-ignore
    return import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  }
  return '';
};

export const supabaseUrl = getSupabaseUrl();
export const supabaseKey = getSupabaseKey();

// Fallback to placeholder to prevent crash during initialization if keys are missing,
// but the app logic will catch the empty URL later.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-key'
);
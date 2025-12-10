import { createClient } from '@supabase/supabase-js';

// Access environment variables explicitly so Next.js/Vite bundlers can replace them statically.
// Dynamic access (process.env[key]) fails in many bundlers for browser builds.

const getUrl = () => {
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

const getAnonKey = () => {
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

const supabaseUrl = getUrl() || 'https://placeholder.supabase.co';
const supabaseKey = getAnonKey() || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseKey);
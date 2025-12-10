import { createClient } from '@supabase/supabase-js';

// Helper to safely access process.env in various environments (Vite, Next, Browser)
const getEnv = (key: string) => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  // @ts-ignore - Handle import.meta.env for Vite-like environments if needed
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-ignore
    return import.meta.env[key];
  }
  return '';
};

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL') || 'https://placeholder.supabase.co';
const supabaseKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseKey);
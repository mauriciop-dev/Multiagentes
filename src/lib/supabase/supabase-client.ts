import { createClient } from '@supabase/supabase-js';

// Helper function to safely get environment variables in various environments (Vite, Next.js, Standard)
const getEnvVar = (key: string): string | undefined => {
  // Check process.env (Next.js / Node)
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  // Check import.meta.env (Vite)
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    // @ts-ignore
    return import.meta.env[key];
  }
  return undefined;
};

// Export these so other components can check them without re-implementing logic
export const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL') || 'https://placeholder.supabase.co';
export const supabaseKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY') || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseKey);
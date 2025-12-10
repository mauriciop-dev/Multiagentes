import { createClient } from '@supabase/supabase-js';

// Safe environment variable access for hybrid environments (Browser/Server)
const getEnv = (key: string) => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return '';
};

// In Next.js, use NEXT_PUBLIC_ prefix for client-side variables
const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

// Console warning for debugging in Vercel logs or Browser Console
if (!supabaseUrl || !supabaseKey) {
  console.warn(
    '⚠️ Supabase Environment Variables missing. Check your Vercel Project Settings.\n' +
    'Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY'
  );
}

// Create client with fallback to prevent immediate crash, validated in page.tsx
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-key'
);

export { supabaseUrl, supabaseKey };
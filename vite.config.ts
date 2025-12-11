import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carga todas las variables de entorno, incluyendo las que no tienen prefijo VITE_
  // El tercer argumento '' le dice a Vite que no filtre por prefijo.
  // Using '.' instead of process.cwd() to avoid typing issues with 'Process'
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react()],
    define: {
      // SOLUCIÓN: Inyección explícita de variables para compatibilidad con código que usa process.env
      
      // 1. Claves de Google Gemini
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.GEMINI_API_KEY || env.GOOGLE_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.API_KEY),
      
      // 2. Claves de Supabase (CRÍTICO: Inyectar las variables NEXT_PUBLIC_)
      'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(env.NEXT_PUBLIC_SUPABASE_URL),
      'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      
      // 3. Fallbacks para asegurar que la lógica de "Servidor" (actions.ts ejecutándose en cliente)
      //    encuentre las variables incluso si busca las versiones sin prefijo.
      'process.env.SUPABASE_URL': JSON.stringify(env.NEXT_PUBLIC_SUPABASE_URL),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      'process.env.SUPABASE_SERVICE_ROLE_KEY': JSON.stringify(env.SUPABASE_SERVICE_ROLE_KEY || ''), // Cuidado: Esto expondrá la service key al cliente si está definida en .env local.
    },
    server: {
      port: 3000
    }
  };
});
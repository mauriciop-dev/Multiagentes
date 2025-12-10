import { createClient } from '@supabase/supabase-js';

// Intentamos leer las variables de entorno
const envUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const envKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

// Creamos el cliente por defecto. 
// Si las variables están vacías, usamos placeholders para evitar crash inmediato al importar,
// pero las llamadas fallarán si no se configuran.
export const supabase = createClient(
  envUrl || 'https://placeholder.supabase.co',
  envKey || 'placeholder'
);

// Helper para crear un cliente manualmente (para el modo de depuración en UI)
export const createManualClient = (url: string, key: string) => {
  let cleanUrl = url.trim();
  // Asegurar protocolo https
  if (!cleanUrl.startsWith('http')) {
    cleanUrl = `https://${cleanUrl}`;
  }
  // Quitar slash final si existe
  cleanUrl = cleanUrl.replace(/\/$/, '');
  
  return createClient(cleanUrl, key.trim());
};
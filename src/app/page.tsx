'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/supabase-client';
import ChatUI from '../components/ChatUI';
import { SessionData } from '../lib/types';

export default function Page() {
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorDetails, setErrorDetails] = useState<{message: string, hint?: string} | null>(null);

  useEffect(() => {
    const initSession = async () => {
      setLoading(true);
      setErrorDetails(null);
      
      try {
        // 0. Validación preliminar de entorno (Client-side check)
        // Aunque Supabase client ya se inicializó, verificamos si 'process.env' inyectó algo útil.
        // Nota: Al estar compilado, no podemos ver process.env directamente igual que en Node, 
        // pero si el cliente de supabase falla, es el mejor indicador.

        // 1. Intentar Autenticación Anónima Real
        console.log("Iniciando autenticación anónima con Supabase...");
        const { data: auth, error: authError } = await supabase.auth.signInAnonymously();
        
        if (authError) {
          console.error("Fallo Auth Supabase:", authError);
          throw new Error(`Error de Autenticación: ${authError.message}`);
        }

        const userId = auth.user?.id;
        if (!userId) throw new Error("La autenticación fue exitosa pero no se recibió User ID.");

        console.log("Autenticación exitosa. User ID:", userId);

        // 2. Conexión a Base de Datos Real
        console.log("Creando sesión en DB...");
        const { data: newSession, error: dbError } = await supabase
          .from('sessions')
          .insert({
            user_id: userId,
            chat_history: [],
            current_state: 'WAITING_FOR_INFO',
            research_results: [],
            research_counter: 0
          })
          .select()
          .single();

        if (dbError) {
          console.error("Fallo DB Supabase:", dbError);
          // Pista para errores comunes de RLS o Tablas faltantes
          let hint = "";
          if (dbError.code === "42P01") hint = "La tabla 'sessions' no existe en la base de datos.";
          if (dbError.code === "42501") hint = "Error de permisos (RLS). Verifica las 'Policies' en Supabase.";
          
          throw new Error(`Error de Base de Datos (${dbError.code}): ${dbError.message}. ${hint}`);
        }

        // 3. Éxito total
        setSessionData(newSession as SessionData);

      } catch (e: any) {
        console.error("Error Fatal:", e);
        
        let msg = e.message || "Error desconocido.";
        
        // Detectar si es error de URL inválida (falta de env vars)
        if (msg.includes("Invalid URL") || msg.includes("Failed to parse")) {
          msg = "URL de Supabase inválida o no configurada. Revisa tus variables de entorno.";
        }
        
        setErrorDetails({ message: msg });
      } finally {
        setLoading(false);
      }
    };

    initSession();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mb-6"></div>
        <p className="text-gray-600 font-mono text-sm">Estableciendo conexión segura...</p>
      </div>
    );
  }

  if (errorDetails) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-xl shadow-2xl max-w-2xl w-full border-l-8 border-red-500">
          <div className="flex items-center gap-4 mb-6">
            <span className="text-4xl">🛑</span>
            <h1 className="text-2xl font-bold text-gray-800">Error de Sistema</h1>
          </div>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <h3 className="text-red-800 font-bold text-sm uppercase mb-2">Descripción del Error</h3>
            <p className="font-mono text-red-700 text-sm break-words">
              {errorDetails.message}
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-gray-700 font-bold text-sm uppercase">Pasos para Solucionar:</h3>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-2">
              <li>Verifica que las variables de entorno <code>NEXT_PUBLIC_SUPABASE_URL</code> y <code>ANON_KEY</code> estén configuradas en Vercel/Local.</li>
              <li>Asegúrate de que la tabla <code>sessions</code> exista en Supabase.</li>
              <li>Revisa las políticas RLS (Row Level Security) para permitir insert/select públicos o anónimos.</li>
            </ul>
          </div>

          <button 
            onClick={() => window.location.reload()}
            className="mt-8 w-full bg-gray-800 hover:bg-gray-900 text-white font-bold py-3 px-4 rounded-lg transition-colors"
          >
            Reintentar Conexión
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {sessionData && (
        <ChatUI 
          initialSession={sessionData} 
          supabaseClient={supabase}
        />
      )}
    </main>
  );
}
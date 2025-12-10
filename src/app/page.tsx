'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/supabase-client';
import ChatUI from '../components/ChatUI';
import { SessionData } from '../lib/types';

// Mock Data for UI Preview (Fallback mode)
const DEMO_SESSION: SessionData = {
  id: 'demo-session',
  user_id: 'demo-user',
  chat_history: [
    { role: 'user', content: 'Quiero analizar la estrategia digital de "Constructora Futuro S.A."', timestamp: Date.now() - 100000 },
    { role: 'agent', name: 'Pedro', content: 'Entendido. Iniciando análisis técnico sobre "Constructora Futuro S.A.". Dame un momento para investigar fuentes recientes.', timestamp: Date.now() - 80000 },
    { role: 'agent', name: 'Pedro', content: '[Hallazgo Técnico #1]: Se identifican oportunidades en la implementación de BIM (Building Information Modeling) y sensores IoT para monitoreo de obras en tiempo real.', timestamp: Date.now() - 60000 },
    { role: 'agent', name: 'Juan', content: 'Gracias Pedro. Datos recibidos. Estoy procesando esta información para estructurar el informe ejecutivo.', timestamp: Date.now() - 30000 }
  ],
  company_info: 'Constructora Futuro S.A.',
  research_results: ['BIM implementation opportunities', 'IoT sensors for construction'],
  report_final: '',
  current_state: 'WAITING_FOR_INFO', 
  research_counter: 1
};

export default function Page() {
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const initSession = async () => {
      try {
        console.log("Iniciando conexión a Supabase...");
        
        // Intentamos autenticar directamente. Si las variables faltan, 
        // supabase-js lanzará un error o signInAnonymously fallará, 
        // y capturaremos ESE error real.

        // 1. Autenticación (Usuario existente o Anónimo)
        const { data: authData, error: userError } = await supabase.auth.getUser();
        let userId = authData?.user?.id;

        if (userError) {
            // Ignoramos error de "Auth session missing", es normal si no hay usuario
            console.log("No hay sesión activa, intentando login anónimo...");
        }

        if (!userId) {
          const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
          
          if (anonError) {
            console.error("Error Auth Anónimo:", anonError);
            // Aquí detectamos si el error es por URL/Key inválida
            if (anonError.message.includes('URL') || anonError.status === 0) {
               throw new Error("No se pudo conectar a Supabase. Verifica NEXT_PUBLIC_SUPABASE_URL y ANON_KEY en Vercel.");
            }
            throw anonError;
          }
          userId = anonData.user?.id;
        }

        // 2. Crear o Recuperar Sesión en Base de Datos
        if (userId) {
          console.log("Usuario autenticado:", userId);
          
          // Insertamos una nueva sesión
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
            console.error("Error DB Insert:", dbError);
            let msg = `Error BD: ${dbError.message}`;
            
            // Mensajes de ayuda específicos para errores comunes
            if (dbError.code === '42P01') msg = "Falta la tabla 'sessions' en Supabase. Ejecuta el script SQL en el Editor SQL.";
            if (dbError.code === '42501') msg = "Error de permisos (RLS). Ejecuta el script SQL para habilitar políticas públicas/anónimas.";
            
            throw new Error(msg);
          } else {
            setSessionData(newSession as SessionData);
          }
        }
      } catch (error: any) {
        console.error("Fallo crítico:", error);
        setErrorMessage(error.message || "Error desconocido al iniciar sesión.");
        setSessionData(DEMO_SESSION);
        setIsDemo(true);
      } finally {
        setLoading(false);
      }
    };

    initSession();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-cyan-800 font-semibold animate-pulse">Conectando servicios...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4 font-sans text-gray-900 relative">
      {isDemo && (
        <div className="absolute top-0 left-0 w-full bg-red-900 text-white shadow-md z-50">
          <div className="max-w-4xl mx-auto p-4 flex flex-col sm:flex-row items-start gap-4">
            <div className="text-3xl">⚠️</div>
            <div className="flex-1">
              <strong className="block text-red-200 text-lg mb-1">Error de Conexión (Modo Demo Activo)</strong>
              <p className="opacity-90 font-mono text-sm bg-red-950/50 p-2 rounded border border-red-700">{errorMessage}</p>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="mt-2 sm:mt-0 bg-red-700 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg shadow transition-colors text-sm whitespace-nowrap"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}
      <div className={isDemo ? "mt-32 sm:mt-24 transition-all" : ""}>
        {sessionData && <ChatUI initialSession={sessionData} />}
      </div>
    </main>
  );
}
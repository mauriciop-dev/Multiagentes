'use client';

import React, { useEffect, useState } from 'react';
import { supabase, supabaseUrl, supabaseKey } from '../lib/supabase/supabase-client';
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
        
        // 1. Verificación de Variables con mensaje claro para Vercel
        if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder')) {
           console.warn("Variables de Supabase no detectadas.");
           setErrorMessage("Faltan variables de entorno en Vercel.");
           // No lanzamos error fatal, activamos modo demo para que la UI cargue
           setIsDemo(true);
           setSessionData(DEMO_SESSION);
           setLoading(false);
           return;
        }

        // 2. Autenticación Anónima
        const { data: authData } = await supabase.auth.getUser();
        let userId = authData?.user?.id;

        if (!userId) {
          console.log("Usuario no detectado, intentando login anónimo...");
          const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
          
          if (anonError) {
            console.error("Error Auth Anónimo:", anonError);
            // Fallback a demo si auth falla
            setErrorMessage(`Error Auth: ${anonError.message}. Verifica que 'Anonymous Sign-ins' esté habilitado en Supabase.`);
            setIsDemo(true);
            setSessionData(DEMO_SESSION);
            setLoading(false);
            return;
          }
          userId = anonData.user?.id;
        }

        // 3. Crear o Recuperar Sesión en Base de Datos
        if (userId) {
          console.log("Creando sesión para usuario:", userId);
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
            if (dbError.code === '42P01') msg = "Tabla 'sessions' no encontrada en Supabase (Corre el script SQL).";
            if (dbError.code === '42501') msg = "Permiso denegado (RLS) en Supabase (Corre el script SQL).";
            
            setErrorMessage(msg);
            setIsDemo(true);
            setSessionData(DEMO_SESSION);
          } else {
            setSessionData(newSession as SessionData);
          }
        }
      } catch (error: any) {
        console.error("Fallo inesperado:", error);
        setErrorMessage(error.message || "Error desconocido");
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
        <p className="text-cyan-800 font-semibold animate-pulse">Conectando con Supabase...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4 font-sans text-gray-900 relative">
      {isDemo && (
        <div className="absolute top-0 left-0 w-full bg-cyan-900 text-white shadow-md z-50">
          <div className="max-w-4xl mx-auto p-4 flex flex-col sm:flex-row items-start gap-4">
            <div className="text-3xl">🚧</div>
            <div className="flex-1">
              <strong className="block text-cyan-200 text-lg mb-1">Modo de Visualización (Sin Conexión)</strong>
              <p className="opacity-90 mb-2">{errorMessage}</p>
              
              <div className="bg-cyan-950/40 p-3 rounded-lg border border-cyan-700/50 text-sm space-y-2">
                <p className="font-semibold text-cyan-300">Solución en Vercel:</p>
                <ol className="list-decimal list-inside text-cyan-100/80 space-y-1 ml-1">
                  <li>Ve a <strong>Settings &gt; Environment Variables</strong></li>
                  <li>Agrega: <code className="bg-cyan-950 px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code></li>
                  <li>Agrega: <code className="bg-cyan-950 px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code></li>
                  <li>Agrega: <code className="bg-cyan-950 px-1 rounded">API_KEY</code> (Google Gemini)</li>
                  <li className="text-white font-bold">Importante: Ve a Deployments y haz REDEPLOY</li>
                </ol>
              </div>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="mt-2 sm:mt-0 bg-cyan-500 hover:bg-cyan-400 text-white font-semibold py-2 px-4 rounded-lg shadow transition-colors text-sm whitespace-nowrap"
            >
              🔄 Recargar Página
            </button>
          </div>
        </div>
      )}
      <div className={isDemo ? "mt-48 sm:mt-40 transition-all" : ""}>
        {sessionData && <ChatUI initialSession={sessionData} />}
      </div>
    </main>
  );
}
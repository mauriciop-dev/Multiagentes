'use client';

import React, { useEffect, useState } from 'react';
import { supabase, supabaseUrl } from '../lib/supabase/supabase-client';
import ChatUI from '../components/ChatUI';
import { SessionData } from '../lib/types';

// Mock Data for UI Preview
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
        // Use the safely exported URL from the client file
        const hasEnvVars = supabaseUrl && !supabaseUrl.includes('placeholder');

        if (!hasEnvVars) {
          throw new Error("Supabase URL no encontrada. Verifica las variables de entorno.");
        }

        // 1. Anonymous Auth
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        let userId = user?.id;

        if (!userId) {
          const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
          if (anonError) throw anonError;
          userId = anonData.user?.id;
        }

        if (!userId) throw new Error("No se pudo autenticar con Supabase.");

        // 2. Check for existing active session or create new
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

        if (dbError) throw dbError;
        
        setSessionData(newSession as SessionData);

      } catch (error: any) {
        console.warn("Entrando en Modo Demo debido a:", error);
        setErrorMessage(error.message || "Error desconocido de conexión");
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
        <p className="text-cyan-800 font-semibold animate-pulse">Inicializando entorno...</p>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-500 bg-white p-6 rounded-xl shadow-lg border border-red-100 max-w-md">
          <h3 className="font-bold text-lg mb-2">Error crítico</h3>
          <p>{errorMessage || "No se pudo cargar la aplicación."}</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4 font-sans text-gray-900 relative">
      {isDemo && (
        <div className="absolute top-0 left-0 w-full bg-yellow-100 text-yellow-800 text-xs py-2 px-4 text-center border-b border-yellow-200 z-50">
          <strong>Modo Vista Previa:</strong> ({errorMessage}) <br/>
          <span className="opacity-80">La base de datos y la IA están simuladas. Configura tus Keys en Vercel/Env para activar el sistema real.</span>
        </div>
      )}
      <div className={isDemo ? "mt-10" : ""}>
        <ChatUI initialSession={sessionData} />
      </div>
    </main>
  );
}
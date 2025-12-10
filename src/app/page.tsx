'use client';

import React, { useEffect, useState } from 'react';
import { supabase, supabaseUrl, supabaseKey } from '../lib/supabase/supabase-client';
import ChatUI from '../components/ChatUI';
import { SessionData } from '../lib/types';

// Mock Data for UI Preview (Solo se usa si fallan las keys)
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
        
        // 1. Verificación Estricta de Variables
        if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder')) {
          throw new Error("Variables de entorno no detectadas. Ve a Vercel -> Deployments -> Redeploy para que los cambios surtan efecto.");
        }

        // 2. Autenticación Anónima
        const { data: authData, error: authError } = await supabase.auth.getUser();
        let userId = authData?.user?.id;

        if (!userId) {
          console.log("Usuario no detectado, intentando login anónimo...");
          const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
          
          if (anonError) {
            console.error("Error Auth Anónimo:", anonError);
            throw new Error(`Error de Autenticación: ${anonError.message}. ¿Habilitaste 'Anonymous Sign-ins' en Supabase Auth?`);
          }
          userId = anonData.user?.id;
        }

        if (!userId) throw new Error("No se pudo obtener un ID de usuario.");

        // 3. Crear Sesión en Base de Datos
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
          if (dbError.code === '42P01') {
             throw new Error("La tabla 'sessions' no existe. Corre el script SQL en Supabase.");
          }
          if (dbError.code === '42501') {
             throw new Error("Permiso denegado (RLS). Corre el script SQL de Políticas en Supabase.");
          }
          throw new Error(`Error BD: ${dbError.message}`);
        }
        
        setSessionData(newSession as SessionData);

      } catch (error: any) {
        console.error("Fallo crítico:", error);
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
        <div className="absolute top-0 left-0 w-full bg-red-100 text-red-900 text-sm py-3 px-4 border-b border-red-200 z-50 shadow-sm">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <div>
                <strong>Modo Demo (Sin Conexión):</strong> {errorMessage}
              </div>
            </div>
          </div>
        </div>
      )}
      <div className={isDemo ? "mt-16" : ""}>
        {sessionData && <ChatUI initialSession={sessionData} />}
      </div>
    </main>
  );
}
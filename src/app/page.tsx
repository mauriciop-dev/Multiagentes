'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/supabase-client';
import ChatUI from '../components/ChatUI';
import { SessionData } from '../lib/types';

export default function Page() {
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initSession = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // 1. Intentar Autenticación Anónima con Supabase
        const { data: auth, error: authError } = await supabase.auth.signInAnonymously();
        
        if (authError) {
          console.error("Error de Autenticación Supabase:", authError);
          throw new Error("No se pudo establecer conexión segura con el servidor.");
        }

        const userId = auth.user?.id;
        if (!userId) throw new Error("Identificador de usuario no recibido.");

        // 2. Crear o recuperar sesión en la Base de Datos
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
          console.error("Error de Base de Datos:", dbError);
          throw new Error("Error al inicializar la sesión de chat.");
        }

        // 3. Éxito: Cargar la interfaz de chat
        setSessionData(newSession as SessionData);

      } catch (e: any) {
        console.error("Error Crítico de Inicialización:", e);
        // En lugar de pedir claves, mostramos un error de sistema
        setError(e.message || "Error desconocido al iniciar el sistema.");
      } finally {
        setLoading(false);
      }
    };

    initSession();
  }, []);

  // -- Renderizado de Estados --

  // 1. Pantalla de Carga
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mb-4"></div>
        <p className="text-gray-500 text-sm font-medium animate-pulse">Conectando con Consultores IA...</p>
      </div>
    );
  }

  // 2. Pantalla de Error (Sin formularios)
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md text-center border border-red-100">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Servicio No Disponible</h2>
          <p className="text-gray-500 text-sm mb-6">
            {error}
          </p>
          <div className="bg-gray-100 p-4 rounded-lg text-xs text-left text-gray-600 font-mono mb-4 overflow-auto max-h-32">
            Posibles causas:<br/>
            - Variables de entorno no configuradas en Vercel.<br/>
            - Problemas de conexión a internet.<br/>
            - Servicio de base de datos pausado.
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="bg-cyan-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-cyan-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // 3. Aplicación Principal
  return (
    <main className="min-h-screen bg-gray-100 font-sans text-gray-900">
      {sessionData && (
        <ChatUI 
          initialSession={sessionData} 
          supabaseClient={supabase}
        />
      )}
    </main>
  );
}
'use client';

import React, { useEffect, useState } from 'react';
import { supabase as defaultSupabase, createManualClient } from '../lib/supabase/supabase-client';
import ChatUI from '../components/ChatUI';
import { SessionData } from '../lib/types';
import { SupabaseClient } from '@supabase/supabase-js';

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
  research_results: [],
  report_final: '',
  current_state: 'WAITING_FOR_INFO', 
  research_counter: 1
};

export default function Page() {
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Para configuración manual
  const [showManualConfig, setShowManualConfig] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [manualGeminiKey, setManualGeminiKey] = useState(''); // Nuevo estado para Gemini Key
  const [activeSupabase, setActiveSupabase] = useState<SupabaseClient>(defaultSupabase);

  const attemptConnection = async (client: SupabaseClient) => {
    try {
      setLoading(true);
      setErrorMessage('');

      // 0. PRE-CHECK
      // @ts-ignore
      const clientUrl = (client as any).supabaseUrl || '';
      if (clientUrl.includes('placeholder.supabase.co') || clientUrl.includes('placeholder')) {
         throw new Error("ENV_MISSING"); 
      }

      // 1. Verificar variables básicas y Conexión
      const { data: authData, error: userError } = await client.auth.getUser();
      let userId = authData?.user?.id;

      if (!userId) {
        const { data: anonData, error: anonError } = await client.auth.signInAnonymously();
        if (anonError) {
          const { error: dbCheckError } = await client.from('sessions').select('count').limit(1);
          if (dbCheckError && dbCheckError.message && dbCheckError.message.includes('Failed to fetch')) {
             throw new Error("NETWORK_ERROR");
          }
          if (!anonData?.user) {
             throw new Error("AUTH_ERROR");
          }
        }
        userId = anonData.user?.id;
      }

      if (userId) {
        // 2. Crear sesión en BD
        const { data: newSession, error: dbError } = await client
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
          throw new Error(`DB_ERROR: ${dbError.message}`);
        } else {
          setActiveSupabase(client);
          setSessionData(newSession as SessionData);
          setIsDemo(false);
          setShowManualConfig(false);
        }
      }
    } catch (error: any) {
      const msg = error.message || '';
      if (msg !== 'ENV_MISSING' && msg !== 'NETWORK_ERROR') {
        console.warn("Conexión automática no disponible:", msg);
      }

      let uiMsg = '';
      if (msg === 'NETWORK_ERROR' || msg.includes('Failed to fetch')) {
        uiMsg = "No se pudo conectar a Supabase. Verifica tu URL.";
      } else if (msg === 'ENV_MISSING') {
        uiMsg = ""; 
      } else if (msg === 'AUTH_ERROR') {
        uiMsg = "Fallo de autenticación. Verifica tus credenciales.";
      } else {
        uiMsg = msg;
      }

      setErrorMessage(uiMsg);
      setIsDemo(true);
      setSessionData(DEMO_SESSION);
      setShowManualConfig(true); 
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    attemptConnection(defaultSupabase);
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUrl || !manualKey) return;
    
    // Sanear inputs
    let cleanUrl = manualUrl.trim();
    if (!cleanUrl.startsWith('http')) cleanUrl = `https://${cleanUrl}`;
    cleanUrl = cleanUrl.replace(/\/$/, '');
    
    const cleanKey = manualKey.trim();
    const cleanGeminiKey = manualGeminiKey.trim();

    setManualUrl(cleanUrl);
    setManualKey(cleanKey);
    setManualGeminiKey(cleanGeminiKey);

    const manualClient = createManualClient(cleanUrl, cleanKey);
    attemptConnection(manualClient);
  };

  if (loading && !sessionData) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-cyan-800 font-semibold animate-pulse">Conectando servicios...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4 font-sans text-gray-900 relative">
      
      {showManualConfig && (
        <div className="absolute top-0 left-0 w-full h-full bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 overflow-y-auto max-h-[90vh]">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Configuración</h2>
            <p className="text-gray-600 text-sm mb-4">
              Ingresa tus credenciales para iniciar.
            </p>
            
            {errorMessage && (
              <div className="bg-red-50 border-l-4 border-red-500 p-3 mb-4 text-xs text-red-700 font-mono break-words">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="pt-2 border-t border-gray-100">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Base de Datos (Supabase)</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Project URL</label>
                    <input 
                      type="text" 
                      value={manualUrl}
                      onChange={(e) => setManualUrl(e.target.value)}
                      placeholder="https://tu-proyecto.supabase.co"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Anon Key (Public)</label>
                    <input 
                      type="password" 
                      value={manualKey}
                      onChange={(e) => setManualKey(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500 outline-none text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Inteligencia Artificial (Google)</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gemini API Key</label>
                  <input 
                    type="password" 
                    value={manualGeminiKey}
                    onChange={(e) => setManualGeminiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500 outline-none text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">Opcional si ya configuraste la variable de entorno, pero necesario si ves errores de Key.</p>
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowManualConfig(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg font-medium transition-colors"
                >
                  Usar Demo
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white py-2 rounded-lg font-medium transition-colors flex justify-center items-center"
                >
                  {loading ? 'Conectando...' : 'Conectar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDemo && !showManualConfig && (
        <button 
          onClick={() => setShowManualConfig(true)}
          className="fixed bottom-4 right-4 bg-gray-800 text-white p-3 rounded-full shadow-lg hover:bg-gray-700 z-40"
          title="Configurar Conexión"
        >
          ⚙️
        </button>
      )}

      {sessionData && (
        <ChatUI 
          initialSession={sessionData} 
          customSupabase={activeSupabase}
          // Pasamos una configuración más robusta que incluye Gemini
          config={{
            supabase: manualUrl && manualKey ? { url: manualUrl, key: manualKey } : undefined,
            geminiApiKey: manualGeminiKey || undefined
          }}
        />
      )}
    </main>
  );
}
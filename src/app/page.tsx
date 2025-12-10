'use client';

import React, { useEffect, useState } from 'react';
import { supabase as defaultSupabase, createManualClient, isEnvConfigured } from '../lib/supabase/supabase-client';
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

// Helper para mostrar claves de forma segura (Masking)
const maskKey = (key?: string) => {
  if (!key) return 'No definida';
  if (key.length < 10) return key; // Si es muy corta (ej. 'placeholder') mostrarla
  return `${key.substring(0, 5)}...${key.substring(key.length - 4)}`;
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
  const [manualGeminiKey, setManualGeminiKey] = useState(''); 
  const [activeSupabase, setActiveSupabase] = useState<SupabaseClient>(defaultSupabase);

  // Intentar conectar con un cliente específico
  const attemptConnection = async (client: SupabaseClient, isManualRetry = false, credentialsToSave?: {url: string, key: string, gemini: string}) => {
    try {
      setLoading(true);
      setErrorMessage('');

      // 1. Verificar variables básicas y Conexión
      const { data: authData, error: userError } = await client.auth.getUser();
      let userId = authData?.user?.id;

      if (!userId) {
        // Intentar login anónimo
        const { data: anonData, error: anonError } = await client.auth.signInAnonymously();
        
        if (anonError) {
          console.error("Error Auth Anónimo:", anonError);
          // Si falla autenticación, verificar si es por red o credenciales
          const msg = anonError.message || '';
          if (msg.includes('Failed to fetch') || msg.includes('network')) {
             throw new Error("NETWORK_ERROR");
          }
          throw new Error("AUTH_ERROR");
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
          // ÉXITO: Conexión establecida
          setActiveSupabase(client);
          setSessionData(newSession as SessionData);
          setIsDemo(false);
          setShowManualConfig(false);

          // Si fue un intento manual exitoso, guardamos en LocalStorage
          if (isManualRetry && credentialsToSave) {
            localStorage.setItem('saved_supabase_url', credentialsToSave.url);
            localStorage.setItem('saved_supabase_key', credentialsToSave.key);
            if (credentialsToSave.gemini) {
              localStorage.setItem('saved_gemini_key', credentialsToSave.gemini);
            }
          }
        }
      }
    } catch (error: any) {
      const msg = error.message || '';
      console.warn("Error de conexión:", msg);
      
      // Si falló la conexión por defecto (Variables de Entorno), intentamos buscar en LocalStorage
      if (!isManualRetry) {
        const savedUrl = localStorage.getItem('saved_supabase_url');
        const savedKey = localStorage.getItem('saved_supabase_key');
        const savedGemini = localStorage.getItem('saved_gemini_key');

        if (savedUrl && savedKey) {
          console.log("Credenciales guardadas encontradas, intentando reconexión automática...");
          setManualUrl(savedUrl);
          setManualKey(savedKey);
          if (savedGemini) setManualGeminiKey(savedGemini);
          
          const savedClient = createManualClient(savedUrl, savedKey);
          return attemptConnection(savedClient, true, { url: savedUrl, key: savedKey, gemini: savedGemini || '' });
        }
      }

      let uiMsg = '';
      if (msg === 'NETWORK_ERROR' || msg.includes('Failed to fetch')) {
        uiMsg = "Error de red: No se pudo conectar a Supabase. Verifica tu URL.";
      } else if (msg === 'AUTH_ERROR') {
        uiMsg = "Error de autenticación: Las credenciales son rechazadas por Supabase.";
      } else if (msg.includes('DB_ERROR')) {
        uiMsg = `Error de base de datos: ${msg.replace('DB_ERROR: ', '')}`;
      } else {
        uiMsg = msg;
      }

      setErrorMessage(uiMsg);
      setIsDemo(true);
      setSessionData(DEMO_SESSION);
      // Siempre mostramos el modal si falla la conexión automática
      setShowManualConfig(true); 
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // LÓGICA PRINCIPAL DE ARRANQUE
    if (isEnvConfigured) {
      console.log("Variables de entorno detectadas. Iniciando conexión automática...");
      attemptConnection(defaultSupabase);
    } else {
      console.log("Variables de entorno no detectadas. Buscando en localStorage...");
      const savedUrl = localStorage.getItem('saved_supabase_url');
      if (savedUrl) {
         attemptConnection(defaultSupabase); 
      } else {
        setIsDemo(true);
        setSessionData(DEMO_SESSION);
        setShowManualConfig(true);
        setLoading(false);
      }
    }
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUrl || !manualKey) return;
    
    let cleanUrl = manualUrl.trim();
    if (!cleanUrl.startsWith('http')) cleanUrl = `https://${cleanUrl}`;
    cleanUrl = cleanUrl.replace(/\/$/, '');
    
    const cleanKey = manualKey.trim();
    const cleanGeminiKey = manualGeminiKey.trim();

    setManualUrl(cleanUrl);
    setManualKey(cleanKey);
    setManualGeminiKey(cleanGeminiKey);

    const manualClient = createManualClient(cleanUrl, cleanKey);
    attemptConnection(manualClient, true, { url: cleanUrl, key: cleanKey, gemini: cleanGeminiKey });
  };

  const handleClearConfig = () => {
    localStorage.removeItem('saved_supabase_url');
    localStorage.removeItem('saved_supabase_key');
    localStorage.removeItem('saved_gemini_key');
    window.location.reload();
  };

  if (loading && !sessionData) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-cyan-800 font-semibold animate-pulse">Conectando servicios...</p>
        {isEnvConfigured && <p className="text-xs text-gray-400 mt-2">Intentando conexión con variables del servidor...</p>}
      </div>
    );
  }

  // Debugging helpers
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return (
    <main className="min-h-screen bg-gray-100 p-4 font-sans text-gray-900 relative">
      
      {showManualConfig && (
        <div className="absolute top-0 left-0 w-full h-full bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 overflow-y-auto max-h-[90vh]">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Configuración Inicial</h2>
            <p className="text-gray-600 text-sm mb-4">
              {isEnvConfigured 
                ? "Las variables existen pero la conexión falló." 
                : "Variables de entorno no detectadas."}
            </p>
            
            {/* DEBUG PANEL AVANZADO */}
            <div className="mb-6 p-4 bg-slate-100 border border-slate-300 rounded-lg text-xs font-mono">
              <p className="font-bold text-slate-600 mb-3 uppercase tracking-wider border-b border-slate-200 pb-1">Diagnóstico de Variables (Vercel):</p>
              
              <div className="flex flex-col gap-2 mb-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">URL:</span>
                  <span className={envUrl ? "text-green-700 font-bold bg-green-100 px-1 rounded" : "text-red-600 font-bold bg-red-100 px-1 rounded"}>
                    {maskKey(envUrl)} {envUrl ? '✅' : '❌'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Anon Key:</span>
                  <span className={envKey ? "text-green-700 font-bold bg-green-100 px-1 rounded" : "text-red-600 font-bold bg-red-100 px-1 rounded"}>
                    {maskKey(envKey)} {envKey ? '✅' : '❌'}
                  </span>
                </div>
              </div>

              {isEnvConfigured && errorMessage && (
                <p className="mt-3 text-red-600 leading-relaxed">
                  <strong>Diagnóstico:</strong> El código lee las variables (mira arriba), pero Supabase rechazó la conexión.
                  <br/>Posibles causas:
                  <ul className="list-disc ml-4 mt-1">
                    <li>La URL del proyecto no coincide con la Key.</li>
                    <li>Base de datos pausada en Supabase.</li>
                    <li>"Enable Anonymous Sign-ins" desactivado en Auth Settings.</li>
                  </ul>
                </p>
              )}

              {!isEnvConfigured && (
                <p className="mt-2 text-orange-600 italic">
                  Las variables no llegaron al navegador. 
                  Si ya hiciste redeploy, intenta borrar caché del navegador o probar en modo incógnito.
                </p>
              )}
            </div>
            
            {errorMessage && !isEnvConfigured && (
              <div className="bg-red-50 border-l-4 border-red-500 p-3 mb-4 text-xs text-red-700 font-mono break-words">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="pt-2 border-t border-gray-100">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Ingreso Manual (Respaldo)</h3>
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
                  <p className="text-xs text-gray-500 mt-1">
                    Déjalo vacío si ya configuraste <code className="bg-gray-100 px-1 rounded">API_KEY</code> en Vercel.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-4">
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white py-2 rounded-lg font-medium transition-colors flex justify-center items-center shadow-lg shadow-cyan-600/20"
                >
                  {loading ? 'Verificando...' : 'Guardar y Conectar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDemo && !showManualConfig && (
        <button 
          onClick={() => setShowManualConfig(true)}
          className="fixed bottom-4 right-4 bg-gray-800 text-white p-3 rounded-full shadow-lg hover:bg-gray-700 z-40 transition-transform hover:scale-110"
          title="Configurar Conexión"
        >
          ⚙️
        </button>
      )}

      {!isDemo && !loading && !isEnvConfigured && (
        <button 
          onClick={handleClearConfig}
          className="fixed bottom-2 right-2 opacity-20 hover:opacity-100 text-xs text-gray-500 hover:text-red-500 z-50"
          title="Borrar credenciales guardadas"
        >
          Reset Config
        </button>
      )}

      {sessionData && (
        <ChatUI 
          initialSession={sessionData} 
          customSupabase={activeSupabase}
          config={{
            supabase: manualUrl && manualKey ? { url: manualUrl, key: manualKey } : undefined,
            geminiApiKey: manualGeminiKey || undefined
          }}
        />
      )}
    </main>
  );
}
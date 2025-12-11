'use client';

import React, { useEffect, useState } from 'react';
import { supabase as placeholderSupabase, createManualClient } from '../lib/supabase/supabase-client';
import { getServerConfig } from './actions';
import ChatUI from '../components/ChatUI';
import { SessionData } from '../lib/types';
import { SupabaseClient } from '@supabase/supabase-js';

// Datos de Demo para cuando no hay conexión
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

// Helper para detectar variables en cualquier entorno (Vite o Next.js)
// IMPORTANTE: El acceso debe ser explícito para que el bundler haga el reemplazo.
const detectClientEnv = () => {
  let url = '';
  let key = '';

  try {
    // 1. Intento Next.js / Create React App (process.env)
    if (typeof process !== 'undefined' && process.env) {
      url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    }
  } catch(e) {}

  // 2. Intento Vite (import.meta.env) - Si process.env falló o estaba vacío
  if (!url || !key) {
    try {
      // @ts-ignore
      if (typeof import.meta !== 'undefined' && import.meta.env) {
        // @ts-ignore
        url = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || '';
        // @ts-ignore
        key = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      }
    } catch (e) {}
  }

  return { url, key };
};

export default function Page() {
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [activeSupabase, setActiveSupabase] = useState<SupabaseClient | null>(null);
  
  // UI Estado
  const [showManualConfig, setShowManualConfig] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Inputs Manuales / Credenciales Activas
  const [manualUrl, setManualUrl] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [manualGeminiKey, setManualGeminiKey] = useState(''); 

  // Esta bandera nos dice si debemos forzar el envío de credenciales al servidor
  const [forceClientConfig, setForceClientConfig] = useState(false);

  const connectWithClient = async (client: SupabaseClient, credentials?: {url: string, key: string, gemini?: string}, isRetry = false) => {
    try {
      setErrorMessage('');
      setLoading(true);

      const { data: authData, error: authError } = await client.auth.getUser();
      let userId = authData?.user?.id;

      if (!userId) {
        const { data: anonData, error: anonError } = await client.auth.signInAnonymously();
        if (anonError) throw new Error(`AUTH_FAIL: ${anonError.message}`);
        userId = anonData.user?.id;
      }

      if (!userId) throw new Error("No se pudo obtener User ID.");

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

      if (dbError) throw new Error(`DB_FAIL: ${dbError.message}`);

      // ÉXITO
      setActiveSupabase(client);
      setSessionData(newSession as SessionData);
      setIsDemo(false);
      setShowManualConfig(false);
      setLoading(false);

      if (credentials) {
        // Actualizamos los estados que se pasarán al ChatUI
        setManualUrl(credentials.url);
        setManualKey(credentials.key);
        if (credentials.gemini) setManualGeminiKey(credentials.gemini);

        // Guardar persistencia si fue manual
        if (isRetry) {
          localStorage.setItem('saved_supabase_url', credentials.url);
          localStorage.setItem('saved_supabase_key', credentials.key);
          if (credentials.gemini) localStorage.setItem('saved_gemini_key', credentials.gemini);
        }
      }

    } catch (err: any) {
      console.error("Connection failed:", err);
      let uiMsg = err.message || "Error desconocido";
      
      if (uiMsg.includes("AUTH_FAIL")) uiMsg = "Error de Autenticación: Credenciales inválidas.";
      if (uiMsg.includes("DB_FAIL")) uiMsg = "Error de Base de Datos: Verifica la tabla 'sessions'.";
      if (uiMsg.includes("Failed to fetch")) uiMsg = "Error de Red: URL incorrecta o bloqueo de red.";

      setErrorMessage(uiMsg);
      setLoading(false);
      setIsDemo(true);
      setSessionData(DEMO_SESSION);
      setShowManualConfig(true);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      
      try {
        console.log("⚡ Fase 1: Diagnóstico de Servidor...");
        const serverConfig = await getServerConfig();
        
        const serverUrl = serverConfig.supabaseUrl;
        const serverKey = serverConfig.supabaseAnonKey;
        
        // Detección robusta en Cliente
        const clientEnv = detectClientEnv();
        console.log("🔍 Variables Cliente detectadas:", clientEnv.url ? "SÍ" : "NO");

        const storedUrl = localStorage.getItem('saved_supabase_url');
        const storedKey = localStorage.getItem('saved_supabase_key');
        const storedGemini = localStorage.getItem('saved_gemini_key');

        let finalUrl = '';
        let finalKey = '';
        let source = '';

        if (serverUrl && serverKey) {
          console.log("✅ Servidor configurado correctamente.");
          finalUrl = serverUrl;
          finalKey = serverKey;
          source = 'server';
        } else if (clientEnv.url && clientEnv.key) {
          console.log("ℹ️ Usando variables de entorno del Cliente (Fallback).");
          finalUrl = clientEnv.url;
          finalKey = clientEnv.key;
          source = 'client-env';
          setManualUrl(clientEnv.url);
          setManualKey(clientEnv.key);
          setForceClientConfig(true);
        } else if (storedUrl && storedKey) {
          console.log("⚠️ Usando credenciales guardadas en LocalStorage.");
          finalUrl = storedUrl;
          finalKey = storedKey;
          source = 'storage';
          setForceClientConfig(true);
        }

        console.log(`Estrategia de conexión: ${source || 'Ninguna (Fallo)'}`);

        if (finalUrl && finalKey) {
          const client = createManualClient(finalUrl, finalKey);
          await connectWithClient(client, { 
            url: finalUrl, 
            key: finalKey, 
            gemini: storedGemini || '' 
          });
        } else {
          throw new Error("NO_CREDENTIALS_FOUND");
        }

      } catch (err) {
        console.warn("Fallo en inicialización automática:", err);
        setIsDemo(true);
        setSessionData(DEMO_SESSION);
        setShowManualConfig(true);
        setLoading(false);
      }
    };

    init();
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUrl || !manualKey) return;

    let cleanUrl = manualUrl.trim();
    if (!cleanUrl.startsWith('http')) cleanUrl = `https://${cleanUrl}`;
    cleanUrl = cleanUrl.replace(/\/$/, '');
    const cleanKey = manualKey.trim();

    const newClient = createManualClient(cleanUrl, cleanKey);
    setForceClientConfig(true); 
    
    connectWithClient(newClient, { 
      url: cleanUrl, 
      key: cleanKey, 
      gemini: manualGeminiKey 
    }, true);
  };

  if (loading && !sessionData) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin mb-6"></div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Iniciando Consultoría</h2>
        <p className="text-gray-500 text-sm">Sincronizando agentes y base de datos...</p>
      </div>
    );
  }

  const chatConfig = forceClientConfig ? {
    supabase: { url: manualUrl, key: manualKey },
    geminiApiKey: manualGeminiKey || undefined
  } : {
    geminiApiKey: manualGeminiKey || undefined
  };

  return (
    <main className="min-h-screen bg-gray-100 p-4 font-sans text-gray-900 relative">
      
      {showManualConfig && (
        <div className="absolute top-0 left-0 w-full h-full bg-gray-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Conexión Requerida</h2>
            <p className="text-gray-600 mb-4 text-sm">
              No se detectaron credenciales en el entorno.
            </p>
            
            <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
              <strong>Diagnóstico:</strong> El servidor no ve las variables y el cliente tampoco. <br/>
              1. Asegúrate de hacer <strong>Redeploy</strong> en Vercel para que los cambios de variables surtan efecto.<br/>
              2. O introduce las claves manualmente aquí (se guardarán en tu navegador).
            </div>

            {errorMessage && (
              <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 text-sm text-red-700">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleManualSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Supabase Project URL</label>
                <input 
                  type="text" 
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  placeholder="https://tu-proyecto.supabase.co"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Supabase Anon Key</label>
                <input 
                  type="password" 
                  value={manualKey}
                  onChange={(e) => setManualKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                />
              </div>
              
              <div className="pt-4 border-t border-gray-100 mt-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Gemini API Key (Opcional)</label>
                <input 
                  type="password" 
                  value={manualGeminiKey}
                  onChange={(e) => setManualGeminiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
              >
                Guardar y Conectar
              </button>
            </form>
          </div>
        </div>
      )}

      {(isDemo || !loading) && (
        <button 
          onClick={() => setShowManualConfig(true)}
          className="fixed bottom-4 right-4 bg-gray-800 text-white p-3 rounded-full shadow-lg hover:bg-gray-700 z-40 transition-transform hover:scale-110"
          title="Configuración"
        >
          ⚙️
        </button>
      )}

      {sessionData && (
        <ChatUI 
          initialSession={sessionData} 
          customSupabase={activeSupabase || placeholderSupabase}
          config={chatConfig}
        />
      )}
    </main>
  );
}
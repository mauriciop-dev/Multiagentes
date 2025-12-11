'use client';

import React, { useEffect, useState } from 'react';
import { supabase as defaultSupabase, createManualClient } from '../lib/supabase/supabase-client';
import ChatUI from '../components/ChatUI';
import { SessionData } from '../lib/types';
import { SupabaseClient } from '@supabase/supabase-js';

// Sesión Demo de Respaldo
const DEMO_SESSION: SessionData = {
  id: 'demo-session',
  user_id: 'demo-user',
  chat_history: [
    { role: 'user', content: 'Demo: Analizar "TechCorp"', timestamp: Date.now() },
    { role: 'agent', name: 'Pedro', content: 'Modo Demo Activo. Por favor configura tus credenciales para usar la IA real.', timestamp: Date.now() + 1000 }
  ],
  company_info: 'TechCorp',
  research_results: [],
  report_final: '',
  current_state: 'WAITING_FOR_INFO', 
  research_counter: 0
};

export default function Page() {
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  
  // Cliente Supabase activo (puede cambiar si el usuario introduce credenciales)
  const [client, setClient] = useState<SupabaseClient>(defaultSupabase);

  // Estados para inputs manuales
  const [manualUrl, setManualUrl] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [manualGemini, setManualGemini] = useState('');

  // Efecto inicial: Intenta conectar usando env vars o storage local
  useEffect(() => {
    // Cargar credenciales guardadas si existen
    const savedUrl = localStorage.getItem('sb_url');
    const savedKey = localStorage.getItem('sb_key');
    const savedGemini = localStorage.getItem('gemini_key');
    
    if (savedUrl) setManualUrl(savedUrl);
    if (savedKey) setManualKey(savedKey);
    if (savedGemini) setManualGemini(savedGemini);

    // Si hay credenciales guardadas, usarlas. Si no, usar las del cliente por defecto (env vars)
    if (savedUrl && savedKey) {
      const savedClient = createManualClient(savedUrl, savedKey);
      initSession(savedClient);
    } else {
      initSession(defaultSupabase);
    }
  }, []);

  const initSession = async (targetClient: SupabaseClient) => {
    setLoading(true);
    try {
      // Autenticación Anónima
      const { data: auth, error: authError } = await targetClient.auth.signInAnonymously();
      
      if (authError) {
        throw new Error(`Auth Error: ${authError.message}`);
      }

      const userId = auth.user?.id;
      if (!userId) throw new Error("No user ID returned");

      // Crear Sesión en DB
      const { data: newSession, error: dbError } = await targetClient
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

      if (dbError) throw new Error(`DB Error: ${dbError.message}`);

      // Éxito
      setSessionData(newSession as SessionData);
      setClient(targetClient);
      setShowConfig(false);

    } catch (e) {
      console.warn("Fallo inicialización, entrando a modo configuración:", e);
      setSessionData(DEMO_SESSION);
      setShowConfig(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUrl || !manualKey) return;

    // Guardar en LocalStorage
    localStorage.setItem('sb_url', manualUrl);
    localStorage.setItem('sb_key', manualKey);
    if (manualGemini) localStorage.setItem('gemini_key', manualGemini);

    // Reiniciar sesión con nuevo cliente
    const newClient = createManualClient(manualUrl, manualKey);
    initSession(newClient);
  };

  if (loading && !sessionData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mb-4"></div>
        <p className="text-gray-500 text-sm animate-pulse">Conectando Agentes...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 relative font-sans text-gray-900">
      
      {/* Botón de Ajustes Flotante */}
      <button 
        onClick={() => setShowConfig(true)}
        className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform border-2 border-cyan-500/50"
        title="Configuración de Credenciales"
      >
        ⚙️
      </button>

      {/* Modal de Configuración */}
      {showConfig && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md transform transition-all scale-100">
            <h2 className="text-2xl font-bold mb-2 text-gray-800">Configuración</h2>
            <p className="text-sm text-gray-500 mb-6">
              Ingresa tus credenciales para conectar el sistema Multi-Agente.
            </p>
            
            <form onSubmit={handleSaveConfig} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Supabase URL</label>
                <input 
                  className="w-full bg-gray-50 border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none transition-all" 
                  value={manualUrl} 
                  onChange={e => setManualUrl(e.target.value)} 
                  placeholder="https://tu-proyecto.supabase.co"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Supabase Anon Key</label>
                <input 
                  type="password"
                  className="w-full bg-gray-50 border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none transition-all" 
                  value={manualKey} 
                  onChange={e => setManualKey(e.target.value)} 
                  placeholder="eyJ..."
                />
              </div>
              <div className="pt-2 border-t border-gray-100">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Gemini API Key</label>
                <input 
                  type="password"
                  className="w-full bg-gray-50 border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none transition-all" 
                  value={manualGemini} 
                  onChange={e => setManualGemini(e.target.value)} 
                  placeholder="AIza..."
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowConfig(false)} className="flex-1 px-4 py-3 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 px-4 py-3 bg-cyan-600 text-white font-bold rounded-xl hover:bg-cyan-700 shadow-lg transition-colors">
                  Guardar y Conectar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {sessionData && (
        <ChatUI 
          initialSession={sessionData} 
          supabaseClient={client}
          geminiKey={manualGemini} 
        />
      )}
    </main>
  );
}
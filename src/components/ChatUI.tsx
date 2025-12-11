import React, { useEffect, useState, useRef } from 'react';
import { processUserMessage } from '../app/actions';
import { Message, SessionData, WorkflowState } from '../lib/types';
import ReactMarkdown from 'react-markdown';
import { SupabaseClient } from '@supabase/supabase-js';

interface ChatUIProps {
  initialSession: SessionData;
  supabaseClient: SupabaseClient;
  geminiKey?: string;
}

export default function ChatUI({ initialSession, supabaseClient, geminiKey }: ChatUIProps) {
  const [session, setSession] = useState<SessionData>(initialSession);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const history = session.chat_history || [];

  // Suscripción Realtime
  useEffect(() => {
    if (session.id === 'demo-session') return;

    const channel = supabaseClient
      .channel(`room:${session.id}`)
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${session.id}` }, 
        (payload) => {
          if (payload.new) {
            setSession(payload.new as SessionData);
          }
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [session.id, supabaseClient]);

  // Auto-scroll inteligente
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history.length, session.current_state, session.report_final]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    
    setLoading(true);
    const text = input;
    setInput('');

    try {
      await processUserMessage(session.id, text, { geminiKey });
    } catch (error) {
      console.error(error);
      alert("Hubo un error al procesar tu solicitud. Verifica tu conexión y API Key.");
    } finally {
      setLoading(false);
    }
  };

  const renderBadge = (state: WorkflowState) => {
    const config: Record<string, string> = {
      'WAITING_FOR_INFO': 'bg-gray-100 text-gray-600 border-gray-200',
      'START_RESEARCH': 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse',
      'START_REPORT': 'bg-indigo-50 text-indigo-700 border-indigo-200 animate-pulse',
      'FINISHED': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
    
    const labels: Record<string, string> = {
      'WAITING_FOR_INFO': 'Esperando Instrucciones',
      'START_RESEARCH': 'Agente Pedro Investigando...',
      'START_REPORT': 'Agente Juan Redactando...',
      'FINISHED': 'Análisis Completado',
    };
    
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${config[state] || 'bg-gray-100'}`}>
        {labels[state] || state}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-screen max-w-5xl mx-auto bg-white shadow-2xl overflow-hidden border-x border-gray-100">
      
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-sm p-4 border-b border-gray-200 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
            IA
          </div>
          <div>
            <h1 className="font-bold text-gray-800 text-lg leading-tight">Consultores Empresariales</h1>
            <p className="text-xs text-gray-500 font-medium">Sistema Multi-Agente Inteligente</p>
          </div>
        </div>
        {renderBadge(session.current_state)}
      </header>

      {/* Area de Chat */}
      <div className="flex-1 overflow-y-auto bg-gray-50/50 p-4 sm:p-6 space-y-6">
        {history.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
            <div className="text-6xl mb-4">🏢</div>
            <p className="text-lg font-medium">¿Qué empresa analizamos hoy?</p>
          </div>
        )}
        
        {history.map((msg, idx) => {
          const isUser = msg.role === 'user';
          const isPedro = msg.name === 'Pedro';
          
          return (
            <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
              <div className={`max-w-[90%] sm:max-w-[80%] rounded-2xl p-5 shadow-sm text-sm leading-relaxed ${
                isUser 
                  ? 'bg-gray-900 text-white rounded-tr-sm' 
                  : isPedro 
                    ? 'bg-white border-l-4 border-amber-400 text-gray-800 rounded-tl-sm'
                    : 'bg-white border-l-4 border-indigo-400 text-gray-800 rounded-tl-sm'
              }`}>
                {!isUser && (
                  <div className="flex items-center gap-2 mb-3 border-b border-gray-100 pb-2">
                    <span className="text-xl">{isPedro ? '⚡' : '📊'}</span>
                    <span className={`font-bold text-xs uppercase tracking-wider ${isPedro ? 'text-amber-600' : 'text-indigo-600'}`}>
                      {isPedro ? 'Pedro • Ing. Técnico' : 'Juan • Project Manager'}
                    </span>
                  </div>
                )}
                <div className="prose prose-sm max-w-none prose-p:my-1 dark:prose-invert">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          );
        })}
        
        {/* Reporte Final Destacado */}
        {session.report_final && (
          <div className="mt-8 mb-4 mx-2">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-emerald-100">
              <div className="bg-emerald-600 p-4 text-white flex items-center gap-3">
                <span className="text-2xl">🚀</span>
                <h2 className="font-bold text-lg">Informe Ejecutivo Final</h2>
              </div>
              <div className="p-8 prose prose-emerald max-w-none">
                <ReactMarkdown>{session.report_final}</ReactMarkdown>
              </div>
              <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
                <button 
                  onClick={() => window.print()} 
                  className="text-emerald-600 font-bold text-sm hover:underline"
                >
                  Descargar / Imprimir Informe
                </button>
              </div>
            </div>
          </div>
        )}
        
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-200">
        <form onSubmit={handleSubmit} className="flex gap-3 max-w-4xl mx-auto relative">
          <input 
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading || session.current_state !== 'WAITING_FOR_INFO'}
            placeholder={loading ? "Los agentes están trabajando..." : "Escribe el nombre de la empresa..."}
            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 focus:ring-2 focus:ring-cyan-500 focus:bg-white outline-none transition-all shadow-inner"
          />
          <button 
            type="submit"
            disabled={loading || session.current_state !== 'WAITING_FOR_INFO'}
            className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-8 rounded-xl font-bold transition-all shadow-md transform active:scale-95"
          >
            {loading ? '...' : 'Enviar'}
          </button>
        </form>
      </div>
    </div>
  );
}
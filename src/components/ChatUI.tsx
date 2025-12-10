import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase/supabase-client';
import { processUserMessage } from '../app/actions';
import { Message, SessionData, WorkflowState } from '../lib/types';
import ReactMarkdown from 'react-markdown';

interface ChatUIProps {
  initialSession: SessionData;
}

export default function ChatUI({ initialSession }: ChatUIProps) {
  const [session, setSession] = useState<SessionData>(initialSession);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const isDemo = session.id === 'demo-session';

  // Subscribe to real-time changes
  useEffect(() => {
    if (isDemo) return; // Skip subscription in demo mode

    const channel = supabase
      .channel(`session:${session.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sessions',
          filter: `id=eq.${session.id}`,
        },
        (payload) => {
          setSession(payload.new as SessionData);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session.id, isDemo]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session.chat_history, session.current_state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    setErrorMsg('');

    if (isDemo) {
      setErrorMsg("Funcionalidad deshabilitada en Modo Demo. Configura las variables en Vercel para continuar.");
      return;
    }

    const userText = input;
    setInput('');
    setLoading(true);

    try {
      // Optimistic update (optional, but waiting for DB update is safer for consistency here)
      await processUserMessage(session.id, session.user_id, userText);
    } catch (error: any) {
      console.error(error);
      const msg = error.message || "Error desconocido";
      if (msg.includes("API_KEY")) {
        setErrorMsg("Error de Configuración: Falta la API_KEY de Gemini en Vercel.");
      } else {
        setErrorMsg(`Error: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const renderStateBadge = (state: WorkflowState) => {
    switch (state) {
      case 'WAITING_FOR_INFO': return <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-xs font-bold animate-pulse">Esperando Input</span>;
      case 'START_RESEARCH': return <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold animate-pulse">Pedro Investigando...</span>;
      case 'START_REPORT': return <span className="bg-sky-100 text-sky-700 px-3 py-1 rounded-full text-xs font-bold animate-pulse">Juan Redactando...</span>;
      case 'FINISHED': return <span className="bg-cyan-100 text-cyan-700 px-3 py-1 rounded-full text-xs font-bold">Sesión Finalizada</span>;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-w-4xl mx-auto bg-white shadow-xl rounded-xl overflow-hidden my-4 border border-gray-200">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Consultores Empresariales IA</h1>
          <p className="text-xs text-gray-500">Sistema Multi-Agente: Pedro (Ingeniero) & Juan (PM)</p>
        </div>
        {renderStateBadge(session.current_state)}
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50">
        {session.chat_history.length === 0 && (
          <div className="text-center text-gray-400 mt-10">
            <p className="mb-2 text-lg">Bienvenido al sistema de consultoría.</p>
            <p className="text-sm">Introduce el nombre de tu empresa o el tema que deseas analizar.</p>
          </div>
        )}

        {session.chat_history.map((msg, idx) => {
          const isUser = msg.role === 'user';
          const isPedro = msg.name === 'Pedro';
          const isJuan = msg.name === 'Juan';

          return (
            <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-xl p-4 shadow-sm text-sm leading-relaxed ${
                  isUser
                    ? 'bg-white border border-gray-200 text-gray-800 rounded-tr-none'
                    : isPedro
                    ? 'bg-emerald-50 border-l-4 border-emerald-500 text-emerald-900 rounded-tl-none'
                    : 'bg-sky-50 border-l-4 border-sky-500 text-sky-900 rounded-tl-none'
                }`}
              >
                {!isUser && (
                  <div className="mb-2 font-bold text-xs uppercase tracking-wider opacity-70 flex items-center gap-2">
                    {isPedro && <span>🤖 Pedro (Ing. IA)</span>}
                    {isJuan && <span>👔 Juan (Project Manager)</span>}
                  </div>
                )}
                <div className="markdown prose prose-sm max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          );
        })}

        {/* Final Report Display */}
        {session.report_final && (
          <div className="mt-8 border-t-2 border-cyan-100 pt-8">
            <div className="bg-white border border-cyan-200 rounded-xl p-8 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-cyan-500 to-sky-600"></div>
              <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                <span className="text-3xl">📄</span> Informe Ejecutivo Final
              </h2>
              <div className="prose prose-cyan max-w-none text-gray-700">
                <ReactMarkdown>{session.report_final}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-200">
        {errorMsg && (
          <div className="mb-2 bg-red-50 text-red-800 text-xs px-3 py-2 rounded border border-red-200 flex justify-between items-center">
             <span>{errorMsg}</span>
             <button onClick={() => setErrorMsg('')} className="text-red-500 hover:text-red-700 font-bold ml-2">×</button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading || session.current_state !== 'WAITING_FOR_INFO'}
            placeholder={
              session.current_state !== 'WAITING_FOR_INFO'
                ? "Los agentes están trabajando..."
                : "Escribe el nombre de tu empresa o tema a investigar..."
            }
            className="flex-1 px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-600 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400 transition-all"
          />
          <button
            type="submit"
            disabled={loading || session.current_state !== 'WAITING_FOR_INFO'}
            className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-300 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-md flex items-center gap-2"
          >
            {loading ? (
              <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <span>Enviar</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
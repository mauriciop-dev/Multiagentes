'use server';

import { GoogleGenAI } from "@google/genai";
import { createClient } from '@supabase/supabase-js';
import { Message, SessionData } from '../lib/types';

interface ActionConfig {
  supabase?: { url: string; key: string };
  geminiApiKey?: string;
  /** @deprecated backward compatibility */
  url?: string;
  /** @deprecated backward compatibility */
  key?: string;
}

// NUEVO: Función para rescatar la configuración del servidor con FALLBACKS
export async function getServerConfig() {
  // Debug: Ver qué claves existen realmente en el entorno del servidor
  const envKeys = Object.keys(process.env).filter(key => 
    key.includes('SUPABASE') || key.includes('NEXT_PUBLIC') || key.includes('API_KEY')
  );
  
  console.log("[Server Diagnostic] Claves de entorno visibles:", envKeys);

  // Intentar leer variantes con y sin prefijo NEXT_PUBLIC
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
  const geminiKey = process.env.API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  
  // Verificación de diagnóstico: ¿Existe la Service Key? (Esto nos dice si las variables de servidor están cargando)
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log("[Server Diagnostic] Estado:", {
    urlFound: !!url,
    anonKeyFound: !!anonKey,
    serviceKeyFound: hasServiceKey,
    geminiFound: !!geminiKey
  });

  return {
    supabaseUrl: url || null,
    supabaseAnonKey: anonKey || null,
    hasGeminiKey: !!geminiKey,
    isConfigured: !!(url && anonKey)
  };
}

// -- Helpers de Errores --

function formatGenAIError(error: any): string {
  const msg = error.message || String(error);

  if (msg.includes("SERVICE_DISABLED") || (msg.includes("Generative Language API") && msg.includes("disabled"))) {
    const urlRegex = /https:\/\/console\.developers\.google\.com\/apis\/api\/generativelanguage\.googleapis\.com\/overview\?project=\d+/;
    const match = msg.match(urlRegex);
    const activationUrl = match ? match[0] : 'https://console.developers.google.com/apis/api/generativelanguage.googleapis.com';
    
    return `🚨 **Acción Requerida: Habilitar API**\n\nTu API Key es válida, pero el servicio "Generative Language API" no está activado en tu proyecto de Google Cloud.\n\n👉 **[Haz clic aquí para activarlo](${activationUrl})**\n\n_Después de activar (botón azul "Habilitar"), espera 1 minuto e intenta nuevamente._`;
  }

  if (msg.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(msg);
      if (parsed.error && parsed.error.message) {
        return `[Error Técnico]: ${parsed.error.message}`;
      }
    } catch (e) {
    }
  }

  return `[Error del Sistema]: ${msg.substring(0, 300)}${msg.length > 300 ? '...' : ''}`;
}

// -- Configuración de Entorno --

function getAI(manualKey?: string) {
  // Priorizar clave manual si existe, sino usar variable de entorno
  const apiKey = manualKey || process.env.API_KEY || process.env.GOOGLE_API_KEY;
  
  if (!apiKey) {
    console.error("CRITICAL ERROR: 'API_KEY' environment variable is missing.");
    throw new Error("La variable de entorno API_KEY no está configurada en el servidor.");
  }
  
  return new GoogleGenAI({ apiKey });
}

function getSupabase(config?: { url: string, key: string }) {
  // 1. Si viene configuración manual (desde el cliente), usarla
  if (config?.url && config?.key) {
    return createClient(config.url, config.key);
  }

  // 2. Si no, usar variables de entorno del SERVIDOR (Service Role preferred for actions)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  
  if (url && (serviceKey || anonKey) && !url.includes('placeholder')) {
    return createClient(url, serviceKey || anonKey!);
  }
  
  // 4. Último recurso: placeholder
  return createClient(
    url || 'https://placeholder.supabase.co',
    anonKey || 'placeholder-key'
  );
}

// -- Lógica de Base de Datos --

async function updateSession(id: string, updates: Partial<SessionData>, sbConfig?: { url: string, key: string }) {
  const supabase = getSupabase(sbConfig);
  const { error } = await supabase
    .from('sessions')
    .update(updates)
    .eq('id', id);
  
  if (error) console.error('Error actualizando sesión:', error);
}

async function addMessage(id: string, currentHistory: Message[] | null | undefined, newMessage: Message, sbConfig?: { url: string, key: string }) {
  const safeHistory = Array.isArray(currentHistory) ? currentHistory : [];
  const updatedHistory = [...safeHistory, newMessage];
  
  await updateSession(id, { chat_history: updatedHistory }, sbConfig);
  return updatedHistory;
}

// -- Agente 1: Pedro (Ingeniero IA) --
async function runPedroAgent(companyInfo: string, iteration: number, apiKey?: string): Promise<string> {
  try {
    const ai = getAI(apiKey);
    const modelId = 'gemini-2.5-flash';
    
    const prompt = `
      Eres Pedro, un consultor técnico experto en IA e Ingeniería.
      Objetivo: Investigar oportunidades técnicas para: "${companyInfo}".
      Iteración de investigación: ${iteration}.
      
      Instrucciones:
      1. Busca tecnologías recientes, patentes o casos de uso digitales relevantes.
      2. Sé técnico, preciso y analítico.
      3. Máximo 150 palabras.
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }], 
      },
    });

    return response.text || "No encontré información relevante en esta búsqueda.";
  } catch (error: any) {
    console.error("Error en Agente Pedro:", error);
    return formatGenAIError(error);
  }
}

// -- Agente 2: Juan (Project Manager) --
async function runJuanAgent(companyInfo: string, researchResults: string[], apiKey?: string): Promise<string> {
  try {
    const ai = getAI(apiKey);
    const modelId = 'gemini-2.5-flash';
    
    const prompt = `
      Eres Juan, un Project Manager Senior y Estratega Digital.
      
      Contexto del Cliente: "${companyInfo}"
      
      Hallazgos Técnicos (de Pedro):
      ${researchResults.map((r, i) => `- ${r}`).join('\n')}
      
      Tu Tarea:
      Generar un Informe Ejecutivo Final en Markdown.
      1. Resumen Ejecutivo: Traduce los hallazgos técnicos a valor de negocio.
      2. Propuesta de Valor: 3 Soluciones de IA concretas y rentables.
      3. Tono: Profesional, empático, orientado a resultados.
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
    });

    return response.text || "No se pudo generar el informe final.";
  } catch (error: any) {
    console.error("Error en Agente Juan:", error);
    return formatGenAIError(error);
  }
}

// -- Orquestador Principal --
export async function processUserMessage(
  sessionId: string, 
  userId: string, 
  userContent: string,
  config?: ActionConfig
) {
  const sbConfig = config?.supabase || (config?.url ? { url: config.url!, key: config.key! } : undefined);
  const geminiKey = config?.geminiApiKey;

  const supabase = getSupabase(sbConfig);

  // 1. Validar sesión
  const { data: session, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error || !session) {
    console.error("Error buscando sesión:", error);
    throw new Error("No se encontró la sesión activa. Verifica tu conexión a Supabase.");
  }

  let currentSession = session as SessionData;

  // 2. Guardar mensaje del usuario
  const userMsg: Message = { role: 'user', content: userContent, timestamp: Date.now() };
  let history = await addMessage(sessionId, currentSession.chat_history, userMsg, sbConfig);

  // 3. Transición: WAITING -> START_RESEARCH
  await updateSession(sessionId, { 
    company_info: userContent, 
    current_state: 'START_RESEARCH' 
  }, sbConfig);
  
  // Respuesta inicial de Pedro
  await addMessage(sessionId, history, {
    role: 'agent',
    name: 'Pedro',
    content: `Entendido. Comienzo el análisis técnico para "${userContent}".`,
    timestamp: Date.now()
  }, sbConfig);

  // Bucle de Investigación (Pedro)
  let researchResults = currentSession.research_results || [];
  let counter = 0;
  const MAX_RESEARCH_LOOPS = 2; 

  while (counter < MAX_RESEARCH_LOOPS) {
    await updateSession(sessionId, { research_counter: counter + 1 }, sbConfig);
    
    // Pasamos geminiKey a los agentes
    const finding = await runPedroAgent(userContent, counter + 1, geminiKey);
    researchResults.push(finding);
    
    // Pedro reporta hallazgo
    history = await addMessage(sessionId, history, {
      role: 'agent',
      name: 'Pedro',
      content: `[Hallazgo #${counter + 1}]: ${finding}`,
      timestamp: Date.now()
    }, sbConfig);

    await updateSession(sessionId, { research_results: researchResults }, sbConfig);
    counter++;
  }

  // 4. Transición: RESEARCH -> START_REPORT (Juan)
  await updateSession(sessionId, { current_state: 'START_REPORT' }, sbConfig);

  // Juan toma el relevo
  await addMessage(sessionId, history, {
    role: 'agent',
    name: 'Juan',
    content: "Gracias Pedro. Excelente trabajo técnico. Procedo a estructurar la estrategia de negocio para el cliente.",
    timestamp: Date.now()
  }, sbConfig);

  const finalReport = await runJuanAgent(userContent, researchResults, geminiKey);

  // Juan entrega el reporte
  history = await addMessage(sessionId, history, {
    role: 'agent',
    name: 'Juan',
    content: "Aquí tienes el Informe Ejecutivo Final.",
    timestamp: Date.now()
  }, sbConfig);

  // 5. Finalizar
  await updateSession(sessionId, { 
    report_final: finalReport, 
    current_state: 'FINISHED',
    chat_history: history 
  }, sbConfig);
}
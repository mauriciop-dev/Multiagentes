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

// -- Helpers de Errores --

// Formatea errores complejos de la API de Google en mensajes Markdown legibles para el usuario
function formatGenAIError(error: any): string {
  const msg = error.message || String(error);

  // Caso específico: API no habilitada (Error 403 SERVICE_DISABLED)
  // El mensaje suele ser: "Generative Language API has not been used in project X before or it is disabled."
  if (msg.includes("SERVICE_DISABLED") || (msg.includes("Generative Language API") && msg.includes("disabled"))) {
    // Intentamos extraer la URL exacta que manda Google en el error
    const urlRegex = /https:\/\/console\.developers\.google\.com\/apis\/api\/generativelanguage\.googleapis\.com\/overview\?project=\d+/;
    const match = msg.match(urlRegex);
    const activationUrl = match ? match[0] : 'https://console.developers.google.com/apis/api/generativelanguage.googleapis.com';
    
    return `🚨 **Acción Requerida: Habilitar API**\n\nTu API Key es válida, pero el servicio "Generative Language API" no está activado en tu proyecto de Google Cloud.\n\n👉 **[Haz clic aquí para activarlo](${activationUrl})**\n\n_Después de activar (botón azul "Habilitar"), espera 1 minuto e intenta nuevamente._`;
  }

  // Limpieza general de JSON dump si ocurre
  if (msg.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(msg);
      if (parsed.error && parsed.error.message) {
        return `[Error Técnico]: ${parsed.error.message}`;
      }
    } catch (e) {
      // Si falla el parseo, devolvemos el original
    }
  }

  return `[Error del Sistema]: ${msg.substring(0, 300)}${msg.length > 300 ? '...' : ''}`;
}

// -- Configuración de Entorno --

function getAI(manualKey?: string) {
  const apiKey = manualKey || process.env.API_KEY;
  
  if (!apiKey) {
    console.error("CRITICAL ERROR: 'API_KEY' environment variable is missing.");
    throw new Error("La variable de entorno API_KEY no está configurada en el servidor.");
  }
  
  return new GoogleGenAI({ apiKey });
}

function getSupabase(config?: { url: string, key: string }) {
  if (config?.url && config?.key) {
    return createClient(config.url, config.key);
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (serviceKey && url && !serviceKey.includes('placeholder')) {
    return createClient(url, serviceKey);
  }
  
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

async function addMessage(id: string, currentHistory: Message[], newMessage: Message, sbConfig?: { url: string, key: string }) {
  const updatedHistory = [...currentHistory, newMessage];
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
    // Usamos el helper para formatear el error amigablemente
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
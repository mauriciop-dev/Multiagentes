'use server';

import { GoogleGenAI } from "@google/genai";
import { createClient } from '@supabase/supabase-js';
import { Message, SessionData } from '../lib/types';

// -- Configuración de Entorno --

// Helper para obtener Google AI de forma segura (Server Side)
function getAI() {
  // Intentamos todas las variantes posibles de variables de entorno
  const apiKey = 
    process.env.API_KEY || 
    process.env.NEXT_PUBLIC_API_KEY ||
    // @ts-ignore: Acceso directo por si el bundler no reemplaza process.env
    (typeof process !== 'undefined' && process.env ? process.env['API_KEY'] : undefined);
  
  // En lugar de lanzar error aquí, usamos un dummy si no existe.
  // Esto permite instanciar el cliente y que el error real ("Invalid Key") venga de la llamada a la API.
  // Es útil para debugging en entornos donde las env vars son inestables.
  return new GoogleGenAI({ apiKey: apiKey || 'dummy-key-for-debugging' });
}

// Helper para obtener Supabase con permisos de administración
function getSupabase(manualConfig?: { url: string, key: string }) {
  if (manualConfig?.url && manualConfig?.key) {
    return createClient(manualConfig.url, manualConfig.key);
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

async function updateSession(id: string, updates: Partial<SessionData>, manualConfig?: { url: string, key: string }) {
  const supabase = getSupabase(manualConfig);
  const { error } = await supabase
    .from('sessions')
    .update(updates)
    .eq('id', id);
  
  if (error) console.error('Error actualizando sesión:', error);
}

async function addMessage(id: string, currentHistory: Message[], newMessage: Message, manualConfig?: { url: string, key: string }) {
  const updatedHistory = [...currentHistory, newMessage];
  await updateSession(id, { chat_history: updatedHistory }, manualConfig);
  return updatedHistory;
}

// -- Agente 1: Pedro (Ingeniero IA) --
async function runPedroAgent(companyInfo: string, iteration: number): Promise<string> {
  const ai = getAI();
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

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }], // Grounding con Google Search
      },
    });

    return response.text || "No encontré información relevante en esta búsqueda.";
  } catch (error: any) {
    console.error("Error en Agente Pedro:", error);
    // Si la key es dummy, el error será 400. Devolvemos un mensaje claro.
    if (error.message?.includes('400') || error.message?.includes('API key')) {
      return "Error: API KEY de Gemini inválida o no encontrada.";
    }
    return "Error técnico al consultar fuentes externas.";
  }
}

// -- Agente 2: Juan (Project Manager) --
async function runJuanAgent(companyInfo: string, researchResults: string[]): Promise<string> {
  const ai = getAI();
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

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
    });

    return response.text || "No se pudo generar el informe final.";
  } catch (error) {
    console.error("Error en Agente Juan:", error);
    return "Error al redactar el informe final.";
  }
}

// -- Orquestador Principal (Simulación LangGraph) --
export async function processUserMessage(
  sessionId: string, 
  userId: string, 
  userContent: string,
  manualConfig?: { url: string, key: string } // Nuevo parámetro para credenciales manuales
) {
  const supabase = getSupabase(manualConfig);

  // 1. Validar sesión
  const { data: session, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error || !session) {
    console.error("Error buscando sesión:", error);
    throw new Error("No se encontró la sesión activa. Es posible que el servidor esté buscando en una base de datos diferente a la del navegador.");
  }

  let currentSession = session as SessionData;

  // 2. Guardar mensaje del usuario
  const userMsg: Message = { role: 'user', content: userContent, timestamp: Date.now() };
  let history = await addMessage(sessionId, currentSession.chat_history, userMsg, manualConfig);

  // 3. Transición: WAITING -> START_RESEARCH
  await updateSession(sessionId, { 
    company_info: userContent, 
    current_state: 'START_RESEARCH' 
  }, manualConfig);
  
  // Respuesta inicial de Pedro
  await addMessage(sessionId, history, {
    role: 'agent',
    name: 'Pedro',
    content: `Entendido. Comienzo el análisis técnico para "${userContent}".`,
    timestamp: Date.now()
  }, manualConfig);

  // Bucle de Investigación (Pedro)
  let researchResults = currentSession.research_results || [];
  let counter = 0;
  const MAX_RESEARCH_LOOPS = 2; // Cantidad de búsquedas

  while (counter < MAX_RESEARCH_LOOPS) {
    await updateSession(sessionId, { research_counter: counter + 1 }, manualConfig);
    
    const finding = await runPedroAgent(userContent, counter + 1);
    researchResults.push(finding);
    
    // Pedro reporta hallazgo
    history = await addMessage(sessionId, history, {
      role: 'agent',
      name: 'Pedro',
      content: `[Hallazgo #${counter + 1}]: ${finding}`,
      timestamp: Date.now()
    }, manualConfig);

    await updateSession(sessionId, { research_results: researchResults }, manualConfig);
    counter++;
  }

  // 4. Transición: RESEARCH -> START_REPORT (Juan)
  await updateSession(sessionId, { current_state: 'START_REPORT' }, manualConfig);

  // Juan toma el relevo
  await addMessage(sessionId, history, {
    role: 'agent',
    name: 'Juan',
    content: "Gracias Pedro. Excelente trabajo técnico. Procedo a estructurar la estrategia de negocio para el cliente.",
    timestamp: Date.now()
  }, manualConfig);

  const finalReport = await runJuanAgent(userContent, researchResults);

  // Juan entrega el reporte
  history = await addMessage(sessionId, history, {
    role: 'agent',
    name: 'Juan',
    content: "Aquí tienes el Informe Ejecutivo Final.",
    timestamp: Date.now()
  }, manualConfig);

  // 5. Finalizar
  await updateSession(sessionId, { 
    report_final: finalReport, 
    current_state: 'FINISHED',
    chat_history: history 
  }, manualConfig);
}
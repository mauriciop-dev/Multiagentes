'use server';

import { GoogleGenAI } from "@google/genai";
import { createClient } from '@supabase/supabase-js';
import { Message, SessionData } from '../lib/types';
import { supabase as clientSupabase } from '../lib/supabase/supabase-client';

// -- Configuración de Entorno --

// Helper para obtener Google AI de forma segura (Server Side)
function getAI() {
  // Acceso directo para garantizar que Next.js/Vercel inyecte el valor
  const apiKey = process.env.API_KEY || process.env.NEXT_PUBLIC_API_KEY;
  
  if (!apiKey) {
    console.error("FALTA API KEY: Asegúrate de tener 'API_KEY' en tus variables de entorno.");
    throw new Error("Configuración de IA incompleta: API_KEY no encontrada.");
  }
  return new GoogleGenAI({ apiKey });
}

// Helper para obtener Supabase con permisos de administración
function getSupabase() {
  // Acceso directo a variables de entorno
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  // Si tenemos la llave maestra (Service Role), la usamos para saltarnos RLS
  if (serviceKey && url && !serviceKey.includes('placeholder')) {
    return createClient(url, serviceKey);
  }
  
  // Fallback: Cliente estándar con clave anónima
  return createClient(
    url || 'https://placeholder.supabase.co',
    anonKey || 'placeholder-key'
  );
}

// -- Lógica de Base de Datos --

async function updateSession(id: string, updates: Partial<SessionData>) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('sessions')
    .update(updates)
    .eq('id', id);
  
  if (error) console.error('Error actualizando sesión:', error);
}

async function addMessage(id: string, currentHistory: Message[], newMessage: Message) {
  const updatedHistory = [...currentHistory, newMessage];
  await updateSession(id, { chat_history: updatedHistory });
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
  } catch (error) {
    console.error("Error en Agente Pedro:", error);
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
export async function processUserMessage(sessionId: string, userId: string, userContent: string) {
  const supabase = getSupabase();

  // 1. Validar sesión
  const { data: session, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error || !session) throw new Error("No se encontró la sesión activa.");

  let currentSession = session as SessionData;

  // 2. Guardar mensaje del usuario
  const userMsg: Message = { role: 'user', content: userContent, timestamp: Date.now() };
  let history = await addMessage(sessionId, currentSession.chat_history, userMsg);

  // 3. Transición: WAITING -> START_RESEARCH
  await updateSession(sessionId, { 
    company_info: userContent, 
    current_state: 'START_RESEARCH' 
  });
  
  // Respuesta inicial de Pedro
  await addMessage(sessionId, history, {
    role: 'agent',
    name: 'Pedro',
    content: `Entendido. Comienzo el análisis técnico para "${userContent}".`,
    timestamp: Date.now()
  });

  // Bucle de Investigación (Pedro)
  let researchResults = currentSession.research_results || [];
  let counter = 0;
  const MAX_RESEARCH_LOOPS = 2; // Cantidad de búsquedas

  while (counter < MAX_RESEARCH_LOOPS) {
    await updateSession(sessionId, { research_counter: counter + 1 });
    
    const finding = await runPedroAgent(userContent, counter + 1);
    researchResults.push(finding);
    
    // Pedro reporta hallazgo
    history = await addMessage(sessionId, history, {
      role: 'agent',
      name: 'Pedro',
      content: `[Hallazgo #${counter + 1}]: ${finding}`,
      timestamp: Date.now()
    });

    await updateSession(sessionId, { research_results: researchResults });
    counter++;
  }

  // 4. Transición: RESEARCH -> START_REPORT (Juan)
  await updateSession(sessionId, { current_state: 'START_REPORT' });

  // Juan toma el relevo
  await addMessage(sessionId, history, {
    role: 'agent',
    name: 'Juan',
    content: "Gracias Pedro. Excelente trabajo técnico. Procedo a estructurar la estrategia de negocio para el cliente.",
    timestamp: Date.now()
  });

  const finalReport = await runJuanAgent(userContent, researchResults);

  // Juan entrega el reporte
  history = await addMessage(sessionId, history, {
    role: 'agent',
    name: 'Juan',
    content: "Aquí tienes el Informe Ejecutivo Final.",
    timestamp: Date.now()
  });

  // 5. Finalizar
  await updateSession(sessionId, { 
    report_final: finalReport, 
    current_state: 'FINISHED',
    chat_history: history 
  });
}
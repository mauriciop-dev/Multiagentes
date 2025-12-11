import { GoogleGenAI } from "@google/genai";
import { supabase } from '../lib/supabase/supabase-client';
import { Message, SessionData } from '../lib/types';

// CONFIGURACIÓN DE GEMINI
// Obtenemos la API Key del entorno (inyectada por Vite)
// Nota: process.env es inyectado por vite.config.ts define
const getAI = () => {
  const key = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("Configuración incompleta: Falta la API_KEY de Gemini en las variables de entorno.");
  }
  return new GoogleGenAI({ apiKey: key });
};

// -- Helpers de Base de Datos (Client Side) --

async function updateSession(id: string, updates: Partial<SessionData>) {
  const { error } = await supabase
    .from('sessions')
    .update(updates)
    .eq('id', id);
  
  if (error) console.error('Error guardando estado en Supabase:', error);
}

async function addMessage(id: string, currentHistory: Message[] | null | undefined, newMessage: Message) {
  const safeHistory = Array.isArray(currentHistory) ? currentHistory : [];
  const updatedHistory = [...safeHistory, newMessage];
  
  // Guardado optimista para UX rápida
  await updateSession(id, { chat_history: updatedHistory });
  return updatedHistory;
}

// -- Agente 1: Pedro (Investigador Técnico) --
async function runPedroAgent(companyInfo: string, iteration: number): Promise<string> {
  try {
    const ai = getAI();
    const modelId = 'gemini-2.5-flash'; 
    
    const prompt = `
      Eres Pedro, un consultor técnico experto en IA e Ingeniería.
      Objetivo: Investigar oportunidades técnicas para: "${companyInfo}".
      Iteración de investigación: ${iteration}.
      
      Instrucciones:
      1. Busca tecnologías recientes, patentes o casos de uso digitales relevantes.
      2. Sé técnico, preciso y analítico.
      3. IMPORTANTE: Usa la herramienta de búsqueda de Google para fundamentar tu respuesta.
      4. Máximo 150 palabras.
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }], 
      },
    });

    let text = response.text || "No encontré información relevante en esta búsqueda.";

    // Procesamiento de Grounding (Fuentes de Google Search)
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks && chunks.length > 0) {
      const sources = chunks
        .map((chunk: any) => {
          if (chunk.web?.uri && chunk.web?.title) {
            return `[${chunk.web.title}](${chunk.web.uri})`;
          }
          return null;
        })
        .filter(Boolean);

      if (sources.length > 0) {
        const uniqueSources = Array.from(new Set(sources));
        text += `\n\n**Fuentes Verificadas:**\n${uniqueSources.map((s: unknown) => `- ${s}`).join('\n')}`;
      }
    }

    return text;
  } catch (error: any) {
    console.error("Error Agente Pedro:", error);
    return `[Error de Sistema - Pedro]: ${error.message || 'No se pudo completar la investigación.'}`;
  }
}

// -- Agente 2: Juan (Project Manager) --
async function runJuanAgent(companyInfo: string, researchResults: string[]): Promise<string> {
  try {
    const ai = getAI();
    const modelId = 'gemini-2.5-flash';
    
    const prompt = `
      Eres Juan, un Project Manager Senior y Estratega Digital.
      
      Contexto del Cliente: "${companyInfo}"
      
      Hallazgos Técnicos provistos por el Ing. Pedro:
      ${researchResults.map((r, i) => `--- Hallazgo ${i+1} ---\n${r}`).join('\n')}
      
      Tu Tarea:
      Generar un Informe Ejecutivo Final en formato Markdown limpio y profesional.
      
      Estructura del Informe:
      1. **Resumen Ejecutivo**: Traduce los hallazgos técnicos a valor de negocio (ROI, eficiencia).
      2. **Propuesta Estratégica**: 3 Soluciones de IA concretas basadas en la investigación de Pedro.
      3. **Hoja de Ruta**: Pasos inmediatos para la implementación.
      
      Tono: Profesional, visionario, directo.
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
    });

    return response.text || "No se pudo generar el informe final.";
  } catch (error: any) {
    console.error("Error Agente Juan:", error);
    return `[Error de Sistema - Juan]: ${error.message}`;
  }
}

// -- Orquestador Principal (Función invocada desde la UI) --
export async function processUserMessage(
  sessionId: string, 
  userContent: string
) {
  // 1. Recuperar estado actual desde Supabase
  const { data: session, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error || !session) throw new Error("Error de conexión con la base de datos.");

  let currentSession = session as SessionData;
  let history = currentSession.chat_history || [];

  // 2. Guardar mensaje del usuario
  const userMsg: Message = { role: 'user', content: userContent, timestamp: Date.now() };
  history = await addMessage(sessionId, history, userMsg);

  // 3. Iniciar Flujo
  await updateSession(sessionId, { 
    company_info: userContent, 
    current_state: 'START_RESEARCH' 
  });

  // Saludo de Pedro
  history = await addMessage(sessionId, history, {
    role: 'agent',
    name: 'Pedro',
    content: `Entendido. Inicio el análisis técnico de profundidad para "${userContent}".`,
    timestamp: Date.now()
  });

  // 4. Bucle de Investigación (Pedro) - 2 Iteraciones
  let researchResults: string[] = [];
  const MAX_RESEARCH_LOOPS = 2;

  for (let i = 0; i < MAX_RESEARCH_LOOPS; i++) {
    await updateSession(sessionId, { research_counter: i + 1 });
    
    // Llamada a Gemini (Pedro)
    const finding = await runPedroAgent(userContent, i + 1);
    researchResults.push(finding);
    
    history = await addMessage(sessionId, history, {
      role: 'agent',
      name: 'Pedro',
      content: `🔍 **Investigación - Fase ${i + 1}**\n\n${finding}`,
      timestamp: Date.now()
    });

    await updateSession(sessionId, { research_results: researchResults });
  }

  // 5. Generación de Reporte (Juan)
  await updateSession(sessionId, { current_state: 'START_REPORT' });

  history = await addMessage(sessionId, history, {
    role: 'agent',
    name: 'Juan',
    content: "Gracias Pedro por los datos técnicos. Procedo a elaborar la estrategia de negocio y el informe ejecutivo.",
    timestamp: Date.now()
  });

  // Llamada a Gemini (Juan)
  const finalReport = await runJuanAgent(userContent, researchResults);

  history = await addMessage(sessionId, history, {
    role: 'agent',
    name: 'Juan',
    content: "He completado el análisis estratégico. Aquí tienes el Informe Ejecutivo Final.",
    timestamp: Date.now()
  });

  // 6. Finalizar Sesión
  await updateSession(sessionId, { 
    report_final: finalReport, 
    current_state: 'FINISHED',
    chat_history: history 
  });
}
import { GoogleGenAI } from "@google/genai";
import { createClient } from '@supabase/supabase-js';
import { Message, SessionData } from '../lib/types';
import { supabase as clientSupabase } from '../lib/supabase/supabase-client';

// Safe env getter
const getEnv = (key: string) => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key];
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) return import.meta.env[key];
  return undefined;
};

// Lazy initialization helpers
function getAI() {
  const apiKey = getEnv('API_KEY');
  if (!apiKey) {
    console.error("API_KEY missing. Ensure it is set in Vercel or .env");
    throw new Error("API_KEY is not set");
  }
  return new GoogleGenAI({ apiKey });
}

function getSupabase() {
  // If we are on the server and have the secret key, use it (bypasses RLS)
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
  
  if (serviceKey && url) {
    return createClient(url, serviceKey);
  }
  
  // Fallback to client-side auth (requires RLS policy for UPDATE)
  console.warn("Using Client Supabase (ensure RLS allows updates)");
  return clientSupabase;
}

async function updateSession(id: string, updates: Partial<SessionData>) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('sessions')
    .update(updates)
    .eq('id', id);
  
  if (error) console.error('Error updating session:', error);
}

async function addMessage(id: string, currentHistory: Message[], newMessage: Message) {
  const updatedHistory = [...currentHistory, newMessage];
  await updateSession(id, { chat_history: updatedHistory });
  return updatedHistory;
}

// -- Agent: Pedro (AI Engineer) --
async function runPedroAgent(companyInfo: string, iteration: number): Promise<string> {
  const ai = getAI();
  const modelId = 'gemini-2.5-flash';
  
  const prompt = `
    Act as Pedro, a specialized AI Engineer consultant.
    Your goal is to research technical opportunities for the following company/topic: "${companyInfo}".
    
    This is iteration number ${iteration} of your research.
    Focus on finding specific recent news, technologies, or digital transformation opportunities.
    
    Keep your response concise (under 150 words), technical, and objective.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    return response.text || "No se encontraron datos específicos en esta iteración.";
  } catch (error) {
    console.error("Pedro Error:", error);
    return "Tuve un problema técnico al conectar con la base de conocimientos.";
  }
}

// -- Agent: Juan (Project Manager) --
async function runJuanAgent(companyInfo: string, researchResults: string[]): Promise<string> {
  const ai = getAI();
  const modelId = 'gemini-2.5-flash';
  
  const prompt = `
    Act as Juan, a Senior Project Manager and Digital Strategist.
    
    Context:
    Client Interest: "${companyInfo}"
    
    Technical Findings (from Pedro, our Engineer):
    ${researchResults.map((r, i) => `Finding ${i + 1}: ${r}`).join('\n')}
    
    Task:
    Write a final Executive Report for the client.
    1. Summarize the key technical findings in business terms.
    2. Propose 3 concrete AI-driven solutions.
    3. Use a professional, empathetic, and strategic tone.
    4. Format with Markdown (headers, bullet points).
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
    });

    return response.text || "No pude generar el reporte final.";
  } catch (error) {
    console.error("Juan Error:", error);
    return "Error al generar el reporte ejecutivo.";
  }
}

// -- Main Orchestrator --
export async function processUserMessage(sessionId: string, userId: string, userContent: string) {
  const supabase = getSupabase();

  // 1. Fetch current session state
  const { data: session, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error || !session) throw new Error("Session not found");

  let currentSession = session as SessionData;

  // 2. Add User Message
  const userMsg: Message = { role: 'user', content: userContent, timestamp: Date.now() };
  let history = await addMessage(sessionId, currentSession.chat_history, userMsg);

  // 3. State Transition: WAITING -> START_RESEARCH
  await updateSession(sessionId, { 
    company_info: userContent, 
    current_state: 'START_RESEARCH' 
  });
  
  // Message from Pedro acknowledging receipt
  await addMessage(sessionId, history, {
    role: 'agent',
    name: 'Pedro',
    content: `Entendido. Iniciando análisis técnico sobre "${userContent}". Dame un momento para investigar fuentes recientes.`,
    timestamp: Date.now()
  });

  // LOOP Logic
  let researchResults = currentSession.research_results || [];
  let counter = 0;
  const MAX_RESEARCH_LOOPS = 2; 

  while (counter < MAX_RESEARCH_LOOPS) {
    await updateSession(sessionId, { current_state: 'START_RESEARCH', research_counter: counter + 1 });
    
    const finding = await runPedroAgent(userContent, counter + 1);
    researchResults.push(finding);
    
    history = await addMessage(sessionId, history, {
      role: 'agent',
      name: 'Pedro',
      content: `[Hallazgo Técnico #${counter + 1}]: ${finding}`,
      timestamp: Date.now()
    });

    await updateSession(sessionId, { research_results: researchResults });
    counter++;
  }

  // --- TRANSITION TO JUAN ---
  await updateSession(sessionId, { current_state: 'START_REPORT' });

  await addMessage(sessionId, history, {
    role: 'agent',
    name: 'Juan',
    content: "Gracias Pedro. Analizaré estos datos para preparar la propuesta estratégica para el cliente.",
    timestamp: Date.now()
  });

  const finalReport = await runJuanAgent(userContent, researchResults);

  history = await addMessage(sessionId, history, {
    role: 'agent',
    name: 'Juan',
    content: "Aquí tienes el Informe Ejecutivo Final basado en nuestro análisis:",
    timestamp: Date.now()
  });

  await updateSession(sessionId, { 
    report_final: finalReport, 
    current_state: 'FINISHED',
    chat_history: history 
  });
}
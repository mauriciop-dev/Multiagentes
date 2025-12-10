import { GoogleGenAI } from "@google/genai";
import { createClient } from '@supabase/supabase-js';
import { Message, SessionData } from '../lib/types';
import { supabase as clientSupabase } from '../lib/supabase/supabase-client';

// Helper: Get Google AI Instance
function getAI() {
  // Access directly from process.env for Server Environment
  const apiKey = process.env.API_KEY; 
  if (!apiKey) {
    throw new Error("API_KEY no encontrada en variables de entorno.");
  }
  return new GoogleGenAI({ apiKey });
}

// Helper: Get Supabase Admin Instance (Bypass RLS)
function getSupabase() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  
  // If we have the Service Role Key (Server Side), use it to bypass permissions
  if (serviceKey && url) {
    return createClient(url, serviceKey);
  }
  
  // Fallback to client instance (Subject to RLS)
  return clientSupabase;
}

// ... Rest of the functions remain the same logic, just ensuring imports are clean ...

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
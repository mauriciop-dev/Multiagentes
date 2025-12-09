'use server';

import { GoogleGenAI } from "@google/genai";
import { createClient } from '@supabase/supabase-js';
import { Message, SessionData, WorkflowState } from '../lib/types';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Initialize Supabase Admin (Service Role needed for server-side updates without session context if needed, 
// or standard client if we trust the RLS policies for the passed ID. 
// Ideally use Service Role for backend logic to bypass RLS for bot updates.)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function updateSession(id: string, updates: Partial<SessionData>) {
  const { error } = await supabaseAdmin
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
// Focus: Google Search, Technical analysis
async function runPedroAgent(companyInfo: string, iteration: number): Promise<string> {
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
        tools: [{ googleSearch: {} }], // Grounding with Google Search
      },
    });

    return response.text || "No se encontraron datos específicos en esta iteración.";
  } catch (error) {
    console.error("Pedro Error:", error);
    return "Tuve un problema técnico al conectar con la base de conocimientos.";
  }
}

// -- Agent: Juan (Project Manager) --
// Focus: Synthesis, Business Value, Final Report
async function runJuanAgent(companyInfo: string, researchResults: string[]): Promise<string> {
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

// -- Main Orchestrator (LangGraph Simulation) --
export async function processUserMessage(sessionId: string, userId: string, userContent: string) {
  // 1. Fetch current session state
  const { data: session, error } = await supabaseAdmin
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
  
  // -- Trigger Agent Loop --
  // Note: In a real serverless env like Vercel, long-running processes might timeout. 
  // We will execute the logic sequentially here, updating DB at each step so UI updates in realtime.
  
  // LOOP Logic: Research (Simulating 3 steps or until satisfied)
  let researchResults = currentSession.research_results || [];
  let counter = 0;
  const MAX_RESEARCH_LOOPS = 2; // Keep it short for demo speed

  // Message from Pedro acknowledging receipt
  await addMessage(sessionId, history, {
    role: 'agent',
    name: 'Pedro',
    content: `Entendido. Iniciando análisis técnico sobre "${userContent}". Dame un momento para investigar fuentes recientes.`,
    timestamp: Date.now()
  });

  // --- NODE: PEDRO & DECISION ---
  while (counter < MAX_RESEARCH_LOOPS) {
    // Update State
    await updateSession(sessionId, { current_state: 'START_RESEARCH', research_counter: counter + 1 });
    
    // Pedro Works
    const finding = await runPedroAgent(userContent, counter + 1);
    researchResults.push(finding);
    
    // Pedro Reports back to Chat
    history = await addMessage(sessionId, history, {
      role: 'agent',
      name: 'Pedro',
      content: `[Hallazgo Técnico #${counter + 1}]: ${finding}`,
      timestamp: Date.now()
    });

    // Update DB with results
    await updateSession(sessionId, { research_results: researchResults });
    counter++;
  }

  // --- TRANSITION TO JUAN ---
  await updateSession(sessionId, { current_state: 'START_REPORT' });

  // Message from Juan taking over
  await addMessage(sessionId, history, {
    role: 'agent',
    name: 'Juan',
    content: "Gracias Pedro. Analizaré estos datos para preparar la propuesta estratégica para el cliente.",
    timestamp: Date.now()
  });

  // --- NODE: JUAN ---
  const finalReport = await runJuanAgent(userContent, researchResults);

  // Juan delivers report
  history = await addMessage(sessionId, history, {
    role: 'agent',
    name: 'Juan',
    content: "Aquí tienes el Informe Ejecutivo Final basado en nuestro análisis:",
    timestamp: Date.now()
  });

  // Save Report and Finish
  await updateSession(sessionId, { 
    report_final: finalReport, 
    current_state: 'FINISHED',
    chat_history: history // Ensure history is perfectly synced
  });
}

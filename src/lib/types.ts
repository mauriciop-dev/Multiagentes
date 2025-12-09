export type AgentRole = 'user' | 'agent';
export type AgentName = 'Pedro' | 'Juan' | null;

export interface Message {
  role: AgentRole;
  name?: AgentName;
  content: string;
  timestamp: number;
}

export type WorkflowState = 
  | 'WAITING_FOR_INFO' 
  | 'START_RESEARCH' 
  | 'DECIDE_FLOW' 
  | 'START_REPORT' 
  | 'FINISHED';

export interface SessionData {
  id: string;
  user_id: string;
  chat_history: Message[];
  company_info: string;
  research_results: string[];
  report_final: string;
  current_state: WorkflowState;
  research_counter: number;
}

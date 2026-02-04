export interface QuickChatRequest {
  agentId: string;
  prompt: string;
  cwd: string;
}

export interface QuickChatResponse {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
}

export interface QuickChatOutputEvent {
  data: string;
  isComplete: boolean;
}

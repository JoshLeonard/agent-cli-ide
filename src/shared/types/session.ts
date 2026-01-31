export type SessionType = 'attached' | 'isolated';
export type SessionStatus = 'initializing' | 'running' | 'terminated' | 'error';

export interface SessionConfig {
  type: SessionType;
  cwd: string;
  branch?: string;  // For isolated sessions
  shell?: string;   // Override default shell
  agentId?: string; // Reference to AgentConfig.id
}

export interface SessionInfo {
  id: string;
  type: SessionType;
  cwd: string;
  branch?: string;
  worktreePath?: string;
  status: SessionStatus;
  createdAt: number;
  pid?: number;
  agentId?: string;    // Reference to AgentConfig.id
  agentName?: string;  // Display name for UI
  agentIcon?: string;  // Icon for UI
}

export interface SessionCreateResult {
  success: boolean;
  session?: SessionInfo;
  error?: string;
}

export interface LayoutPane {
  id: string;
  sessionId?: string;
  row: number;
  col: number;
  rowSpan?: number;
  colSpan?: number;
}

export interface LayoutState {
  panes: LayoutPane[];
  rows: number;
  cols: number;
  rowSizes?: number[];  // e.g., [0.3, 0.7] - fractions summing to 1
  colSizes?: number[];  // e.g., [0.5, 0.5]
}

export interface PersistedState {
  sessions: SessionInfo[];
  layout: LayoutState;
  lastSaved: number;
}

export type AgentActivityState = 'idle' | 'working' | 'waiting_for_input' | 'error';

export type StateSource = 'hook' | 'pattern' | 'timeout';

export interface FileChange {
  path: string;
  type: 'created' | 'modified' | 'deleted';
  timestamp: number;
}

export interface AgentStatus {
  sessionId: string;
  activityState: AgentActivityState;
  lastActivityTimestamp: number;
  taskSummary: string | null;
  recentFileChanges: FileChange[];
  errorMessage: string | null;
  stateSource: StateSource;
  hookAvailable: boolean;
}

export interface HookStateEvent {
  sessionId: string;
  state: AgentActivityState;
  timestamp: number;
}

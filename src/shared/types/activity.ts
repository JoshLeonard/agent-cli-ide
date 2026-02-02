export type ActivityType =
  | 'file_created'
  | 'file_modified'
  | 'file_deleted'
  | 'error'
  | 'warning'
  | 'task_completed'
  | 'command_executed'
  | 'git_commit';

export type ActivitySeverity = 'info' | 'warning' | 'error' | 'success';

export interface ActivityEvent {
  id: string;
  sessionId: string;
  agentId?: string;
  agentName?: string;
  agentIcon?: string;
  type: ActivityType;
  severity: ActivitySeverity;
  timestamp: number;
  title: string;
  details?: string;
  filePath?: string;
}

export interface ActivityFilter {
  sessionIds?: string[];
  types?: ActivityType[];
  severities?: ActivitySeverity[];
  fromTimestamp?: number;
  toTimestamp?: number;
  limit?: number;
  offset?: number;
}

import type { SessionConfig, SessionInfo, SessionCreateResult } from './session';
import type { PersistedLayoutState } from './layout';
import type { AgentConfig } from './agent';
import type { ProjectInfo } from './project';
import type { WorktreeInfo, WorktreeResult } from './worktree';
import type { AgentStatus } from './agentStatus';
import type { ActivityEvent, ActivityFilter } from './activity';
import type { InterSessionMessage, SharedClipboard, MessageSendOptions } from './messaging';
import type { Settings, PartialSettings } from './settings';
import type {
  FileReviewRequest,
  FileReviewResult,
  FileSaveRequest,
  FileSaveResult,
  FileRevertRequest,
  FileRevertResult,
} from './fileReview';

export interface RecentProject {
  path: string;
  name: string;
  lastOpened: number;
}

export interface PersistedState {
  sessions: SessionInfo[];
  layout: PersistedLayoutState;
  lastSaved: number;
  projectPath?: string;
  recentProjects?: RecentProject[];
  worktreeAgentPrefs?: Record<string, string>; // worktreePath → agentId
}

// Request/Response channels (invoke/handle)
export interface IpcChannels {
  'session:create': {
    request: SessionConfig;
    response: SessionCreateResult;
  };
  'session:terminate': {
    request: { sessionId: string };
    response: { success: boolean; error?: string };
  };
  'session:write': {
    request: { sessionId: string; data: string };
    response: void;
  };
  'session:resize': {
    request: { sessionId: string; cols: number; rows: number };
    response: void;
  };
  'session:list': {
    request: void;
    response: SessionInfo[];
  };
  'session:get': {
    request: { sessionId: string };
    response: SessionInfo | null;
  };
  'layout:save': {
    request: PersistedLayoutState;
    response: { success: boolean };
  };
  'layout:load': {
    request: void;
    response: PersistedLayoutState | null;
  };
  'persistence:restore': {
    request: void;
    response: PersistedState | null;
  };
  'dialog:selectDirectory': {
    request: void;
    response: string | null;
  };
  'agent:list': {
    request: void;
    response: AgentConfig[];
  };
  'agent:listAvailable': {
    request: void;
    response: AgentConfig[];
  };
  'agent:discover': {
    request: void;
    response: AgentConfig[];
  };
  'agent:getDefault': {
    request: void;
    response: AgentConfig | undefined;
  };
  'agent:get': {
    request: { agentId: string };
    response: AgentConfig | undefined;
  };
  'project:open': {
    request: { path: string };
    response: { success: boolean; project?: ProjectInfo; error?: string };
  };
  'project:close': {
    request: void;
    response: { success: boolean };
  };
  'project:getCurrent': {
    request: void;
    response: ProjectInfo | null;
  };
  'project:getRecent': {
    request: void;
    response: RecentProject[];
  };
  'worktree:list': {
    request: { repoPath: string };
    response: WorktreeInfo[];
  };
  'worktree:remove': {
    request: { worktreePath: string };
    response: WorktreeResult;
  };
  'worktree:cleanOrphaned': {
    request: void;
    response: string[];
  };
  'worktree:isGitRepo': {
    request: { path: string };
    response: boolean;
  };
  'worktree:getAgentPrefs': {
    request: void;
    response: Record<string, string>;
  };
  'worktree:setAgentPref': {
    request: { worktreePath: string; agentId: string };
    response: { success: boolean };
  };
  // Agent Status
  'agentStatus:get': {
    request: { sessionId: string };
    response: AgentStatus | null;
  };
  'agentStatus:getAll': {
    request: void;
    response: AgentStatus[];
  };
  // Activity Feed
  'activity:getEvents': {
    request: ActivityFilter;
    response: ActivityEvent[];
  };
  'activity:clearEvents': {
    request: { sessionId?: string };
    response: { success: boolean };
  };
  // Messaging
  'messaging:send': {
    request: {
      targetSessionIds: string[];
      content: string;
      options?: MessageSendOptions;
    };
    response: { success: boolean; messageId?: string; error?: string };
  };
  'messaging:broadcast': {
    request: {
      content: string;
      options?: MessageSendOptions;
      excludeSessionId?: string;
    };
    response: { success: boolean; messageId?: string; targetCount?: number; error?: string };
  };
  'messaging:setClipboard': {
    request: { content: string; sourceSessionId: string };
    response: { success: boolean };
  };
  'messaging:getClipboard': {
    request: void;
    response: SharedClipboard | null;
  };
  // Window controls
  'window:minimize': {
    request: void;
    response: void;
  };
  'window:maximize': {
    request: void;
    response: void;
  };
  'window:close': {
    request: void;
    response: void;
  };
  'window:isMaximized': {
    request: void;
    response: boolean;
  };
  'window:getPlatform': {
    request: void;
    response: NodeJS.Platform;
  };
  // Settings
  'settings:get': {
    request: void;
    response: Settings;
  };
  'settings:update': {
    request: PartialSettings;
    response: Settings;
  };
  'settings:reset': {
    request: void;
    response: Settings;
  };
  // File Review
  'fileReview:getDiff': {
    request: FileReviewRequest;
    response: FileReviewResult;
  };
  'fileReview:saveFile': {
    request: FileSaveRequest;
    response: FileSaveResult;
  };
  'fileReview:revertFile': {
    request: FileRevertRequest;
    response: FileRevertResult;
  };
}

// Event channels (send/on)
export interface IpcEvents {
  'session:output': {
    sessionId: string;
    data: string;
  };
  'session:terminated': {
    sessionId: string;
    exitCode?: number;
  };
  'session:updated': {
    session: SessionInfo;
  };
  'project:updated': {
    project: ProjectInfo;
  };
  'agentStatus:updated': {
    status: AgentStatus;
  };
  'activity:event': {
    event: ActivityEvent;
  };
  'message:sent': {
    message: InterSessionMessage;
  };
  'message:received': {
    message: InterSessionMessage;
    targetSessionId: string;
  };
  'worktree:changed': {
    projectPath: string;
  };
  'window:maximizeChanged': {
    isMaximized: boolean;
  };
  'settings:updated': {
    settings: Settings;
  };
}

export type IpcChannel = keyof IpcChannels;
export type IpcEvent = keyof IpcEvents;

// Re-export worktree types for convenience
export type { WorktreeInfo, WorktreeResult } from './worktree';

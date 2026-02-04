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
import type {
  DebugAttachConfig,
  DebugSessionInfo,
  DebugSessionState,
  DebugEventFilter,
  DebugConsoleMessage,
  DebugException,
  DebugVariable,
  DebugBreakpoint,
  StackFrame,
  DAPPreset,
} from './debug';
import type {
  GitStatusResult,
  GitBranchListResult,
  GitLogResult,
  GitDiffResult,
  GitStashListResult,
  GitTagListResult,
  GitRemoteListResult,
  GitOperationResult,
  GitCommitResult,
  GitPushResult,
  GitPullResult,
  GitFetchResult,
  GitMergeResult,
  GitStageRequest,
  GitUnstageRequest,
  GitCommitRequest,
  GitPushRequest,
  GitPullRequest,
  GitFetchRequest,
  GitBranchCreateRequest,
  GitBranchDeleteRequest,
  GitCheckoutRequest,
  GitMergeRequest,
  GitStashRequest,
  GitStashApplyRequest,
  GitStashDropRequest,
  GitLogRequest,
  GitDiffRequest,
  GitDiscardRequest,
} from './git';

export interface RecentProject {
  path: string;
  name: string;
  lastOpened: number;
}

export interface ProjectState {
  sessions: SessionInfo[];
  layout: PersistedLayoutState;
  worktreeAgentPrefs?: Record<string, string>; // worktreePath → agentId
}

export interface PersistedState {
  // Legacy flat fields (for backward compatibility during migration)
  sessions?: SessionInfo[];
  layout?: PersistedLayoutState;
  worktreeAgentPrefs?: Record<string, string>;

  // New per-project state
  projectStates?: Record<string, ProjectState>; // keyed by project path

  lastSaved: number;
  projectPath?: string; // Current/last opened project path
  recentProjects?: RecentProject[];
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

  // Debug session management
  'debug:attach': {
    request: { sessionId: string; config: DebugAttachConfig };
    response: { success: boolean; debugSessionId?: string; error?: string };
  };
  'debug:detach': {
    request: { sessionId: string };
    response: { success: boolean; error?: string };
  };
  'debug:getSession': {
    request: { sessionId: string };
    response: DebugSessionInfo | null;
  };
  'debug:getAllSessions': {
    request: void;
    response: DebugSessionInfo[];
  };

  // Debug queries
  'debug:getConsoleMessages': {
    request: DebugEventFilter;
    response: DebugConsoleMessage[];
  };
  'debug:getExceptions': {
    request: DebugEventFilter;
    response: DebugException[];
  };
  'debug:getCallStack': {
    request: { sessionId: string };
    response: StackFrame[];
  };
  'debug:getScopes': {
    request: { sessionId: string; frameId: number };
    response: { scopes: { name: string; variablesReference: number }[] };
  };
  'debug:getVariables': {
    request: { sessionId: string; variablesReference: number };
    response: DebugVariable[];
  };

  // Breakpoint management
  'debug:setBreakpoints': {
    request: { sessionId: string; source: string; breakpoints: { line: number; condition?: string }[] };
    response: { breakpoints: DebugBreakpoint[] };
  };
  'debug:removeBreakpoint': {
    request: { sessionId: string; breakpointId: string };
    response: { success: boolean };
  };

  // Execution controls
  'debug:continue': {
    request: { sessionId: string };
    response: { success: boolean; error?: string };
  };
  'debug:pause': {
    request: { sessionId: string };
    response: { success: boolean; error?: string };
  };
  'debug:stepOver': {
    request: { sessionId: string };
    response: { success: boolean; error?: string };
  };
  'debug:stepInto': {
    request: { sessionId: string };
    response: { success: boolean; error?: string };
  };
  'debug:stepOut': {
    request: { sessionId: string };
    response: { success: boolean; error?: string };
  };

  // Expression evaluation
  'debug:evaluate': {
    request: { sessionId: string; expression: string; frameId?: number };
    response: { result: string; type?: string; variablesReference?: number; error?: string };
  };

  // DAP presets
  'debug:getDAPPresets': {
    request: void;
    response: Record<DAPPreset, { name: string; adapterPath: string; installCommand: string }>;
  };

  // Debug HTTP API management
  'debug:enableApi': {
    request: { sessionId: string; workdir: string };
    response: { success: boolean; apiUrl?: string; token?: string; error?: string };
  };
  'debug:disableApi': {
    request: { sessionId: string; workdir: string };
    response: { success: boolean; error?: string };
  };
  'debug:getApiStatus': {
    request: void;
    response: { running: boolean; port?: number; url?: string };
  };

  // Git Operations
  'git:status': {
    request: { repoPath: string };
    response: GitStatusResult;
  };
  'git:stage': {
    request: GitStageRequest;
    response: GitOperationResult;
  };
  'git:stageAll': {
    request: { repoPath: string };
    response: GitOperationResult;
  };
  'git:unstage': {
    request: GitUnstageRequest;
    response: GitOperationResult;
  };
  'git:unstageAll': {
    request: { repoPath: string };
    response: GitOperationResult;
  };
  'git:discard': {
    request: GitDiscardRequest;
    response: GitOperationResult;
  };
  'git:commit': {
    request: GitCommitRequest;
    response: GitCommitResult;
  };
  'git:push': {
    request: GitPushRequest;
    response: GitPushResult;
  };
  'git:pull': {
    request: GitPullRequest;
    response: GitPullResult;
  };
  'git:fetch': {
    request: GitFetchRequest;
    response: GitFetchResult;
  };
  'git:branches': {
    request: { repoPath: string; includeRemote?: boolean };
    response: GitBranchListResult;
  };
  'git:createBranch': {
    request: GitBranchCreateRequest;
    response: GitOperationResult;
  };
  'git:deleteBranch': {
    request: GitBranchDeleteRequest;
    response: GitOperationResult;
  };
  'git:checkout': {
    request: GitCheckoutRequest;
    response: GitOperationResult;
  };
  'git:merge': {
    request: GitMergeRequest;
    response: GitMergeResult;
  };
  'git:abortMerge': {
    request: { repoPath: string };
    response: GitOperationResult;
  };
  'git:log': {
    request: GitLogRequest;
    response: GitLogResult;
  };
  'git:diff': {
    request: GitDiffRequest;
    response: GitDiffResult;
  };
  'git:stashes': {
    request: { repoPath: string };
    response: GitStashListResult;
  };
  'git:stash': {
    request: GitStashRequest;
    response: GitOperationResult;
  };
  'git:stashApply': {
    request: GitStashApplyRequest;
    response: GitOperationResult;
  };
  'git:stashDrop': {
    request: GitStashDropRequest;
    response: GitOperationResult;
  };
  'git:tags': {
    request: { repoPath: string };
    response: GitTagListResult;
  };
  'git:remotes': {
    request: { repoPath: string };
    response: GitRemoteListResult;
  };

  // Auto-updater
  'updater:check': {
    request: void;
    response: { version: string; releaseDate: string } | null;
  };
  'updater:download': {
    request: void;
    response: boolean;
  };
  'updater:install': {
    request: void;
    response: boolean;
  };
  'updater:get-version': {
    request: void;
    response: string;
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

  // Debug events
  'debug:sessionCreated': {
    session: DebugSessionInfo;
  };
  'debug:sessionStateChanged': {
    sessionId: string;
    state: DebugSessionState;
    pausedAt?: DebugSessionInfo['pausedAt'];
    callStack?: StackFrame[];
  };
  'debug:consoleMessage': {
    message: DebugConsoleMessage;
  };
  'debug:exception': {
    exception: DebugException;
  };
  'debug:breakpointHit': {
    sessionId: string;
    breakpoint: DebugBreakpoint;
    callStack: StackFrame[];
  };

  // Git events
  'git:statusChanged': {
    repoPath: string;
  };

  // Updater events
  'updater:status': {
    status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
    info?: { version: string; releaseDate: string };
    progress?: number;
    error?: string;
  };
}

export type IpcChannel = keyof IpcChannels;
export type IpcEvent = keyof IpcEvents;

// Re-export worktree types for convenience
export type { WorktreeInfo, WorktreeResult } from './worktree';

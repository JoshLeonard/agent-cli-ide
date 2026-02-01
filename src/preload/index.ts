import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type {
  SessionConfig,
  SessionInfo,
  SessionCreateResult,
} from '../shared/types/session';
import type { PersistedLayoutState } from '../shared/types/layout';
import type { PersistedState, RecentProject } from '../shared/types/ipc';
import type { AgentConfig } from '../shared/types/agent';
import type { ProjectInfo } from '../shared/types/project';
import type { IpcEvents, WorktreeInfo, WorktreeResult } from '../shared/types/ipc';
import type { AgentStatus } from '../shared/types/agentStatus';
import type { ActivityEvent, ActivityFilter } from '../shared/types/activity';
import type { SharedClipboard, MessageSendOptions } from '../shared/types/messaging';
import type { Settings, PartialSettings } from '../shared/types/settings';
import type {
  FileReviewResult,
  FileSaveResult,
  FileRevertResult,
} from '../shared/types/fileReview';

type EventCallback<T> = (data: T) => void;

/**
 * Creates a type-safe event subscriber for an IPC event.
 * Returns a function that takes a callback and returns an unsubscribe function.
 */
function createEventSubscriber<K extends keyof IpcEvents>(eventName: K) {
  return (callback: EventCallback<IpcEvents[K]>) => {
    const handler = (_event: IpcRendererEvent, data: IpcEvents[K]) => callback(data);
    ipcRenderer.on(eventName, handler);
    return () => ipcRenderer.removeListener(eventName, handler);
  };
}

const api = {
  // Session management
  session: {
    create: (config: SessionConfig): Promise<SessionCreateResult> =>
      ipcRenderer.invoke('session:create', config),

    terminate: (sessionId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('session:terminate', { sessionId }),

    write: (sessionId: string, data: string): Promise<void> =>
      ipcRenderer.invoke('session:write', { sessionId, data }),

    resize: (sessionId: string, cols: number, rows: number): Promise<void> =>
      ipcRenderer.invoke('session:resize', { sessionId, cols, rows }),

    list: (): Promise<SessionInfo[]> =>
      ipcRenderer.invoke('session:list'),

    get: (sessionId: string): Promise<SessionInfo | null> =>
      ipcRenderer.invoke('session:get', { sessionId }),

    onOutput: createEventSubscriber('session:output'),
    onTerminated: createEventSubscriber('session:terminated'),
    onUpdated: createEventSubscriber('session:updated'),
  },

  // Layout persistence
  layout: {
    save: (layout: PersistedLayoutState): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('layout:save', layout),

    load: (): Promise<PersistedLayoutState | null> =>
      ipcRenderer.invoke('layout:load'),
  },

  // Full state persistence
  persistence: {
    restore: (): Promise<PersistedState | null> =>
      ipcRenderer.invoke('persistence:restore'),
  },

  // Dialogs
  dialog: {
    selectDirectory: (): Promise<string | null> =>
      ipcRenderer.invoke('dialog:selectDirectory'),
  },

  // Agent management
  agent: {
    list: (): Promise<AgentConfig[]> =>
      ipcRenderer.invoke('agent:list'),

    listAvailable: (): Promise<AgentConfig[]> =>
      ipcRenderer.invoke('agent:listAvailable'),

    discover: (): Promise<AgentConfig[]> =>
      ipcRenderer.invoke('agent:discover'),

    getDefault: (): Promise<AgentConfig | undefined> =>
      ipcRenderer.invoke('agent:getDefault'),

    get: (agentId: string): Promise<AgentConfig | undefined> =>
      ipcRenderer.invoke('agent:get', { agentId }),
  },

  // Project management
  project: {
    open: (path: string): Promise<{ success: boolean; project?: ProjectInfo; error?: string }> =>
      ipcRenderer.invoke('project:open', { path }),

    close: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('project:close'),

    getCurrent: (): Promise<ProjectInfo | null> =>
      ipcRenderer.invoke('project:getCurrent'),

    getRecent: (): Promise<RecentProject[]> =>
      ipcRenderer.invoke('project:getRecent'),

    onUpdated: createEventSubscriber('project:updated'),
  },

  // Worktree management
  worktree: {
    list: (repoPath: string): Promise<WorktreeInfo[]> =>
      ipcRenderer.invoke('worktree:list', { repoPath }),

    remove: (worktreePath: string): Promise<WorktreeResult> =>
      ipcRenderer.invoke('worktree:remove', { worktreePath }),

    cleanOrphaned: (): Promise<string[]> =>
      ipcRenderer.invoke('worktree:cleanOrphaned'),

    isGitRepo: (path: string): Promise<boolean> =>
      ipcRenderer.invoke('worktree:isGitRepo', { path }),

    getAgentPrefs: (): Promise<Record<string, string>> =>
      ipcRenderer.invoke('worktree:getAgentPrefs'),

    setAgentPref: (worktreePath: string, agentId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('worktree:setAgentPref', { worktreePath, agentId }),

    onChanged: createEventSubscriber('worktree:changed'),
  },

  // Agent status
  agentStatus: {
    get: (sessionId: string): Promise<AgentStatus | null> =>
      ipcRenderer.invoke('agentStatus:get', { sessionId }),

    getAll: (): Promise<AgentStatus[]> =>
      ipcRenderer.invoke('agentStatus:getAll'),

    onUpdated: createEventSubscriber('agentStatus:updated'),
  },

  // Activity feed
  activity: {
    getEvents: (filter: ActivityFilter): Promise<ActivityEvent[]> =>
      ipcRenderer.invoke('activity:getEvents', filter),

    clearEvents: (sessionId?: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('activity:clearEvents', { sessionId }),

    onEvent: createEventSubscriber('activity:event'),
  },

  // Messaging
  messaging: {
    send: (
      targetSessionIds: string[],
      content: string,
      options?: MessageSendOptions
    ): Promise<{ success: boolean; messageId?: string; error?: string }> =>
      ipcRenderer.invoke('messaging:send', { targetSessionIds, content, options }),

    broadcast: (
      content: string,
      options?: MessageSendOptions,
      excludeSessionId?: string
    ): Promise<{ success: boolean; messageId?: string; targetCount?: number; error?: string }> =>
      ipcRenderer.invoke('messaging:broadcast', { content, options, excludeSessionId }),

    setClipboard: (content: string, sourceSessionId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('messaging:setClipboard', { content, sourceSessionId }),

    getClipboard: (): Promise<SharedClipboard | null> =>
      ipcRenderer.invoke('messaging:getClipboard'),

    onSent: createEventSubscriber('message:sent'),
    onReceived: createEventSubscriber('message:received'),
  },

  // OS Clipboard
  clipboard: {
    readOS: (): Promise<string> =>
      ipcRenderer.invoke('clipboard:readOS'),
  },

  // Window controls
  window: {
    minimize: (): Promise<void> =>
      ipcRenderer.invoke('window:minimize'),

    maximize: (): Promise<void> =>
      ipcRenderer.invoke('window:maximize'),

    close: (): Promise<void> =>
      ipcRenderer.invoke('window:close'),

    isMaximized: (): Promise<boolean> =>
      ipcRenderer.invoke('window:isMaximized'),

    getPlatform: (): Promise<NodeJS.Platform> =>
      ipcRenderer.invoke('window:getPlatform'),

    onMaximizeChanged: createEventSubscriber('window:maximizeChanged'),
  },

  // Settings
  settings: {
    get: (): Promise<Settings> =>
      ipcRenderer.invoke('settings:get'),

    update: (partial: PartialSettings): Promise<Settings> =>
      ipcRenderer.invoke('settings:update', partial),

    reset: (): Promise<Settings> =>
      ipcRenderer.invoke('settings:reset'),

    onUpdated: createEventSubscriber('settings:updated'),
  },

  // File Review
  fileReview: {
    getDiff: (sessionId: string, filePath: string): Promise<FileReviewResult> =>
      ipcRenderer.invoke('fileReview:getDiff', { sessionId, filePath }),

    saveFile: (sessionId: string, filePath: string, content: string): Promise<FileSaveResult> =>
      ipcRenderer.invoke('fileReview:saveFile', { sessionId, filePath, content }),

    revertFile: (sessionId: string, filePath: string): Promise<FileRevertResult> =>
      ipcRenderer.invoke('fileReview:revertFile', { sessionId, filePath }),
  },

  // Debug
  debug: {
    // Session management
    attach: (sessionId: string, config: { protocol: string; host?: string; port?: number; language?: string }) =>
      ipcRenderer.invoke('debug:attach', { sessionId, config }),
    detach: (sessionId: string) =>
      ipcRenderer.invoke('debug:detach', { sessionId }),
    getSession: (sessionId: string) =>
      ipcRenderer.invoke('debug:getSession', { sessionId }),
    getAllSessions: () =>
      ipcRenderer.invoke('debug:getAllSessions'),

    // Queries
    getConsoleMessages: (filter: {
      sessionIds?: string[];
      levels?: ('log' | 'info' | 'warn' | 'error' | 'debug')[];
      fromTimestamp?: number;
      toTimestamp?: number;
      limit?: number;
      offset?: number;
    }) =>
      ipcRenderer.invoke('debug:getConsoleMessages', filter),
    getExceptions: (filter: {
      sessionIds?: string[];
      fromTimestamp?: number;
      toTimestamp?: number;
      limit?: number;
      offset?: number;
    }) =>
      ipcRenderer.invoke('debug:getExceptions', filter),
    getCallStack: (sessionId: string) =>
      ipcRenderer.invoke('debug:getCallStack', { sessionId }),
    getScopes: (sessionId: string, frameId: number) =>
      ipcRenderer.invoke('debug:getScopes', { sessionId, frameId }),
    getVariables: (sessionId: string, variablesReference: number) =>
      ipcRenderer.invoke('debug:getVariables', { sessionId, variablesReference }),

    // Breakpoints
    setBreakpoints: (sessionId: string, source: string, breakpoints: { line: number; condition?: string }[]) =>
      ipcRenderer.invoke('debug:setBreakpoints', { sessionId, source, breakpoints }),
    removeBreakpoint: (sessionId: string, breakpointId: string) =>
      ipcRenderer.invoke('debug:removeBreakpoint', { sessionId, breakpointId }),

    // Execution controls
    continue: (sessionId: string) =>
      ipcRenderer.invoke('debug:continue', { sessionId }),
    pause: (sessionId: string) =>
      ipcRenderer.invoke('debug:pause', { sessionId }),
    stepOver: (sessionId: string) =>
      ipcRenderer.invoke('debug:stepOver', { sessionId }),
    stepInto: (sessionId: string) =>
      ipcRenderer.invoke('debug:stepInto', { sessionId }),
    stepOut: (sessionId: string) =>
      ipcRenderer.invoke('debug:stepOut', { sessionId }),

    // Evaluation
    evaluate: (sessionId: string, expression: string, frameId?: number) =>
      ipcRenderer.invoke('debug:evaluate', { sessionId, expression, frameId }),

    // Events
    onSessionCreated: createEventSubscriber('debug:sessionCreated'),
    onSessionStateChanged: createEventSubscriber('debug:sessionStateChanged'),
    onConsoleMessage: createEventSubscriber('debug:consoleMessage'),
    onException: createEventSubscriber('debug:exception'),
    onBreakpointHit: createEventSubscriber('debug:breakpointHit'),
  },
};

contextBridge.exposeInMainWorld('terminalIDE', api);

// Type declaration for renderer
export type TerminalIDEApi = typeof api;

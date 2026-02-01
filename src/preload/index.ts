import { contextBridge, ipcRenderer } from 'electron';
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

type EventCallback<T> = (data: T) => void;

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

    onOutput: (callback: EventCallback<IpcEvents['session:output']>) => {
      const handler = (_event: Electron.IpcRendererEvent, data: IpcEvents['session:output']) => callback(data);
      ipcRenderer.on('session:output', handler);
      return () => ipcRenderer.removeListener('session:output', handler);
    },

    onTerminated: (callback: EventCallback<IpcEvents['session:terminated']>) => {
      const handler = (_event: Electron.IpcRendererEvent, data: IpcEvents['session:terminated']) => callback(data);
      ipcRenderer.on('session:terminated', handler);
      return () => ipcRenderer.removeListener('session:terminated', handler);
    },

    onUpdated: (callback: EventCallback<IpcEvents['session:updated']>) => {
      const handler = (_event: Electron.IpcRendererEvent, data: IpcEvents['session:updated']) => callback(data);
      ipcRenderer.on('session:updated', handler);
      return () => ipcRenderer.removeListener('session:updated', handler);
    },
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

    onUpdated: (callback: EventCallback<IpcEvents['project:updated']>) => {
      const handler = (_event: Electron.IpcRendererEvent, data: IpcEvents['project:updated']) => callback(data);
      ipcRenderer.on('project:updated', handler);
      return () => ipcRenderer.removeListener('project:updated', handler);
    },
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

    onChanged: (callback: EventCallback<IpcEvents['worktree:changed']>) => {
      const handler = (_event: Electron.IpcRendererEvent, data: IpcEvents['worktree:changed']) => callback(data);
      ipcRenderer.on('worktree:changed', handler);
      return () => ipcRenderer.removeListener('worktree:changed', handler);
    },
  },

  // Agent status
  agentStatus: {
    get: (sessionId: string): Promise<AgentStatus | null> =>
      ipcRenderer.invoke('agentStatus:get', { sessionId }),

    getAll: (): Promise<AgentStatus[]> =>
      ipcRenderer.invoke('agentStatus:getAll'),

    onUpdated: (callback: EventCallback<IpcEvents['agentStatus:updated']>) => {
      const handler = (_event: Electron.IpcRendererEvent, data: IpcEvents['agentStatus:updated']) => callback(data);
      ipcRenderer.on('agentStatus:updated', handler);
      return () => ipcRenderer.removeListener('agentStatus:updated', handler);
    },
  },

  // Activity feed
  activity: {
    getEvents: (filter: ActivityFilter): Promise<ActivityEvent[]> =>
      ipcRenderer.invoke('activity:getEvents', filter),

    clearEvents: (sessionId?: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('activity:clearEvents', { sessionId }),

    onEvent: (callback: EventCallback<IpcEvents['activity:event']>) => {
      const handler = (_event: Electron.IpcRendererEvent, data: IpcEvents['activity:event']) => callback(data);
      ipcRenderer.on('activity:event', handler);
      return () => ipcRenderer.removeListener('activity:event', handler);
    },
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

    onSent: (callback: EventCallback<IpcEvents['message:sent']>) => {
      const handler = (_event: Electron.IpcRendererEvent, data: IpcEvents['message:sent']) => callback(data);
      ipcRenderer.on('message:sent', handler);
      return () => ipcRenderer.removeListener('message:sent', handler);
    },

    onReceived: (callback: EventCallback<IpcEvents['message:received']>) => {
      const handler = (_event: Electron.IpcRendererEvent, data: IpcEvents['message:received']) => callback(data);
      ipcRenderer.on('message:received', handler);
      return () => ipcRenderer.removeListener('message:received', handler);
    },
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

    onMaximizeChanged: (callback: EventCallback<IpcEvents['window:maximizeChanged']>) => {
      const handler = (_event: Electron.IpcRendererEvent, data: IpcEvents['window:maximizeChanged']) => callback(data);
      ipcRenderer.on('window:maximizeChanged', handler);
      return () => ipcRenderer.removeListener('window:maximizeChanged', handler);
    },
  },

  // Settings
  settings: {
    get: (): Promise<Settings> =>
      ipcRenderer.invoke('settings:get'),

    update: (partial: PartialSettings): Promise<Settings> =>
      ipcRenderer.invoke('settings:update', partial),

    reset: (): Promise<Settings> =>
      ipcRenderer.invoke('settings:reset'),

    onUpdated: (callback: EventCallback<IpcEvents['settings:updated']>) => {
      const handler = (_event: Electron.IpcRendererEvent, data: IpcEvents['settings:updated']) => callback(data);
      ipcRenderer.on('settings:updated', handler);
      return () => ipcRenderer.removeListener('settings:updated', handler);
    },
  },
};

contextBridge.exposeInMainWorld('terminalIDE', api);

// Type declaration for renderer
export type TerminalIDEApi = typeof api;

import { contextBridge, ipcRenderer } from 'electron';
import type {
  SessionConfig,
  SessionInfo,
  SessionCreateResult,
  LayoutState,
  PersistedState,
} from '../shared/types/session';
import type { AgentConfig } from '../shared/types/agent';
import type { ProjectInfo } from '../shared/types/project';
import type { IpcEvents } from '../shared/types/ipc';

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
    save: (layout: LayoutState): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('layout:save', layout),

    load: (): Promise<LayoutState | null> =>
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

    onUpdated: (callback: EventCallback<IpcEvents['project:updated']>) => {
      const handler = (_event: Electron.IpcRendererEvent, data: IpcEvents['project:updated']) => callback(data);
      ipcRenderer.on('project:updated', handler);
      return () => ipcRenderer.removeListener('project:updated', handler);
    },
  },
};

contextBridge.exposeInMainWorld('terminalIDE', api);

// Type declaration for renderer
export type TerminalIDEApi = typeof api;

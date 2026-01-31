import type { SessionConfig, SessionInfo, SessionCreateResult, LayoutState, PersistedState } from './session';
import type { AgentConfig } from './agent';
import type { ProjectInfo } from './project';

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
    request: LayoutState;
    response: { success: boolean };
  };
  'layout:load': {
    request: void;
    response: LayoutState | null;
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
}

export type IpcChannel = keyof IpcChannels;
export type IpcEvent = keyof IpcEvents;

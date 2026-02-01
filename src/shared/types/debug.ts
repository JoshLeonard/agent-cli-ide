/**
 * Debug type definitions for debugger integration
 */

// Debug protocols
export type DebugProtocol = 'cdp' | 'dap' | 'direct';

// Session states
export type DebugSessionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'running'
  | 'paused'
  | 'terminated';

// Stack frame
export interface StackFrame {
  id: number;
  name: string;
  source?: string;
  line?: number;
  column?: number;
}

// Variable
export interface DebugVariable {
  name: string;
  value: string;
  type?: string;
  variablesReference?: number; // For nested objects
}

// Scope (contains variables)
export interface DebugScope {
  name: string; // 'Local', 'Global', 'Closure'
  variablesReference: number;
  variables?: DebugVariable[];
}

// Breakpoint
export interface DebugBreakpoint {
  id: string;
  verified: boolean;
  source: string;
  line: number;
  column?: number;
  condition?: string;
  hitCount?: number;
}

// Console message
export interface DebugConsoleMessage {
  id: string;
  sessionId: string;
  timestamp: number;
  level: 'log' | 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source?: string;
  line?: number;
  stackTrace?: StackFrame[];
}

// Exception
export interface DebugException {
  id: string;
  sessionId: string;
  timestamp: number;
  exceptionType: string;
  message: string;
  stackTrace: StackFrame[];
}

// Pause reason
export type PauseReason = 'breakpoint' | 'exception' | 'step' | 'pause' | 'entry';

// Full debug session state
export interface DebugSessionInfo {
  id: string;
  terminalSessionId: string;
  state: DebugSessionState;
  protocol: DebugProtocol;
  language?: string;
  pausedAt?: {
    source: string;
    line: number;
    column?: number;
    reason: PauseReason;
  };
  callStack: StackFrame[];
  scopes: DebugScope[];
  breakpoints: DebugBreakpoint[];
  consoleMessages: DebugConsoleMessage[];
  exceptions: DebugException[];
}

// Config for attaching debugger
export interface DebugAttachConfig {
  protocol: DebugProtocol;
  host?: string;
  port?: number;
  language?: string;
}

// Event filter for queries
export interface DebugEventFilter {
  sessionIds?: string[];
  levels?: DebugConsoleMessage['level'][];
  fromTimestamp?: number;
  toTimestamp?: number;
  limit?: number;
  offset?: number;
}

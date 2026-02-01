import type {
  DebugProtocol,
  DebugSessionState,
  DebugConsoleMessage,
  DebugException,
  DebugVariable,
  DebugBreakpoint,
  StackFrame,
  PauseReason,
} from '../../../shared/types/debug';

export interface DebugAdapterCallbacks {
  onStateChange: (state: DebugSessionState, pausedAt?: { source: string; line: number; column?: number; reason: PauseReason }) => void;
  onConsoleMessage: (message: Omit<DebugConsoleMessage, 'id' | 'sessionId' | 'timestamp'>) => void;
  onException: (exception: Omit<DebugException, 'id' | 'sessionId' | 'timestamp'>) => void;
  onBreakpointHit: (breakpoint: DebugBreakpoint, callStack: StackFrame[]) => void;
}

export interface DebugAdapter {
  readonly protocol: DebugProtocol;

  // Lifecycle
  connect(host: string, port: number): Promise<void>;
  disconnect(): Promise<void>;

  // Callbacks
  setCallbacks(callbacks: DebugAdapterCallbacks): void;

  // Queries
  getCallStack(): Promise<StackFrame[]>;
  getScopes(frameId: number): Promise<{ name: string; variablesReference: number }[]>;
  getVariables(variablesReference: number): Promise<DebugVariable[]>;

  // Breakpoints
  setBreakpoints(source: string, breakpoints: { line: number; condition?: string }[]): Promise<DebugBreakpoint[]>;

  // Execution control
  continue(): Promise<void>;
  pause(): Promise<void>;
  stepOver(): Promise<void>;
  stepInto(): Promise<void>;
  stepOut(): Promise<void>;

  // Evaluation
  evaluate(expression: string, frameId?: number): Promise<{ result: string; type?: string; variablesReference?: number }>;
}

import { v4 as uuidv4 } from 'uuid';
import { eventBus, Events } from './EventBus';
import type {
  DebugAttachConfig,
  DebugSessionInfo,
  DebugSessionState,
  DebugConsoleMessage,
  DebugException,
  DebugVariable,
  DebugBreakpoint,
  StackFrame,
  DebugEventFilter,
  DebugProtocol,
  DAPConfig,
  DAPPreset,
} from '../../shared/types/debug';
import type { DebugAdapter } from './debugAdapters/DebugAdapter';
import type { DAPLaunchConfig } from './debugAdapters/DAPAdapter';

interface DebugSession {
  info: DebugSessionInfo;
  adapter: DebugAdapter | null;
}

// DAP preset configurations for common debug adapters
const DAP_PRESETS: Record<DAPPreset, Partial<DAPLaunchConfig>> = {
  csharp: {
    adapterPath: 'netcoredbg',
    adapterArgs: ['--interpreter=vscode'],
  },
  python: {
    adapterPath: 'python',
    adapterArgs: ['-m', 'debugpy.adapter'],
  },
  go: {
    adapterPath: 'dlv',
    adapterArgs: ['dap'],
  },
  rust: {
    adapterPath: 'codelldb',
    adapterArgs: [],
  },
  cpp: {
    adapterPath: 'codelldb',
    adapterArgs: [],
  },
  custom: {},
};

class DebuggerService {
  private sessions: Map<string, DebugSession> = new Map();
  private outputSubscription: { unsubscribe: () => void } | null = null;

  private debuggerDetectionPatterns = [
    // CDP - Node.js
    {
      pattern: /Debugger listening on ws:\/\/([^:]+):(\d+)/,
      protocol: 'cdp' as DebugProtocol,
      extractConfig: (match: RegExpMatchArray): Partial<DebugAttachConfig> => ({
        host: match[1],
        port: parseInt(match[2]),
      }),
    },
    // DAP - Python debugpy
    {
      pattern: /debugpy\.server\s*--?\s*listening on (\d+\.\d+\.\d+\.\d+):(\d+)/i,
      protocol: 'dap' as DebugProtocol,
      extractConfig: (match: RegExpMatchArray): Partial<DebugAttachConfig> => ({
        dap: {
          adapterPath: 'python',
          adapterArgs: ['-m', 'debugpy.adapter'],
          attachPort: parseInt(match[2]),
          attachHost: match[1],
        },
      }),
    },
    // DAP - Go delve
    {
      pattern: /API server listening at:\s*(\d+\.\d+\.\d+\.\d+):(\d+)/i,
      protocol: 'dap' as DebugProtocol,
      extractConfig: (match: RegExpMatchArray): Partial<DebugAttachConfig> => ({
        dap: {
          adapterPath: 'dlv',
          adapterArgs: ['dap', '--listen', `${match[1]}:${match[2]}`],
        },
      }),
    },
    // DAP - .NET Core debugger
    {
      pattern: /Waiting for debugger to attach\.\.\./i,
      protocol: 'dap' as DebugProtocol,
      extractConfig: (): Partial<DebugAttachConfig> => ({
        dap: {
          adapterPath: 'netcoredbg',
          adapterArgs: ['--interpreter=vscode'],
        },
      }),
    },
  ];

  initialize(): void {
    // Subscribe to terminal output for auto-detection (future)
    this.outputSubscription = eventBus.on<{ sessionId: string; data: string }>(
      Events.SESSION_OUTPUT,
      (event) => this.analyzeOutputForDebugger(event.sessionId, event.data)
    );
    console.log('[DebuggerService] Initialized');
  }

  shutdown(): void {
    this.outputSubscription?.unsubscribe();
    // Disconnect all adapters
    for (const session of this.sessions.values()) {
      session.adapter?.disconnect().catch(console.error);
    }
    this.sessions.clear();
    console.log('[DebuggerService] Shutdown');
  }

  // Placeholder for auto-detection
  private analyzeOutputForDebugger(sessionId: string, data: string): void {
    // Skip if already have debug session for this terminal
    for (const session of this.sessions.values()) {
      if (session.info.terminalSessionId === sessionId) return;
    }

    for (const detector of this.debuggerDetectionPatterns) {
      const match = data.match(detector.pattern);
      if (match) {
        const config = detector.extractConfig(match);
        console.log(`[DebuggerService] Detected debugger for session ${sessionId}:`, config);

        // TODO: Check auto-attach setting, then attach
        // For now, just log detection
      }
    }
  }

  async attach(terminalSessionId: string, config: DebugAttachConfig): Promise<{ success: boolean; debugSessionId?: string; error?: string }> {
    try {
      let adapter: DebugAdapter;

      if (config.protocol === 'cdp') {
        // Import CDPAdapter dynamically to avoid circular dependencies
        const { CDPAdapter } = await import('./debugAdapters/CDPAdapter');
        adapter = new CDPAdapter();
      } else if (config.protocol === 'dap') {
        // Build DAP launch config from provided config or preset
        let dapConfig: DAPLaunchConfig;

        if (config.dap) {
          // Use provided DAP config directly
          dapConfig = config.dap as DAPLaunchConfig;
        } else if (config.dapPreset && config.dapPreset !== 'custom') {
          // Use preset configuration
          const preset = DAP_PRESETS[config.dapPreset];
          dapConfig = {
            adapterPath: preset.adapterPath || '',
            adapterArgs: preset.adapterArgs,
          };
        } else {
          return { success: false, error: 'DAP config or preset required for DAP protocol' };
        }

        if (!dapConfig.adapterPath) {
          return { success: false, error: 'DAP adapter path is required' };
        }

        const { DAPAdapter } = await import('./debugAdapters/DAPAdapter');
        const dapAdapter = new DAPAdapter();
        dapAdapter.setLaunchConfig(dapConfig);
        adapter = dapAdapter;
      } else {
        return { success: false, error: `Protocol ${config.protocol} not yet implemented` };
      }

      const sessionId = uuidv4();

      const session: DebugSession = {
        info: {
          id: sessionId,
          terminalSessionId,
          state: 'connecting',
          protocol: config.protocol,
          language: config.language,
          callStack: [],
          scopes: [],
          breakpoints: [],
          consoleMessages: [],
          exceptions: [],
        },
        adapter,
      };

      // Set up callbacks
      adapter.setCallbacks({
        onStateChange: (state, pausedAt) => {
          session.info.state = state;
          session.info.pausedAt = pausedAt;
          eventBus.emit(Events.DEBUG_SESSION_STATE_CHANGED, {
            sessionId,
            state,
            pausedAt,
          });
        },
        onConsoleMessage: (msg) => {
          const fullMsg: DebugConsoleMessage = {
            ...msg,
            id: uuidv4(),
            sessionId,
            timestamp: Date.now(),
          };
          session.info.consoleMessages.push(fullMsg);
          // Keep last 500 messages
          if (session.info.consoleMessages.length > 500) {
            session.info.consoleMessages.shift();
          }
          eventBus.emit(Events.DEBUG_CONSOLE_MESSAGE, { message: fullMsg });
        },
        onException: (exc) => {
          const fullExc: DebugException = {
            ...exc,
            id: uuidv4(),
            sessionId,
            timestamp: Date.now(),
          };
          session.info.exceptions.push(fullExc);
          eventBus.emit(Events.DEBUG_EXCEPTION, { exception: fullExc });
        },
        onBreakpointHit: (breakpoint, callStack) => {
          session.info.callStack = callStack;
          eventBus.emit(Events.DEBUG_BREAKPOINT_HIT, {
            sessionId,
            breakpoint,
            callStack,
          });
        },
      });

      this.sessions.set(sessionId, session);

      await adapter.connect(config.host || '127.0.0.1', config.port || 9229);

      eventBus.emit(Events.DEBUG_SESSION_CREATED, { session: session.info });

      return { success: true, debugSessionId: sessionId };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  async detach(sessionId: string): Promise<{ success: boolean; error?: string }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }
    await session.adapter?.disconnect();
    this.sessions.delete(sessionId);
    return { success: true };
  }

  getSession(sessionId: string): DebugSessionInfo | null {
    return this.sessions.get(sessionId)?.info ?? null;
  }

  getAllSessions(): DebugSessionInfo[] {
    return Array.from(this.sessions.values()).map(s => s.info);
  }

  getConsoleMessages(filter: DebugEventFilter): DebugConsoleMessage[] {
    let messages: DebugConsoleMessage[] = [];

    // Collect messages from all sessions or filtered sessions
    for (const session of this.sessions.values()) {
      if (!filter.sessionIds || filter.sessionIds.includes(session.info.id)) {
        messages = messages.concat(session.info.consoleMessages);
      }
    }

    // Apply filters
    if (filter.levels && filter.levels.length > 0) {
      messages = messages.filter(m => filter.levels!.includes(m.level));
    }
    if (filter.fromTimestamp !== undefined) {
      messages = messages.filter(m => m.timestamp >= filter.fromTimestamp!);
    }
    if (filter.toTimestamp !== undefined) {
      messages = messages.filter(m => m.timestamp <= filter.toTimestamp!);
    }

    // Sort by timestamp
    messages.sort((a, b) => a.timestamp - b.timestamp);

    // Apply offset and limit
    if (filter.offset !== undefined) {
      messages = messages.slice(filter.offset);
    }
    if (filter.limit !== undefined) {
      messages = messages.slice(0, filter.limit);
    }

    return messages;
  }

  getExceptions(filter: DebugEventFilter): DebugException[] {
    let exceptions: DebugException[] = [];

    // Collect exceptions from all sessions or filtered sessions
    for (const session of this.sessions.values()) {
      if (!filter.sessionIds || filter.sessionIds.includes(session.info.id)) {
        exceptions = exceptions.concat(session.info.exceptions);
      }
    }

    // Apply filters
    if (filter.fromTimestamp !== undefined) {
      exceptions = exceptions.filter(e => e.timestamp >= filter.fromTimestamp!);
    }
    if (filter.toTimestamp !== undefined) {
      exceptions = exceptions.filter(e => e.timestamp <= filter.toTimestamp!);
    }

    // Sort by timestamp
    exceptions.sort((a, b) => a.timestamp - b.timestamp);

    // Apply offset and limit
    if (filter.offset !== undefined) {
      exceptions = exceptions.slice(filter.offset);
    }
    if (filter.limit !== undefined) {
      exceptions = exceptions.slice(0, filter.limit);
    }

    return exceptions;
  }

  async getCallStack(sessionId: string): Promise<StackFrame[]> {
    const session = this.sessions.get(sessionId);
    if (!session?.adapter) return [];
    return session.adapter.getCallStack();
  }

  async getScopes(sessionId: string, frameId: number): Promise<{ scopes: { name: string; variablesReference: number }[] }> {
    const session = this.sessions.get(sessionId);
    if (!session?.adapter) return { scopes: [] };
    const scopes = await session.adapter.getScopes(frameId);
    return { scopes };
  }

  async getVariables(sessionId: string, variablesReference: number): Promise<DebugVariable[]> {
    const session = this.sessions.get(sessionId);
    if (!session?.adapter) return [];
    return session.adapter.getVariables(variablesReference);
  }

  async setBreakpoints(sessionId: string, source: string, breakpoints: { line: number; condition?: string }[]): Promise<{ breakpoints: DebugBreakpoint[] }> {
    const session = this.sessions.get(sessionId);
    if (!session?.adapter) return { breakpoints: [] };
    const result = await session.adapter.setBreakpoints(source, breakpoints);
    return { breakpoints: result };
  }

  async removeBreakpoint(sessionId: string, breakpointId: string): Promise<{ success: boolean }> {
    const session = this.sessions.get(sessionId);
    if (!session) return { success: false };

    // Remove from session info
    const index = session.info.breakpoints.findIndex(bp => bp.id === breakpointId);
    if (index !== -1) {
      session.info.breakpoints.splice(index, 1);
    }

    // TODO: Implement removal via adapter
    return { success: true };
  }

  async continue(sessionId: string): Promise<{ success: boolean; error?: string }> {
    const session = this.sessions.get(sessionId);
    if (!session?.adapter) return { success: false, error: 'No adapter' };
    await session.adapter.continue();
    return { success: true };
  }

  async pause(sessionId: string): Promise<{ success: boolean; error?: string }> {
    const session = this.sessions.get(sessionId);
    if (!session?.adapter) return { success: false, error: 'No adapter' };
    await session.adapter.pause();
    return { success: true };
  }

  async stepOver(sessionId: string): Promise<{ success: boolean; error?: string }> {
    const session = this.sessions.get(sessionId);
    if (!session?.adapter) return { success: false, error: 'No adapter' };
    await session.adapter.stepOver();
    return { success: true };
  }

  async stepInto(sessionId: string): Promise<{ success: boolean; error?: string }> {
    const session = this.sessions.get(sessionId);
    if (!session?.adapter) return { success: false, error: 'No adapter' };
    await session.adapter.stepInto();
    return { success: true };
  }

  async stepOut(sessionId: string): Promise<{ success: boolean; error?: string }> {
    const session = this.sessions.get(sessionId);
    if (!session?.adapter) return { success: false, error: 'No adapter' };
    await session.adapter.stepOut();
    return { success: true };
  }

  async evaluate(sessionId: string, expression: string, frameId?: number): Promise<{ result: string; type?: string; variablesReference?: number; error?: string }> {
    const session = this.sessions.get(sessionId);
    if (!session?.adapter) return { result: '', error: 'No adapter' };
    return session.adapter.evaluate(expression, frameId);
  }

  getDAPPresets(): Record<DAPPreset, { name: string; adapterPath: string; installCommand: string }> {
    return {
      csharp: {
        name: 'C# / .NET',
        adapterPath: 'netcoredbg',
        installCommand: 'dotnet tool install -g netcoredbg',
      },
      python: {
        name: 'Python',
        adapterPath: 'python -m debugpy.adapter',
        installCommand: 'pip install debugpy',
      },
      go: {
        name: 'Go',
        adapterPath: 'dlv',
        installCommand: 'go install github.com/go-delve/delve/cmd/dlv@latest',
      },
      rust: {
        name: 'Rust',
        adapterPath: 'codelldb',
        installCommand: 'Download from https://github.com/vadimcn/codelldb/releases',
      },
      cpp: {
        name: 'C/C++',
        adapterPath: 'codelldb',
        installCommand: 'Download from https://github.com/vadimcn/codelldb/releases',
      },
      custom: {
        name: 'Custom',
        adapterPath: '',
        installCommand: '',
      },
    };
  }
}

export const debuggerService = new DebuggerService();
export { DAP_PRESETS };

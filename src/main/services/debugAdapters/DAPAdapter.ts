import { spawn, ChildProcess } from 'child_process';
import { DebugProtocol } from '@vscode/debugprotocol';
import type { DebugAdapter, DebugAdapterCallbacks } from './DebugAdapter';
import type {
  DebugProtocol as AppDebugProtocol,
  DebugVariable,
  DebugBreakpoint,
  StackFrame,
  PauseReason,
} from '../../../shared/types/debug';

export interface DAPLaunchConfig {
  /** Path to debug adapter executable (e.g., 'netcoredbg', 'debugpy') */
  adapterPath: string;
  /** Arguments for the adapter */
  adapterArgs?: string[];
  /** Working directory */
  cwd?: string;
  /** Program to debug */
  program?: string;
  /** Program arguments */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Attach to existing process instead of launching */
  attachPid?: number;
  /** Port to attach to (for network debugging) */
  attachPort?: number;
  /** Host for network debugging */
  attachHost?: string;
  /** Stop on entry point */
  stopOnEntry?: boolean;
}

export class DAPAdapter implements DebugAdapter {
  readonly protocol: AppDebugProtocol = 'dap';

  private process: ChildProcess | null = null;
  private callbacks: DebugAdapterCallbacks | null = null;
  private seq = 1;
  private pendingRequests: Map<number, { resolve: (value: unknown) => void; reject: (reason: unknown) => void }> = new Map();
  private buffer = '';
  private launchConfig: DAPLaunchConfig | null = null;
  private currentThreadId = 1;
  private capabilities: DebugProtocol.Capabilities = {};

  setCallbacks(callbacks: DebugAdapterCallbacks): void {
    this.callbacks = callbacks;
  }

  setLaunchConfig(config: DAPLaunchConfig): void {
    this.launchConfig = config;
  }

  async connect(_host: string, _port: number): Promise<void> {
    if (!this.launchConfig) {
      throw new Error('Launch config not set. Call setLaunchConfig() first.');
    }

    // Spawn the debug adapter process
    this.process = spawn(
      this.launchConfig.adapterPath,
      this.launchConfig.adapterArgs || [],
      {
        cwd: this.launchConfig.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...this.launchConfig.env },
        shell: process.platform === 'win32', // Use shell on Windows for better command resolution
      }
    );

    this.process.stdout?.on('data', (data: Buffer) => this.handleData(data.toString()));
    this.process.stderr?.on('data', (data: Buffer) => {
      console.error('[DAP stderr]', data.toString());
      // Some adapters output important info to stderr
      this.callbacks?.onConsoleMessage({
        level: 'debug',
        message: `[adapter] ${data.toString().trim()}`,
      });
    });
    this.process.on('exit', (code) => {
      console.log('[DAP] Process exited with code:', code);
      this.callbacks?.onStateChange('terminated');
    });
    this.process.on('error', (err) => {
      console.error('[DAP] Process error:', err);
      this.callbacks?.onConsoleMessage({
        level: 'error',
        message: `[adapter error] ${err.message}`,
      });
    });

    // DAP initialization sequence
    const initResponse = await this.sendRequest<DebugProtocol.InitializeResponse['body']>('initialize', {
      clientID: 'terminal-ide',
      clientName: 'Terminal IDE',
      adapterID: 'terminal-ide-dap',
      pathFormat: 'path',
      linesStartAt1: true,
      columnsStartAt1: true,
      supportsVariableType: true,
      supportsVariablePaging: false,
      supportsRunInTerminalRequest: false,
      supportsMemoryReferences: false,
      supportsProgressReporting: false,
      supportsInvalidatedEvent: false,
    });

    this.capabilities = initResponse || {};

    // Launch or attach
    if (this.launchConfig.attachPid !== undefined || this.launchConfig.attachPort !== undefined) {
      await this.sendRequest('attach', {
        processId: this.launchConfig.attachPid,
        port: this.launchConfig.attachPort,
        host: this.launchConfig.attachHost,
      });
    } else {
      await this.sendRequest('launch', {
        program: this.launchConfig.program,
        args: this.launchConfig.args,
        cwd: this.launchConfig.cwd,
        stopOnEntry: this.launchConfig.stopOnEntry ?? true,
        noDebug: false,
      });
    }

    await this.sendRequest('configurationDone', {});
    this.callbacks?.onStateChange('connected');
  }

  async disconnect(): Promise<void> {
    try {
      await this.sendRequest('disconnect', { terminateDebuggee: true });
    } catch (e) {
      // Ignore errors during disconnect
    }
    this.cleanup();
    this.callbacks?.onStateChange('disconnected');
  }

  private cleanup(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.pendingRequests.clear();
    this.buffer = '';
  }

  private handleData(data: string): void {
    this.buffer += data;

    while (true) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;

      const header = this.buffer.slice(0, headerEnd);
      const contentLengthMatch = header.match(/Content-Length:\s*(\d+)/i);
      if (!contentLengthMatch) {
        // Skip malformed header
        this.buffer = this.buffer.slice(headerEnd + 4);
        continue;
      }

      const contentLength = parseInt(contentLengthMatch[1], 10);
      const bodyStart = headerEnd + 4;

      if (this.buffer.length < bodyStart + contentLength) break;

      const body = this.buffer.slice(bodyStart, bodyStart + contentLength);
      this.buffer = this.buffer.slice(bodyStart + contentLength);

      try {
        const message = JSON.parse(body) as DebugProtocol.ProtocolMessage;
        this.handleMessage(message);
      } catch (e) {
        console.error('[DAP] Failed to parse message:', e);
      }
    }
  }

  private handleMessage(message: DebugProtocol.ProtocolMessage): void {
    if (message.type === 'response') {
      const response = message as DebugProtocol.Response;
      const pending = this.pendingRequests.get(response.request_seq);
      if (pending) {
        this.pendingRequests.delete(response.request_seq);
        if (response.success) {
          pending.resolve(response.body);
        } else {
          pending.reject(new Error(response.message || 'Request failed'));
        }
      }
    } else if (message.type === 'event') {
      this.handleEvent(message as DebugProtocol.Event);
    } else if (message.type === 'request') {
      // Handle reverse requests from adapter (e.g., runInTerminal)
      this.handleReverseRequest(message as DebugProtocol.Request);
    }
  }

  private handleEvent(event: DebugProtocol.Event): void {
    switch (event.event) {
      case 'initialized': {
        // Adapter is ready to receive configuration (breakpoints, etc.)
        console.log('[DAP] Adapter initialized');
        break;
      }
      case 'stopped': {
        const body = event.body as DebugProtocol.StoppedEvent['body'];
        this.currentThreadId = body.threadId || 1;

        // Fetch call stack immediately when stopped
        this.getCallStack().then(callStack => {
          const topFrame = callStack[0];
          this.callbacks?.onStateChange('paused', {
            source: topFrame?.source || '',
            line: topFrame?.line || 0,
            column: topFrame?.column,
            reason: this.mapStopReason(body.reason),
          });
        }).catch(console.error);
        break;
      }
      case 'continued': {
        this.callbacks?.onStateChange('running');
        break;
      }
      case 'output': {
        const body = event.body as DebugProtocol.OutputEvent['body'];
        if (body.category !== 'telemetry') {
          this.callbacks?.onConsoleMessage({
            level: this.mapOutputCategory(body.category),
            message: body.output.trimEnd(),
            source: body.source?.path,
            line: body.line,
          });
        }
        break;
      }
      case 'terminated': {
        this.callbacks?.onStateChange('terminated');
        break;
      }
      case 'exited': {
        const body = event.body as DebugProtocol.ExitedEvent['body'];
        this.callbacks?.onConsoleMessage({
          level: 'info',
          message: `Process exited with code ${body.exitCode}`,
        });
        break;
      }
      case 'thread': {
        // Thread started/exited - we could track this but for now just log
        const body = event.body as DebugProtocol.ThreadEvent['body'];
        console.log(`[DAP] Thread ${body.threadId} ${body.reason}`);
        break;
      }
      case 'breakpoint': {
        // Breakpoint changed
        const body = event.body as DebugProtocol.BreakpointEvent['body'];
        console.log(`[DAP] Breakpoint ${body.reason}:`, body.breakpoint);
        break;
      }
      case 'module': {
        // Module loaded/unloaded
        const body = event.body as DebugProtocol.ModuleEvent['body'];
        console.log(`[DAP] Module ${body.reason}:`, body.module.name);
        break;
      }
      default:
        console.log(`[DAP] Unhandled event: ${event.event}`);
    }
  }

  private handleReverseRequest(request: DebugProtocol.Request): void {
    // Handle requests from adapter to client
    switch (request.command) {
      case 'runInTerminal': {
        // Adapter wants us to run something in a terminal
        // For now, send an error response as we don't support this yet
        this.sendResponse(request, false, 'runInTerminal not supported');
        break;
      }
      default:
        this.sendResponse(request, false, `Unknown reverse request: ${request.command}`);
    }
  }

  private sendResponse(request: DebugProtocol.Request, success: boolean, message?: string): void {
    const response: DebugProtocol.Response = {
      seq: this.seq++,
      type: 'response',
      request_seq: request.seq,
      command: request.command,
      success,
      message,
    };
    this.sendMessage(response);
  }

  private mapStopReason(reason: string): PauseReason {
    switch (reason) {
      case 'breakpoint': return 'breakpoint';
      case 'exception': return 'exception';
      case 'step': return 'step';
      case 'entry': return 'entry';
      case 'pause': return 'pause';
      default: return 'pause';
    }
  }

  private mapOutputCategory(category?: string): 'log' | 'info' | 'warn' | 'error' | 'debug' {
    switch (category) {
      case 'stderr': return 'error';
      case 'console': return 'log';
      case 'important': return 'warn';
      default: return 'log';
    }
  }

  private sendRequest<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
      const seq = this.seq++;
      this.pendingRequests.set(seq, { resolve: resolve as (value: unknown) => void, reject });

      const request: DebugProtocol.Request = {
        seq,
        type: 'request',
        command,
        arguments: args,
      };

      this.sendMessage(request);

      // Add timeout for requests
      setTimeout(() => {
        if (this.pendingRequests.has(seq)) {
          this.pendingRequests.delete(seq);
          reject(new Error(`Request '${command}' timed out`));
        }
      }, 30000);
    });
  }

  private sendMessage(message: DebugProtocol.ProtocolMessage): void {
    if (!this.process?.stdin?.writable) {
      console.error('[DAP] Cannot send message - stdin not writable');
      return;
    }

    const json = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n`;
    this.process.stdin.write(header + json, 'utf8');
  }

  async getCallStack(): Promise<StackFrame[]> {
    try {
      const response = await this.sendRequest<DebugProtocol.StackTraceResponse['body']>(
        'stackTrace',
        { threadId: this.currentThreadId }
      );

      return (response.stackFrames || []).map((frame: DebugProtocol.StackFrame) => ({
        id: frame.id,
        name: frame.name,
        source: frame.source?.path || frame.source?.name,
        line: frame.line,
        column: frame.column,
      }));
    } catch (err) {
      console.error('[DAP] Failed to get call stack:', err);
      return [];
    }
  }

  async getScopes(frameId: number): Promise<{ name: string; variablesReference: number }[]> {
    try {
      const response = await this.sendRequest<DebugProtocol.ScopesResponse['body']>(
        'scopes',
        { frameId }
      );

      return (response.scopes || []).map((scope: DebugProtocol.Scope) => ({
        name: scope.name,
        variablesReference: scope.variablesReference,
      }));
    } catch (err) {
      console.error('[DAP] Failed to get scopes:', err);
      return [];
    }
  }

  async getVariables(variablesReference: number): Promise<DebugVariable[]> {
    try {
      const response = await this.sendRequest<DebugProtocol.VariablesResponse['body']>(
        'variables',
        { variablesReference }
      );

      return (response.variables || []).map((v: DebugProtocol.Variable) => ({
        name: v.name,
        value: v.value,
        type: v.type,
        variablesReference: v.variablesReference || undefined,
      }));
    } catch (err) {
      console.error('[DAP] Failed to get variables:', err);
      return [];
    }
  }

  async setBreakpoints(
    source: string,
    breakpoints: { line: number; condition?: string }[]
  ): Promise<DebugBreakpoint[]> {
    try {
      const response = await this.sendRequest<DebugProtocol.SetBreakpointsResponse['body']>(
        'setBreakpoints',
        {
          source: { path: source },
          breakpoints: breakpoints.map((bp) => ({
            line: bp.line,
            condition: bp.condition,
          })),
        }
      );

      return (response.breakpoints || []).map((bp: DebugProtocol.Breakpoint, i: number) => ({
        id: bp.id?.toString() || `${source}:${breakpoints[i]?.line || 0}`,
        verified: bp.verified,
        source,
        line: bp.line || breakpoints[i]?.line || 0,
        condition: breakpoints[i]?.condition,
      }));
    } catch (err) {
      console.error('[DAP] Failed to set breakpoints:', err);
      return breakpoints.map((bp) => ({
        id: `${source}:${bp.line}`,
        verified: false,
        source,
        line: bp.line,
        condition: bp.condition,
      }));
    }
  }

  async continue(): Promise<void> {
    await this.sendRequest('continue', { threadId: this.currentThreadId });
  }

  async pause(): Promise<void> {
    await this.sendRequest('pause', { threadId: this.currentThreadId });
  }

  async stepOver(): Promise<void> {
    await this.sendRequest('next', { threadId: this.currentThreadId });
  }

  async stepInto(): Promise<void> {
    await this.sendRequest('stepIn', { threadId: this.currentThreadId });
  }

  async stepOut(): Promise<void> {
    await this.sendRequest('stepOut', { threadId: this.currentThreadId });
  }

  async evaluate(
    expression: string,
    frameId?: number
  ): Promise<{ result: string; type?: string; variablesReference?: number }> {
    try {
      const response = await this.sendRequest<DebugProtocol.EvaluateResponse['body']>(
        'evaluate',
        {
          expression,
          frameId,
          context: 'watch',
        }
      );

      return {
        result: response.result,
        type: response.type,
        variablesReference: response.variablesReference || undefined,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { result: `Error: ${errorMessage}` };
    }
  }
}

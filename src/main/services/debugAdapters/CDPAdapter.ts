import CDP from 'chrome-remote-interface';
import { v4 as uuidv4 } from 'uuid';
import type {
  DebugProtocol,
  DebugConsoleMessage,
  DebugVariable,
  DebugBreakpoint,
  StackFrame,
  PauseReason,
} from '../../../shared/types/debug';
import type { DebugAdapter, DebugAdapterCallbacks } from './DebugAdapter';

// CDP types are not well-structured in the @types package, so we use any for protocol-specific types
interface CDPCallFrame {
  callFrameId: string;
  functionName: string;
  url?: string;
  location?: {
    scriptId: string;
    lineNumber?: number;
    columnNumber?: number;
  };
  scopeChain: Array<{
    type: string;
    object: {
      objectId?: string;
    };
  }>;
}

interface CDPRuntimeCallFrame {
  functionName: string;
  url: string;
  lineNumber?: number;
  columnNumber?: number;
}

interface CDPRemoteObject {
  type: string;
  subtype?: string;
  value?: unknown;
  description?: string;
  objectId?: string;
  className?: string;
}

export class CDPAdapter implements DebugAdapter {
  readonly protocol: DebugProtocol = 'cdp';

  private client: CDP.Client | null = null;
  private callbacks: DebugAdapterCallbacks | null = null;
  private breakpoints: Map<string, DebugBreakpoint> = new Map();
  private currentCallFrames: CDPCallFrame[] = [];

  setCallbacks(callbacks: DebugAdapterCallbacks): void {
    this.callbacks = callbacks;
  }

  async connect(host: string, port: number): Promise<void> {
    this.client = await CDP({ host, port });

    // Set up event handlers BEFORE enabling domains to catch initial state
    this.client.Runtime.on('consoleAPICalled', (params: {
      type: string;
      args: CDPRemoteObject[];
      stackTrace?: { callFrames?: CDPRuntimeCallFrame[] };
    }) => {
      this.handleConsoleMessage(params);
    });

    this.client.Runtime.on('exceptionThrown', (params: {
      exceptionDetails: {
        text: string;
        lineNumber?: number;
        url?: string;
        exception?: CDPRemoteObject;
        stackTrace?: { callFrames?: CDPRuntimeCallFrame[] };
      };
    }) => {
      this.handleException(params);
    });

    this.client.Debugger.on('paused', (params: {
      reason: string;
      callFrames: CDPCallFrame[];
      hitBreakpoints?: string[];
    }) => {
      this.handlePaused(params);
    });

    this.client.Debugger.on('resumed', () => {
      this.currentCallFrames = [];
      this.callbacks?.onStateChange('running');
    });

    // Enable domains AFTER setting up handlers to catch initial paused state
    await this.client.Runtime.enable();
    await this.client.Debugger.enable();

    this.callbacks?.onStateChange('connected');
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
    this.callbacks?.onStateChange('disconnected');
  }

  private handleConsoleMessage(params: {
    type: string;
    args: CDPRemoteObject[];
    stackTrace?: { callFrames?: CDPRuntimeCallFrame[] };
  }): void {
    const { type, args, stackTrace } = params;
    const level = this.mapConsoleLevel(type);
    const message = args.map((arg) => this.formatValue(arg)).join(' ');

    this.callbacks?.onConsoleMessage({
      level,
      message,
      source: stackTrace?.callFrames?.[0]?.url,
      line: stackTrace?.callFrames?.[0]?.lineNumber,
      stackTrace: stackTrace?.callFrames?.map(this.mapRuntimeCallFrame),
    });
  }

  private handleException(params: {
    exceptionDetails: {
      text: string;
      lineNumber?: number;
      url?: string;
      exception?: CDPRemoteObject;
      stackTrace?: { callFrames?: CDPRuntimeCallFrame[] };
    };
  }): void {
    const { exceptionDetails } = params;
    const { exception, stackTrace } = exceptionDetails;

    this.callbacks?.onException({
      exceptionType: exception?.className || 'Error',
      message: exception?.description || exceptionDetails.text,
      stackTrace: stackTrace?.callFrames?.map(this.mapRuntimeCallFrame) || [],
    });
  }

  private handlePaused(params: {
    reason: string;
    callFrames: CDPCallFrame[];
    hitBreakpoints?: string[];
  }): void {
    const { reason, callFrames, hitBreakpoints } = params;
    this.currentCallFrames = callFrames;
    const pauseReason = this.mapPauseReason(reason);

    const callStack = callFrames.map(this.mapDebuggerCallFrame);

    if (callFrames.length > 0) {
      const topFrame = callFrames[0];
      this.callbacks?.onStateChange('paused', {
        source: topFrame.url || topFrame.location?.scriptId || 'unknown',
        line: (topFrame.location?.lineNumber ?? 0) + 1, // CDP uses 0-based lines
        column: topFrame.location?.columnNumber,
        reason: pauseReason,
      });
    }

    // If breakpoint was hit, notify
    if (hitBreakpoints && hitBreakpoints.length > 0) {
      const bpId = hitBreakpoints[0];
      const bp = this.breakpoints.get(bpId);
      if (bp) {
        this.callbacks?.onBreakpointHit(bp, callStack);
      }
    }
  }

  private mapConsoleLevel(type: string): DebugConsoleMessage['level'] {
    switch (type) {
      case 'warning': return 'warn';
      case 'error': return 'error';
      case 'debug': return 'debug';
      case 'info': return 'info';
      default: return 'log';
    }
  }

  private mapPauseReason(reason: string): PauseReason {
    switch (reason) {
      case 'exception': return 'exception';
      case 'breakpoint': return 'breakpoint';
      case 'step': return 'step';
      default: return 'pause';
    }
  }

  private mapRuntimeCallFrame = (frame: CDPRuntimeCallFrame): StackFrame => ({
    id: 0, // Runtime call frames don't have IDs
    name: frame.functionName || '(anonymous)',
    source: frame.url,
    line: (frame.lineNumber ?? 0) + 1, // CDP uses 0-based lines
    column: frame.columnNumber,
  });

  private mapDebuggerCallFrame = (frame: CDPCallFrame): StackFrame => ({
    id: parseInt(frame.callFrameId),
    name: frame.functionName || '(anonymous)',
    source: frame.url || frame.location?.scriptId,
    line: (frame.location?.lineNumber ?? 0) + 1, // CDP uses 0-based lines
    column: frame.location?.columnNumber,
  });

  private formatValue(remoteObject: CDPRemoteObject): string {
    if (remoteObject.type === 'string') return String(remoteObject.value);
    if (remoteObject.type === 'number') return String(remoteObject.value);
    if (remoteObject.type === 'boolean') return String(remoteObject.value);
    if (remoteObject.type === 'undefined') return 'undefined';
    if (remoteObject.subtype === 'null') return 'null';
    return remoteObject.description || String(remoteObject.value) || '[object]';
  }

  async getCallStack(): Promise<StackFrame[]> {
    return this.currentCallFrames.map(this.mapDebuggerCallFrame);
  }

  async getScopes(frameId: number): Promise<{ name: string; variablesReference: number }[]> {
    const frame = this.currentCallFrames.find(f => parseInt(f.callFrameId) === frameId);
    if (!frame) return [];

    return frame.scopeChain.map((scope, index) => ({
      name: this.getScopeName(scope.type),
      variablesReference: index, // Use index as reference
    }));
  }

  private getScopeName(type: string): string {
    switch (type) {
      case 'local': return 'Local';
      case 'closure': return 'Closure';
      case 'global': return 'Global';
      case 'with': return 'With';
      case 'catch': return 'Catch';
      case 'block': return 'Block';
      case 'script': return 'Script';
      case 'eval': return 'Eval';
      case 'module': return 'Module';
      default: return type;
    }
  }

  async getVariables(variablesReference: number): Promise<DebugVariable[]> {
    if (!this.client || this.currentCallFrames.length === 0) return [];

    // variablesReference is the scope index
    const frame = this.currentCallFrames[0];
    const scope = frame.scopeChain[variablesReference];
    if (!scope || !scope.object.objectId) return [];

    try {
      const result = await this.client.Runtime.getProperties({
        objectId: scope.object.objectId,
        ownProperties: true,
      });

      return result.result
        .filter((prop: { name: string }) => !prop.name.startsWith('__'))
        .map((prop: { name: string; value?: CDPRemoteObject }) => ({
          name: prop.name,
          value: prop.value ? this.formatValue(prop.value) : 'undefined',
          type: prop.value?.type,
          variablesReference: prop.value?.objectId ? parseInt(prop.value.objectId) : undefined,
        }));
    } catch {
      return [];
    }
  }

  async setBreakpoints(source: string, breakpoints: { line: number; condition?: string }[]): Promise<DebugBreakpoint[]> {
    if (!this.client) return [];

    const results: DebugBreakpoint[] = [];

    // First, remove existing breakpoints for this source
    for (const [bpId, bp] of this.breakpoints.entries()) {
      if (bp.source === source) {
        try {
          await this.client.Debugger.removeBreakpoint({ breakpointId: bpId });
        } catch {
          // Ignore errors when removing breakpoints
        }
        this.breakpoints.delete(bpId);
      }
    }

    // Set new breakpoints
    for (const bp of breakpoints) {
      try {
        const result = await this.client.Debugger.setBreakpointByUrl({
          lineNumber: bp.line - 1, // CDP uses 0-based lines
          url: source,
          condition: bp.condition,
        });

        const debugBp: DebugBreakpoint = {
          id: result.breakpointId,
          verified: true,
          source,
          line: bp.line,
          condition: bp.condition,
        };

        this.breakpoints.set(result.breakpointId, debugBp);
        results.push(debugBp);
      } catch {
        results.push({
          id: uuidv4(),
          verified: false,
          source,
          line: bp.line,
        });
      }
    }

    return results;
  }

  async continue(): Promise<void> {
    await this.client?.Debugger.resume();
  }

  async pause(): Promise<void> {
    await this.client?.Debugger.pause();
  }

  async stepOver(): Promise<void> {
    await this.client?.Debugger.stepOver();
  }

  async stepInto(): Promise<void> {
    await this.client?.Debugger.stepInto();
  }

  async stepOut(): Promise<void> {
    await this.client?.Debugger.stepOut();
  }

  async evaluate(expression: string, frameId?: number): Promise<{ result: string; type?: string; variablesReference?: number }> {
    if (!this.client) return { result: '' };

    try {
      let result: { result: CDPRemoteObject; exceptionDetails?: { text: string; exception?: CDPRemoteObject } };

      if (frameId !== undefined) {
        // Evaluate in the context of a specific call frame
        const frame = this.currentCallFrames.find(f => parseInt(f.callFrameId) === frameId);
        if (frame) {
          result = await this.client.Debugger.evaluateOnCallFrame({
            callFrameId: frame.callFrameId,
            expression,
          });
        } else {
          result = await this.client.Runtime.evaluate({ expression });
        }
      } else {
        result = await this.client.Runtime.evaluate({ expression });
      }

      if (result.exceptionDetails) {
        return {
          result: result.exceptionDetails.text || 'Error',
        };
      }

      return {
        result: this.formatValue(result.result),
        type: result.result.type,
        variablesReference: result.result.objectId ? parseInt(result.result.objectId) : undefined,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { result: errorMessage };
    }
  }
}

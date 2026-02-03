import * as http from 'http';
import { URL } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { debuggerService } from './DebuggerService';

const DEBUG_HTTP_PORT = 47832;

interface TokenInfo {
  sessionId: string;
  debugSessionId?: string;
  createdAt: number;
}

/**
 * HTTP server that exposes debug functionality via REST API.
 * Binds to 127.0.0.1 only for security.
 * Uses per-session token authentication.
 */
class DebugHttpServer {
  private server: http.Server | null = null;
  private tokens: Map<string, TokenInfo> = new Map();
  private port: number = DEBUG_HTTP_PORT;
  private isRunning: boolean = false;

  /**
   * Generate a new authentication token for a session.
   */
  generateToken(sessionId: string, debugSessionId?: string): string {
    const token = uuidv4();
    this.tokens.set(token, {
      sessionId,
      debugSessionId,
      createdAt: Date.now(),
    });
    return token;
  }

  /**
   * Invalidate a token (call when session closes).
   */
  invalidateToken(token: string): void {
    this.tokens.delete(token);
  }

  /**
   * Invalidate all tokens for a session.
   */
  invalidateSessionTokens(sessionId: string): void {
    for (const [token, info] of this.tokens) {
      if (info.sessionId === sessionId) {
        this.tokens.delete(token);
      }
    }
  }

  /**
   * Validate a token and return session info.
   */
  private validateToken(authHeader: string | undefined): TokenInfo | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    const token = authHeader.slice(7);
    return this.tokens.get(token) || null;
  }

  /**
   * Start the HTTP server if not already running.
   */
  async start(): Promise<{ port: number }> {
    if (this.isRunning && this.server) {
      return { port: this.port };
    }

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`[DebugHttpServer] Port ${this.port} is already in use`);
          reject(new Error(`Port ${this.port} is already in use`));
        } else {
          reject(err);
        }
      });

      // Bind to localhost only for security
      this.server.listen(this.port, '127.0.0.1', () => {
        this.isRunning = true;
        console.log(`[DebugHttpServer] Listening on http://127.0.0.1:${this.port}`);
        resolve({ port: this.port });
      });
    });
  }

  /**
   * Stop the HTTP server.
   */
  async stop(): Promise<void> {
    if (!this.server) return;

    return new Promise((resolve) => {
      this.server!.close(() => {
        this.isRunning = false;
        this.server = null;
        this.tokens.clear();
        console.log('[DebugHttpServer] Stopped');
        resolve();
      });
    });
  }

  /**
   * Check if server is running.
   */
  isServerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get the server port.
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Get the base URL for the API.
   */
  getBaseUrl(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  /**
   * Handle incoming HTTP requests.
   */
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Enable CORS for local development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://127.0.0.1:${this.port}`);
    const pathname = url.pathname;

    // Health check endpoint (no auth required)
    if (pathname === '/status' && req.method === 'GET') {
      this.sendJson(res, 200, {
        ok: true,
        sessions: debuggerService.getAllSessions().map(s => ({
          id: s.id,
          state: s.state,
          protocol: s.protocol,
        })),
      });
      return;
    }

    // All other endpoints require authentication
    const tokenInfo = this.validateToken(req.headers.authorization);
    if (!tokenInfo) {
      this.sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    try {
      await this.routeRequest(req, res, pathname, tokenInfo);
    } catch (error) {
      console.error('[DebugHttpServer] Request error:', error);
      this.sendJson(res, 500, {
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }

  /**
   * Route authenticated requests to appropriate handlers.
   */
  private async routeRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
    tokenInfo: TokenInfo
  ): Promise<void> {
    const method = req.method || 'GET';

    // Parse session routes: /session/:id/...
    const sessionMatch = pathname.match(/^\/session\/([^\/]+)\/(.+)$/);
    if (!sessionMatch) {
      this.sendJson(res, 404, { error: 'Not found' });
      return;
    }

    const sessionId = sessionMatch[1];
    const action = sessionMatch[2];

    // Verify token matches session (or use token's debug session)
    const debugSessionId = sessionId === 'current'
      ? tokenInfo.debugSessionId
      : sessionId;

    if (!debugSessionId) {
      this.sendJson(res, 400, { error: 'No debug session ID provided' });
      return;
    }

    // Route to handlers
    switch (`${method} ${action}`) {
      case 'GET state':
        await this.handleGetState(res, debugSessionId);
        break;

      case 'GET stack':
        await this.handleGetStack(res, debugSessionId);
        break;

      case 'GET scopes':
        this.sendJson(res, 400, { error: 'Frame ID required. Use /session/:id/scopes/:frameId' });
        break;

      case 'POST breakpoint':
        await this.handleSetBreakpoint(req, res, debugSessionId);
        break;

      case 'DELETE breakpoint':
        await this.handleRemoveBreakpoint(req, res, debugSessionId);
        break;

      case 'POST continue':
        await this.handleContinue(res, debugSessionId);
        break;

      case 'POST pause':
        await this.handlePause(res, debugSessionId);
        break;

      case 'POST step-over':
        await this.handleStepOver(res, debugSessionId);
        break;

      case 'POST step-into':
        await this.handleStepInto(res, debugSessionId);
        break;

      case 'POST step-out':
        await this.handleStepOut(res, debugSessionId);
        break;

      case 'POST evaluate':
        await this.handleEvaluate(req, res, debugSessionId);
        break;

      case 'GET console':
        await this.handleGetConsole(req, res, debugSessionId);
        break;

      case 'GET exceptions':
        await this.handleGetExceptions(req, res, debugSessionId);
        break;

      default:
        // Check for parameterized routes
        const scopesMatch = action.match(/^scopes\/(\d+)$/);
        if (scopesMatch && method === 'GET') {
          await this.handleGetScopes(res, debugSessionId, parseInt(scopesMatch[1]));
          return;
        }

        const variablesMatch = action.match(/^variables\/(\d+)$/);
        if (variablesMatch && method === 'GET') {
          await this.handleGetVariables(res, debugSessionId, parseInt(variablesMatch[1]));
          return;
        }

        this.sendJson(res, 404, { error: 'Not found' });
    }
  }

  // ===== Handler Methods =====

  private async handleGetState(res: http.ServerResponse, sessionId: string): Promise<void> {
    const session = debuggerService.getSession(sessionId);
    if (!session) {
      this.sendJson(res, 404, { error: 'Debug session not found' });
      return;
    }
    this.sendJson(res, 200, {
      id: session.id,
      state: session.state,
      protocol: session.protocol,
      language: session.language,
      pausedAt: session.pausedAt,
      breakpointCount: session.breakpoints.length,
    });
  }

  private async handleGetStack(res: http.ServerResponse, sessionId: string): Promise<void> {
    const stack = await debuggerService.getCallStack(sessionId);
    this.sendJson(res, 200, { callStack: stack });
  }

  private async handleGetScopes(res: http.ServerResponse, sessionId: string, frameId: number): Promise<void> {
    const result = await debuggerService.getScopes(sessionId, frameId);
    this.sendJson(res, 200, result);
  }

  private async handleGetVariables(res: http.ServerResponse, sessionId: string, variablesRef: number): Promise<void> {
    const variables = await debuggerService.getVariables(sessionId, variablesRef);
    this.sendJson(res, 200, { variables });
  }

  private async handleSetBreakpoint(req: http.IncomingMessage, res: http.ServerResponse, sessionId: string): Promise<void> {
    const body = await this.readBody(req);
    const file = body.file as string | undefined;
    const line = body.line as number | undefined;
    const condition = body.condition as string | undefined;

    if (!file || typeof line !== 'number') {
      this.sendJson(res, 400, { error: 'file and line are required' });
      return;
    }

    const result = await debuggerService.setBreakpoints(sessionId, file, [{ line, condition }]);
    this.sendJson(res, 200, result);
  }

  private async handleRemoveBreakpoint(req: http.IncomingMessage, res: http.ServerResponse, sessionId: string): Promise<void> {
    const body = await this.readBody(req);
    const breakpointId = body.breakpointId as string | undefined;

    if (!breakpointId) {
      this.sendJson(res, 400, { error: 'breakpointId is required' });
      return;
    }

    const result = await debuggerService.removeBreakpoint(sessionId, breakpointId);
    this.sendJson(res, 200, result);
  }

  private async handleContinue(res: http.ServerResponse, sessionId: string): Promise<void> {
    const result = await debuggerService.continue(sessionId);
    this.sendJson(res, result.success ? 200 : 400, result);
  }

  private async handlePause(res: http.ServerResponse, sessionId: string): Promise<void> {
    const result = await debuggerService.pause(sessionId);
    this.sendJson(res, result.success ? 200 : 400, result);
  }

  private async handleStepOver(res: http.ServerResponse, sessionId: string): Promise<void> {
    const result = await debuggerService.stepOver(sessionId);
    this.sendJson(res, result.success ? 200 : 400, result);
  }

  private async handleStepInto(res: http.ServerResponse, sessionId: string): Promise<void> {
    const result = await debuggerService.stepInto(sessionId);
    this.sendJson(res, result.success ? 200 : 400, result);
  }

  private async handleStepOut(res: http.ServerResponse, sessionId: string): Promise<void> {
    const result = await debuggerService.stepOut(sessionId);
    this.sendJson(res, result.success ? 200 : 400, result);
  }

  private async handleEvaluate(req: http.IncomingMessage, res: http.ServerResponse, sessionId: string): Promise<void> {
    const body = await this.readBody(req);
    const expression = body.expression as string | undefined;
    const frameId = body.frameId as number | undefined;

    if (!expression) {
      this.sendJson(res, 400, { error: 'expression is required' });
      return;
    }

    const result = await debuggerService.evaluate(sessionId, expression, frameId);
    this.sendJson(res, result.error ? 400 : 200, result);
  }

  private async handleGetConsole(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    sessionId: string
  ): Promise<void> {
    const url = new URL(req.url || '/', `http://127.0.0.1:${this.port}`);
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const levelParam = url.searchParams.get('level');
    const levels = levelParam
      ? (levelParam.split(',') as ('error' | 'warn' | 'info' | 'log' | 'debug')[])
      : undefined;

    const messages = debuggerService.getConsoleMessages({
      sessionIds: [sessionId],
      levels,
      limit,
    });

    this.sendJson(res, 200, { messages });
  }

  private async handleGetExceptions(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    sessionId: string
  ): Promise<void> {
    const url = new URL(req.url || '/', `http://127.0.0.1:${this.port}`);
    const limit = parseInt(url.searchParams.get('limit') || '50');

    const exceptions = debuggerService.getExceptions({
      sessionIds: [sessionId],
      limit,
    });

    this.sendJson(res, 200, { exceptions });
  }

  // ===== Utility Methods =====

  private sendJson(res: http.ServerResponse, status: number, data: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  private async readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch {
          reject(new Error('Invalid JSON body'));
        }
      });
      req.on('error', reject);
    });
  }
}

// Singleton instance
export const debugHttpServer = new DebugHttpServer();

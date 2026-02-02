import type { IPty } from 'node-pty';
import { v4 as uuidv4 } from 'uuid';
import { processManager, type SpawnOptions } from '../services/ProcessManager';
import { eventBus, Events } from '../services/EventBus';
import { agentService } from '../services/AgentService';
import type { SessionType, SessionStatus, SessionInfo, SessionConfig } from '../../shared/types/session';
import type { AgentConfig } from '../../shared/types/agent';

export class Session {
  readonly id: string;
  readonly type: SessionType;
  readonly cwd: string;
  readonly branch?: string;
  readonly worktreePath?: string;
  readonly createdAt: number;
  readonly agentId?: string;
  readonly agentName?: string;
  readonly agentIcon?: string;
  readonly enableDebugApi?: boolean;

  private _status: SessionStatus = 'initializing';
  private _pid?: number;
  private pty?: IPty;
  private dataBuffer: string[] = [];
  private agent?: AgentConfig;
  private _debugApiToken?: string;

  constructor(config: SessionConfig & { id?: string; worktreePath?: string; debugApiToken?: string }) {
    this.id = config.id || uuidv4();
    this.type = config.type;
    this.cwd = config.worktreePath || config.cwd;
    this.branch = config.branch;
    this.worktreePath = config.worktreePath;
    this.createdAt = Date.now();
    this.enableDebugApi = config.enableDebugApi;
    this._debugApiToken = config.debugApiToken;

    // Load agent info if agentId provided
    if (config.agentId) {
      this.agent = agentService.getAgent(config.agentId);
      if (this.agent) {
        this.agentId = this.agent.id;
        this.agentName = this.agent.name;
        this.agentIcon = this.agent.icon;
      }
    }
  }

  get debugApiToken(): string | undefined {
    return this._debugApiToken;
  }

  setDebugApiToken(token: string): void {
    this._debugApiToken = token;
  }

  get status(): SessionStatus {
    return this._status;
  }

  get pid(): number | undefined {
    return this._pid;
  }

  async start(options?: Partial<SpawnOptions> & { debugApi?: { apiUrl: string; token: string } }): Promise<void> {
    try {
      const spawnOptions: SpawnOptions = {
        cwd: this.cwd,
        agent: this.agent,
        ...options,
      };

      // Pass debug API config if provided
      if (options?.debugApi) {
        spawnOptions.debugApi = options.debugApi;
      }

      const { pty, pid } = processManager.spawn(spawnOptions);
      this.pty = pty;
      this._pid = pid;
      this._status = 'running';

      // Set up data handler
      this.pty.onData((data) => {
        this.dataBuffer.push(data);
        eventBus.emit(Events.SESSION_OUTPUT, {
          sessionId: this.id,
          data,
        });
      });

      // Set up exit handler
      this.pty.onExit(({ exitCode }) => {
        this._status = 'terminated';
        eventBus.emit(Events.SESSION_TERMINATED, {
          sessionId: this.id,
          exitCode,
        });
      });

      eventBus.emit(Events.SESSION_UPDATED, { session: this.toInfo() });
    } catch (error) {
      this._status = 'error';
      eventBus.emit(Events.SESSION_UPDATED, { session: this.toInfo() });
      throw error;
    }
  }

  write(data: string): void {
    if (this.pty && this._status === 'running') {
      this.pty.write(data);
    }
  }

  resize(cols: number, rows: number): void {
    if (this._pid && this._status === 'running') {
      processManager.resize(this._pid, cols, rows);
    }
  }

  terminate(): void {
    if (this._pid) {
      processManager.kill(this._pid);
      this._status = 'terminated';
    }
  }

  terminateAsync(): Promise<void> {
    return new Promise((resolve) => {
      if (!this._pid || this._status === 'terminated') {
        resolve();
        return;
      }

      // Set up timeout fallback (5 seconds max wait)
      const timeout = setTimeout(resolve, 5000);

      // Listen for the exit event
      if (this.pty) {
        this.pty.onExit(() => {
          clearTimeout(timeout);
          resolve();
        });
      }

      // Send kill signal
      processManager.kill(this._pid);
      this._status = 'terminated';
    });
  }

  toInfo(): SessionInfo {
    return {
      id: this.id,
      type: this.type,
      cwd: this.cwd,
      branch: this.branch,
      worktreePath: this.worktreePath,
      status: this._status,
      createdAt: this.createdAt,
      pid: this._pid,
      agentId: this.agentId,
      agentName: this.agentName,
      agentIcon: this.agentIcon,
      enableDebugApi: this.enableDebugApi,
      // Don't include token in toInfo() to avoid exposing it to renderer
    };
  }

  getBufferedOutput(): string {
    return this.dataBuffer.join('');
  }
}

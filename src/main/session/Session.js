import { v4 as uuidv4 } from 'uuid';
import { processManager } from '../services/ProcessManager';
import { eventBus, Events } from '../services/EventBus';
import { agentService } from '../services/AgentService';
export class Session {
    id;
    type;
    cwd;
    branch;
    worktreePath;
    createdAt;
    agentId;
    agentName;
    agentIcon;
    _status = 'initializing';
    _pid;
    pty;
    dataBuffer = [];
    agent;
    constructor(config) {
        this.id = config.id || uuidv4();
        this.type = config.type;
        this.cwd = config.worktreePath || config.cwd;
        this.branch = config.branch;
        this.worktreePath = config.worktreePath;
        this.createdAt = Date.now();
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
    get status() {
        return this._status;
    }
    get pid() {
        return this._pid;
    }
    async start(options) {
        try {
            const spawnOptions = {
                cwd: this.cwd,
                agent: this.agent,
                ...options,
            };
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
        }
        catch (error) {
            this._status = 'error';
            eventBus.emit(Events.SESSION_UPDATED, { session: this.toInfo() });
            throw error;
        }
    }
    write(data) {
        if (this.pty && this._status === 'running') {
            this.pty.write(data);
        }
    }
    resize(cols, rows) {
        if (this._pid && this._status === 'running') {
            processManager.resize(this._pid, cols, rows);
        }
    }
    terminate() {
        if (this._pid) {
            processManager.kill(this._pid);
            this._status = 'terminated';
        }
    }
    terminateAsync() {
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
    toInfo() {
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
        };
    }
    getBufferedOutput() {
        return this.dataBuffer.join('');
    }
}
//# sourceMappingURL=Session.js.map
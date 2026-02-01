import * as pty from 'node-pty';
import * as path from 'path';
export class ProcessManager {
    processes = new Map();
    getDefaultShell() {
        if (process.platform === 'win32') {
            // Prefer PowerShell, fallback to CMD
            const psPath = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
            return psPath;
        }
        return process.env.SHELL || '/bin/bash';
    }
    spawn(options) {
        // Always spawn a shell first
        const shell = options.shell || this.getDefaultShell();
        const shellArgs = this.getShellArgs(shell);
        const ptyProcess = pty.spawn(shell, shellArgs, {
            name: 'xterm-256color',
            cols: options.cols || 80,
            rows: options.rows || 24,
            cwd: options.cwd,
            env: {
                ...process.env,
                ...options.env,
                TERM: 'xterm-256color',
            },
        });
        this.processes.set(ptyProcess.pid, ptyProcess);
        // For AI agents, send the command to the shell after it starts
        if (options.agent && options.agent.category === 'ai-agent') {
            const agentCommand = this.buildAgentCommand(options.agent);
            // Small delay to let shell initialize
            setTimeout(() => {
                ptyProcess.write(agentCommand + '\r');
            }, 100);
        }
        return {
            pty: ptyProcess,
            pid: ptyProcess.pid,
        };
    }
    buildAgentCommand(agent) {
        const parts = [agent.command, ...(agent.args || [])];
        return parts.join(' ');
    }
    getShellArgs(shell) {
        const shellName = path.basename(shell).toLowerCase();
        if (shellName.includes('powershell')) {
            return ['-NoLogo'];
        }
        if (shellName === 'cmd.exe') {
            return [];
        }
        // Unix shells
        return ['--login'];
    }
    write(pid, data) {
        const proc = this.processes.get(pid);
        if (proc) {
            proc.write(data);
        }
    }
    resize(pid, cols, rows) {
        const proc = this.processes.get(pid);
        if (proc) {
            proc.resize(cols, rows);
        }
    }
    kill(pid) {
        const proc = this.processes.get(pid);
        if (proc) {
            proc.kill();
            this.processes.delete(pid);
            return true;
        }
        return false;
    }
    getProcess(pid) {
        return this.processes.get(pid);
    }
    killAll() {
        for (const [pid] of this.processes) {
            this.kill(pid);
        }
    }
}
// Singleton instance
export const processManager = new ProcessManager();
//# sourceMappingURL=ProcessManager.js.map
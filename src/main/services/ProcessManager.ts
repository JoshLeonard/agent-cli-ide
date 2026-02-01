import * as pty from 'node-pty';
import * as os from 'os';
import * as path from 'path';
import type { AgentConfig } from '../../shared/types/agent';

export interface PtyProcess {
  pty: pty.IPty;
  pid: number;
}

export interface SpawnOptions {
  cwd: string;
  shell?: string;
  agent?: AgentConfig;  // NEW: Agent configuration
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
  isRestored?: boolean;  // Whether this session is being restored from persistence
}

export class ProcessManager {
  private processes: Map<number, pty.IPty> = new Map();

  getDefaultShell(): string {
    if (process.platform === 'win32') {
      // Prefer PowerShell, fallback to CMD
      const psPath = path.join(
        process.env.SystemRoot || 'C:\\Windows',
        'System32',
        'WindowsPowerShell',
        'v1.0',
        'powershell.exe'
      );
      return psPath;
    }
    return process.env.SHELL || '/bin/bash';
  }

  spawn(options: SpawnOptions): PtyProcess {
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
      } as Record<string, string>,
    });

    this.processes.set(ptyProcess.pid, ptyProcess);

    // For AI agents, send the command to the shell after it starts
    if (options.agent && options.agent.category === 'ai-agent') {
      const agentCommand = this.buildAgentCommand(options.agent, options.isRestored);
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

  private buildAgentCommand(agent: AgentConfig, isRestored?: boolean): string {
    const parts = [agent.command, ...(agent.args || [])];

    // For Claude Code, add --continue flag when restoring a saved session
    if (isRestored && agent.id === 'claude-code') {
      parts.push('--continue');
    }

    return parts.join(' ');
  }

  private getShellArgs(shell: string): string[] {
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

  write(pid: number, data: string): void {
    const proc = this.processes.get(pid);
    if (proc) {
      proc.write(data);
    }
  }

  resize(pid: number, cols: number, rows: number): void {
    const proc = this.processes.get(pid);
    if (proc) {
      proc.resize(cols, rows);
    }
  }

  kill(pid: number): boolean {
    const proc = this.processes.get(pid);
    if (proc) {
      proc.kill();
      this.processes.delete(pid);
      return true;
    }
    return false;
  }

  getProcess(pid: number): pty.IPty | undefined {
    return this.processes.get(pid);
  }

  killAll(): void {
    for (const [pid] of this.processes) {
      this.kill(pid);
    }
  }
}

// Singleton instance
export const processManager = new ProcessManager();

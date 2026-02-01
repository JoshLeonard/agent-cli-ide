import { Session } from '../session/Session';
import { eventBus, Events } from './EventBus';
import { gitWorktreeManager } from './GitWorktreeManager';
import { claudeHooksManager } from './ClaudeHooksManager';
import { hookStateWatcherService } from './HookStateWatcherService';
import type { SessionConfig, SessionInfo, SessionCreateResult } from '../../shared/types/session';

export class SessionRegistry {
  private sessions: Map<string, Session> = new Map();
  private sessionHooksConfigured: Map<string, boolean> = new Map();

  async createSession(config: SessionConfig): Promise<SessionCreateResult> {
    try {
      let worktreePath: string | undefined;

      // For isolated sessions, create a worktree
      if (config.type === 'isolated' && config.branch) {
        const worktreeResult = await gitWorktreeManager.createWorktree(
          config.cwd,
          config.branch
        );
        if (!worktreeResult.success) {
          return {
            success: false,
            error: worktreeResult.error || 'Failed to create worktree',
          };
        }
        worktreePath = worktreeResult.path;
      }

      const session = new Session({
        ...config,
        worktreePath,
      });

      this.sessions.set(session.id, session);

      // Configure hooks for Claude Code sessions
      let hooksConfigured = false;
      if (config.agentId === 'claude-code') {
        const sessionCwd = worktreePath || config.cwd;
        hooksConfigured = await claudeHooksManager.ensureHooksConfigured(sessionCwd, session.id);
        if (hooksConfigured) {
          hookStateWatcherService.watchSession(session.id);
          this.sessionHooksConfigured.set(session.id, true);
        }
      }

      await session.start();

      const sessionInfo = session.toInfo();
      eventBus.emit(Events.SESSION_CREATED, {
        session: sessionInfo,
        hooksConfigured,
      });

      return {
        success: true,
        session: sessionInfo,
        hooksConfigured,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async terminateSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    try {
      // Wait for actual process exit
      await session.terminateAsync();

      // Clean up hooks for Claude Code sessions
      if (this.sessionHooksConfigured.get(sessionId)) {
        hookStateWatcherService.unwatchSession(sessionId);
        const sessionCwd = session.worktreePath || session.cwd;
        await claudeHooksManager.cleanupHooks(sessionCwd, sessionId);
        this.sessionHooksConfigured.delete(sessionId);
      }

      // Clean up worktree if isolated session
      if (session.type === 'isolated' && session.worktreePath) {
        await gitWorktreeManager.removeWorktree(session.worktreePath);
      }

      this.sessions.delete(sessionId);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  writeToSession(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.write(data);
    }
  }

  resizeSession(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.resize(cols, rows);
    }
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  getSessionInfo(sessionId: string): SessionInfo | null {
    const session = this.sessions.get(sessionId);
    return session ? session.toInfo() : null;
  }

  listSessions(): SessionInfo[] {
    return Array.from(this.sessions.values()).map((s) => s.toInfo());
  }

  terminateAll(): void {
    for (const [sessionId, session] of this.sessions) {
      // Clean up hooks
      if (this.sessionHooksConfigured.get(sessionId)) {
        hookStateWatcherService.unwatchSession(sessionId);
        // Note: async cleanup skipped during terminateAll for speed
      }
      session.terminate();
    }
    this.sessions.clear();
    this.sessionHooksConfigured.clear();
  }

  isHooksConfigured(sessionId: string): boolean {
    return this.sessionHooksConfigured.get(sessionId) ?? false;
  }

  restoreSession(info: SessionInfo): Session {
    const session = new Session({
      id: info.id,
      type: info.type,
      cwd: info.cwd,
      branch: info.branch,
      worktreePath: info.worktreePath,
      agentId: info.agentId,
    });
    this.sessions.set(session.id, session);
    return session;
  }
}

// Singleton instance
export const sessionRegistry = new SessionRegistry();

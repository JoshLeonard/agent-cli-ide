import { Session } from '../session/Session';
import { eventBus, Events } from './EventBus';
import { gitWorktreeManager } from './GitWorktreeManager';
import { sessionHookManager } from './SessionHookManager';
import type { SessionConfig, SessionInfo, SessionCreateResult } from '../../shared/types/session';

export class SessionRegistry {
  private sessions: Map<string, Session> = new Map();

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
      const sessionCwd = worktreePath || config.cwd;
      const hooksConfigured = await sessionHookManager.configureHooks(
        config.agentId,
        session.id,
        sessionCwd
      );

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

      // Clean up hooks
      const sessionCwd = session.worktreePath || session.cwd;
      await sessionHookManager.cleanupHooks(sessionId, sessionCwd);

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

  /**
   * Find all sessions associated with a given worktree path.
   * Checks both worktreePath and cwd since drag-drop sessions only set cwd.
   * Normalizes paths for comparison (handles Windows path differences).
   */
  findSessionsByWorktreePath(worktreePath: string): Session[] {
    const normalizePath = (p: string) => p.toLowerCase().replace(/\\/g, '/');
    const normalizedWorktreePath = normalizePath(worktreePath);

    return Array.from(this.sessions.values()).filter(session => {
      const sessionPath = session.worktreePath || session.cwd;
      return normalizePath(sessionPath) === normalizedWorktreePath;
    });
  }

  /**
   * Terminate all sessions associated with a given worktree path.
   * Used when a worktree is deleted to clean up associated sessions.
   */
  async terminateSessionsForWorktree(worktreePath: string): Promise<string[]> {
    const sessionsToTerminate = this.findSessionsByWorktreePath(worktreePath);
    const terminatedIds: string[] = [];

    for (const session of sessionsToTerminate) {
      try {
        await session.terminateAsync();

        // Clean up hooks
        const sessionCwd = session.worktreePath || session.cwd;
        await sessionHookManager.cleanupHooks(session.id, sessionCwd);

        this.sessions.delete(session.id);
        terminatedIds.push(session.id);

        eventBus.emit(Events.SESSION_TERMINATED, {
          sessionId: session.id,
          exitCode: 0,
        });
      } catch (error) {
        console.error(`Failed to terminate session ${session.id}:`, error);
      }
    }

    return terminatedIds;
  }

  terminateAll(): void {
    for (const [sessionId, session] of this.sessions) {
      // Clean up hooks synchronously for speed
      sessionHookManager.cleanupHooksSync(sessionId);
      session.terminate();
    }
    this.sessions.clear();
    sessionHookManager.clearAll();
  }

  isHooksConfigured(sessionId: string): boolean {
    return sessionHookManager.isHooksConfigured(sessionId);
  }

  /**
   * Restore a session from persisted state.
   * @param info - The persisted session info
   * @param autoStart - Whether to automatically start the PTY process (default: false)
   * @returns Object with session and whether hooks were configured
   */
  async restoreSession(
    info: SessionInfo,
    autoStart: boolean = false
  ): Promise<{ session: Session; hooksConfigured: boolean }> {
    const session = new Session({
      id: info.id,
      type: info.type,
      cwd: info.cwd,
      branch: info.branch,
      worktreePath: info.worktreePath,
      agentId: info.agentId,
    });
    this.sessions.set(session.id, session);

    let hooksConfigured = false;

    if (autoStart) {
      // Configure hooks for Claude Code sessions
      const sessionCwd = info.worktreePath || info.cwd;
      hooksConfigured = await sessionHookManager.configureHooks(
        info.agentId,
        session.id,
        sessionCwd
      );

      // Pass isRestored flag so Claude Code uses --continue
      await session.start({ isRestored: true });

      const sessionInfo = session.toInfo();
      eventBus.emit(Events.SESSION_CREATED, {
        session: sessionInfo,
        hooksConfigured,
      });
    }

    return { session, hooksConfigured };
  }
}

// Singleton instance
export const sessionRegistry = new SessionRegistry();

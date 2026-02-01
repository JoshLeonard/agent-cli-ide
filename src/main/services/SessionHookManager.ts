import { claudeHooksManager } from './ClaudeHooksManager';
import { hookStateWatcherService } from './HookStateWatcherService';

/**
 * Centralized service for managing session hooks.
 * Handles configuring and cleaning up hooks for Claude Code sessions.
 */
export class SessionHookManager {
  private sessionHooksConfigured: Map<string, boolean> = new Map();

  /**
   * Configure hooks for a session if it's a Claude Code session.
   * @param agentId - The agent ID for the session
   * @param sessionId - The session ID
   * @param sessionCwd - The working directory for the session (worktreePath or cwd)
   * @returns Whether hooks were successfully configured
   */
  async configureHooks(
    agentId: string | undefined,
    sessionId: string,
    sessionCwd: string
  ): Promise<boolean> {
    if (agentId !== 'claude-code') {
      return false;
    }

    const hooksConfigured = await claudeHooksManager.ensureHooksConfigured(sessionCwd, sessionId);
    if (hooksConfigured) {
      hookStateWatcherService.watchSession(sessionId);
      this.sessionHooksConfigured.set(sessionId, true);
    }

    return hooksConfigured;
  }

  /**
   * Clean up hooks for a session.
   * @param sessionId - The session ID
   * @param sessionCwd - The working directory for the session
   */
  async cleanupHooks(sessionId: string, sessionCwd: string): Promise<void> {
    if (this.sessionHooksConfigured.get(sessionId)) {
      hookStateWatcherService.unwatchSession(sessionId);
      await claudeHooksManager.cleanupHooks(sessionCwd, sessionId);
      this.sessionHooksConfigured.delete(sessionId);
    }
  }

  /**
   * Clean up hooks synchronously (for fast shutdown).
   * Only unwatches the session, does not clean up hook files.
   * @param sessionId - The session ID
   */
  cleanupHooksSync(sessionId: string): void {
    if (this.sessionHooksConfigured.get(sessionId)) {
      hookStateWatcherService.unwatchSession(sessionId);
    }
  }

  /**
   * Check if hooks are configured for a session.
   * @param sessionId - The session ID
   */
  isHooksConfigured(sessionId: string): boolean {
    return this.sessionHooksConfigured.get(sessionId) ?? false;
  }

  /**
   * Clear all hook configurations (for shutdown).
   */
  clearAll(): void {
    this.sessionHooksConfigured.clear();
  }
}

// Singleton instance
export const sessionHookManager = new SessionHookManager();

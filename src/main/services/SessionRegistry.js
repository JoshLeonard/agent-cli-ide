import { Session } from '../session/Session';
import { eventBus, Events } from './EventBus';
import { gitWorktreeManager } from './GitWorktreeManager';
export class SessionRegistry {
    sessions = new Map();
    async createSession(config) {
        try {
            let worktreePath;
            // For isolated sessions, create a worktree
            if (config.type === 'isolated' && config.branch) {
                const worktreeResult = await gitWorktreeManager.createWorktree(config.cwd, config.branch);
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
            await session.start();
            eventBus.emit(Events.SESSION_CREATED, { session: session.toInfo() });
            return {
                success: true,
                session: session.toInfo(),
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    async terminateSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return { success: false, error: 'Session not found' };
        }
        try {
            // Wait for actual process exit
            await session.terminateAsync();
            // Clean up worktree if isolated session
            if (session.type === 'isolated' && session.worktreePath) {
                await gitWorktreeManager.removeWorktree(session.worktreePath);
            }
            this.sessions.delete(sessionId);
            return { success: true };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    writeToSession(sessionId, data) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.write(data);
        }
    }
    resizeSession(sessionId, cols, rows) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.resize(cols, rows);
        }
    }
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    getSessionInfo(sessionId) {
        const session = this.sessions.get(sessionId);
        return session ? session.toInfo() : null;
    }
    listSessions() {
        return Array.from(this.sessions.values()).map((s) => s.toInfo());
    }
    terminateAll() {
        for (const session of this.sessions.values()) {
            session.terminate();
        }
        this.sessions.clear();
    }
    restoreSession(info) {
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
//# sourceMappingURL=SessionRegistry.js.map
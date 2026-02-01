import { ipcMain } from 'electron';
import { sessionRegistry } from '../../services/SessionRegistry';
import { agentStatusTracker } from '../../services/AgentStatusTracker';
import type { SessionConfig } from '../../../shared/types/session';

export function registerSessionHandlers(): void {
  ipcMain.handle('session:create', async (_event, config: SessionConfig) => {
    const result = await sessionRegistry.createSession(config);
    if (result.success && result.session) {
      // Register session with status tracker, indicating if hooks are configured
      agentStatusTracker.registerSession(
        result.session.id,
        result.session.agentId,
        result.hooksConfigured ?? false
      );
    }
    return result;
  });

  ipcMain.handle('session:terminate', async (_event, { sessionId }: { sessionId: string }) => {
    return sessionRegistry.terminateSession(sessionId);
  });

  ipcMain.handle('session:write', (_event, { sessionId, data }: { sessionId: string; data: string }) => {
    sessionRegistry.writeToSession(sessionId, data);

    // If input contains a newline (user pressed Enter), assume agent is now working
    if (data.includes('\r') || data.includes('\n')) {
      agentStatusTracker.setActivityState(sessionId, 'working');
    }
  });

  ipcMain.handle('session:resize', (_event, { sessionId, cols, rows }: { sessionId: string; cols: number; rows: number }) => {
    sessionRegistry.resizeSession(sessionId, cols, rows);
  });

  ipcMain.handle('session:list', () => {
    return sessionRegistry.listSessions();
  });

  ipcMain.handle('session:get', (_event, { sessionId }: { sessionId: string }) => {
    return sessionRegistry.getSessionInfo(sessionId);
  });
}

export function unregisterSessionHandlers(): void {
  ipcMain.removeHandler('session:create');
  ipcMain.removeHandler('session:terminate');
  ipcMain.removeHandler('session:write');
  ipcMain.removeHandler('session:resize');
  ipcMain.removeHandler('session:list');
  ipcMain.removeHandler('session:get');
}

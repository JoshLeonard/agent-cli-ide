import { ipcMain, dialog, BrowserWindow } from 'electron';
import { sessionRegistry } from '../services/SessionRegistry';
import { persistenceService } from '../services/PersistenceService';
import { agentService } from '../services/AgentService';
import { projectService, Events as ProjectEvents } from '../services/ProjectService';
import { gitWorktreeManager } from '../services/GitWorktreeManager';
import { eventBus, Events } from '../services/EventBus';
import { agentStatusTracker } from '../services/AgentStatusTracker';
import { activityFeedService } from '../services/ActivityFeedService';
import { messagingService } from '../services/MessagingService';
import { worktreeWatcherService } from '../services/WorktreeWatcherService';
import type { SessionConfig } from '../../shared/types/session';
import type { PersistedLayoutState } from '../../shared/types/layout';
import type { AgentStatus } from '../../shared/types/agentStatus';
import type { ActivityFilter } from '../../shared/types/activity';
import type { MessageSendOptions } from '../../shared/types/messaging';

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  // Initialize services
  agentStatusTracker.initialize();
  activityFeedService.initialize();

  // Session handlers
  ipcMain.handle('session:create', async (_event, config: SessionConfig) => {
    const result = await sessionRegistry.createSession(config);
    if (result.success && result.session) {
      // Register session with status tracker
      agentStatusTracker.registerSession(result.session.id, result.session.agentId);
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

  // Layout/persistence handlers
  ipcMain.handle('layout:save', async (_event, layout: PersistedLayoutState) => {
    const sessions = sessionRegistry.listSessions();
    await persistenceService.save(sessions, layout);
    return { success: true };
  });

  ipcMain.handle('layout:load', async () => {
    return persistenceService.loadLayout();
  });

  ipcMain.handle('persistence:restore', async () => {
    return persistenceService.load();
  });

  // Dialog handlers
  ipcMain.handle('dialog:selectDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // Agent handlers
  ipcMain.handle('agent:list', () => {
    return agentService.getAgents();
  });

  ipcMain.handle('agent:listAvailable', () => {
    return agentService.getAvailableAgents();
  });

  ipcMain.handle('agent:discover', async () => {
    await agentService.discoverAgents();
    return agentService.getAgents();
  });

  ipcMain.handle('agent:getDefault', () => {
    return agentService.getDefaultAgent();
  });

  ipcMain.handle('agent:get', (_event, { agentId }: { agentId: string }) => {
    return agentService.getAgent(agentId);
  });

  // Project handlers
  ipcMain.handle('project:open', async (_event, { path }: { path: string }) => {
    const result = await projectService.openProject(path);
    if (result.success && result.project?.isGitRepo) {
      worktreeWatcherService.watchProject(path);
    }
    return result;
  });

  ipcMain.handle('project:close', async () => {
    worktreeWatcherService.stopWatching();
    return projectService.closeProject();
  });

  ipcMain.handle('project:getCurrent', () => {
    return projectService.getCurrentProject();
  });

  ipcMain.handle('project:getRecent', async () => {
    return persistenceService.getRecentProjects();
  });

  // Worktree handlers
  ipcMain.handle('worktree:list', async (_event, { repoPath }: { repoPath: string }) => {
    return gitWorktreeManager.listWorktrees(repoPath);
  });

  ipcMain.handle('worktree:remove', async (_event, { worktreePath }: { worktreePath: string }) => {
    return gitWorktreeManager.removeWorktree(worktreePath);
  });

  ipcMain.handle('worktree:cleanOrphaned', async () => {
    return gitWorktreeManager.cleanupOrphaned();
  });

  ipcMain.handle('worktree:isGitRepo', async (_event, { path }: { path: string }) => {
    return gitWorktreeManager.isGitRepo(path);
  });

  // Agent status handlers
  ipcMain.handle('agentStatus:get', (_event, { sessionId }: { sessionId: string }) => {
    return agentStatusTracker.getStatus(sessionId);
  });

  ipcMain.handle('agentStatus:getAll', () => {
    return agentStatusTracker.getAllStatuses();
  });

  // Activity feed handlers
  ipcMain.handle('activity:getEvents', (_event, filter: ActivityFilter) => {
    return activityFeedService.getEvents(filter);
  });

  ipcMain.handle('activity:clearEvents', (_event, { sessionId }: { sessionId?: string }) => {
    activityFeedService.clearEvents(sessionId);
    return { success: true };
  });

  // Messaging handlers
  ipcMain.handle('messaging:send', (_event, {
    targetSessionIds,
    content,
    options,
  }: {
    targetSessionIds: string[];
    content: string;
    options?: MessageSendOptions;
  }) => {
    // Use empty string as source (will be set by renderer based on active session)
    return messagingService.send('', targetSessionIds, content, options);
  });

  ipcMain.handle('messaging:broadcast', (_event, {
    content,
    options,
    excludeSessionId,
  }: {
    content: string;
    options?: MessageSendOptions;
    excludeSessionId?: string;
  }) => {
    return messagingService.broadcast('', content, options, excludeSessionId);
  });

  ipcMain.handle('messaging:setClipboard', (_event, {
    content,
    sourceSessionId,
  }: {
    content: string;
    sourceSessionId: string;
  }) => {
    return messagingService.setClipboard(content, sourceSessionId);
  });

  ipcMain.handle('messaging:getClipboard', () => {
    return messagingService.getClipboard();
  });

  // Forward events to renderer
  eventBus.on(Events.SESSION_OUTPUT, (data) => {
    mainWindow.webContents.send('session:output', data);
  });

  eventBus.on(Events.SESSION_TERMINATED, (data) => {
    mainWindow.webContents.send('session:terminated', data);
  });

  eventBus.on(Events.SESSION_UPDATED, (data) => {
    mainWindow.webContents.send('session:updated', data);
  });

  eventBus.on(ProjectEvents.PROJECT_UPDATED, (data) => {
    mainWindow.webContents.send('project:updated', data);
  });

  eventBus.on(Events.AGENT_STATUS_UPDATED, (data) => {
    mainWindow.webContents.send('agentStatus:updated', data);
  });

  eventBus.on(Events.ACTIVITY_EVENT, (data) => {
    mainWindow.webContents.send('activity:event', data);
  });

  eventBus.on(Events.MESSAGE_SENT, (data) => {
    mainWindow.webContents.send('message:sent', data);
  });

  eventBus.on(Events.MESSAGE_RECEIVED, (data) => {
    mainWindow.webContents.send('message:received', data);
  });

  eventBus.on(Events.WORKTREE_CHANGED, (data) => {
    mainWindow.webContents.send('worktree:changed', data);
  });
}

export function unregisterIpcHandlers(): void {
  // Shutdown services
  agentStatusTracker.shutdown();
  activityFeedService.shutdown();
  worktreeWatcherService.shutdown();

  ipcMain.removeHandler('session:create');
  ipcMain.removeHandler('session:terminate');
  ipcMain.removeHandler('session:write');
  ipcMain.removeHandler('session:resize');
  ipcMain.removeHandler('session:list');
  ipcMain.removeHandler('session:get');
  ipcMain.removeHandler('layout:save');
  ipcMain.removeHandler('layout:load');
  ipcMain.removeHandler('persistence:restore');
  ipcMain.removeHandler('dialog:selectDirectory');
  ipcMain.removeHandler('agent:list');
  ipcMain.removeHandler('agent:listAvailable');
  ipcMain.removeHandler('agent:discover');
  ipcMain.removeHandler('agent:getDefault');
  ipcMain.removeHandler('agent:get');
  ipcMain.removeHandler('project:open');
  ipcMain.removeHandler('project:close');
  ipcMain.removeHandler('project:getCurrent');
  ipcMain.removeHandler('project:getRecent');
  ipcMain.removeHandler('worktree:list');
  ipcMain.removeHandler('worktree:remove');
  ipcMain.removeHandler('worktree:cleanOrphaned');
  ipcMain.removeHandler('worktree:isGitRepo');
  ipcMain.removeHandler('agentStatus:get');
  ipcMain.removeHandler('agentStatus:getAll');
  ipcMain.removeHandler('activity:getEvents');
  ipcMain.removeHandler('activity:clearEvents');
  ipcMain.removeHandler('messaging:send');
  ipcMain.removeHandler('messaging:broadcast');
  ipcMain.removeHandler('messaging:setClipboard');
  ipcMain.removeHandler('messaging:getClipboard');
}

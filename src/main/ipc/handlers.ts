import { ipcMain, dialog, BrowserWindow } from 'electron';
import { sessionRegistry } from '../services/SessionRegistry';
import { persistenceService } from '../services/PersistenceService';
import { agentService } from '../services/AgentService';
import { projectService, Events as ProjectEvents } from '../services/ProjectService';
import { eventBus, Events } from '../services/EventBus';
import type { SessionConfig, LayoutState } from '../../shared/types/session';

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  // Session handlers
  ipcMain.handle('session:create', async (_event, config: SessionConfig) => {
    return sessionRegistry.createSession(config);
  });

  ipcMain.handle('session:terminate', async (_event, { sessionId }: { sessionId: string }) => {
    return sessionRegistry.terminateSession(sessionId);
  });

  ipcMain.handle('session:write', (_event, { sessionId, data }: { sessionId: string; data: string }) => {
    sessionRegistry.writeToSession(sessionId, data);
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
  ipcMain.handle('layout:save', async (_event, layout: LayoutState) => {
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
    return projectService.openProject(path);
  });

  ipcMain.handle('project:close', async () => {
    return projectService.closeProject();
  });

  ipcMain.handle('project:getCurrent', () => {
    return projectService.getCurrentProject();
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
}

export function unregisterIpcHandlers(): void {
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
}

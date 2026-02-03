import { ipcMain, dialog, BrowserWindow } from 'electron';
import { sessionRegistry } from '../../services/SessionRegistry';
import { persistenceService } from '../../services/PersistenceService';
import { projectService } from '../../services/ProjectService';
import type { PersistedLayoutState } from '../../../shared/types/layout';

export function registerPersistenceHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle('layout:save', async (_event, layout: PersistedLayoutState) => {
    const sessions = sessionRegistry.listSessions();
    const currentProject = projectService.getCurrentProject();

    if (currentProject) {
      // Save to project-specific state
      const worktreeAgentPrefs = await persistenceService.getWorktreeAgentPrefsForProject(currentProject.path);
      await persistenceService.saveForProject(currentProject.path, sessions, layout, worktreeAgentPrefs);
    } else {
      // Fallback to legacy global save (shouldn't happen often)
      await persistenceService.save(sessions, layout);
    }
    return { success: true };
  });

  ipcMain.handle('layout:load', async () => {
    const currentProject = projectService.getCurrentProject();

    if (currentProject) {
      // Load from project-specific state
      const projectState = await persistenceService.loadForProject(currentProject.path);
      return projectState?.layout || null;
    }

    // Fallback to legacy global load
    return persistenceService.loadLayout();
  });

  ipcMain.handle('persistence:restore', async () => {
    const currentProject = projectService.getCurrentProject();

    if (currentProject) {
      // Return project-specific state in legacy format for compatibility
      const projectState = await persistenceService.loadForProject(currentProject.path);
      if (projectState) {
        return {
          sessions: projectState.sessions,
          layout: projectState.layout,
          lastSaved: Date.now(),
          projectPath: currentProject.path,
          worktreeAgentPrefs: projectState.worktreeAgentPrefs,
        };
      }
    }

    return persistenceService.load();
  });

  ipcMain.handle('dialog:selectDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });
}

export function unregisterPersistenceHandlers(): void {
  ipcMain.removeHandler('layout:save');
  ipcMain.removeHandler('layout:load');
  ipcMain.removeHandler('persistence:restore');
  ipcMain.removeHandler('dialog:selectDirectory');
}

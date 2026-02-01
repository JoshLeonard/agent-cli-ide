import { ipcMain } from 'electron';
import { projectService } from '../../services/ProjectService';
import { persistenceService } from '../../services/PersistenceService';
import { worktreeWatcherService } from '../../services/WorktreeWatcherService';

export function registerProjectHandlers(): void {
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
}

export function unregisterProjectHandlers(): void {
  ipcMain.removeHandler('project:open');
  ipcMain.removeHandler('project:close');
  ipcMain.removeHandler('project:getCurrent');
  ipcMain.removeHandler('project:getRecent');
}

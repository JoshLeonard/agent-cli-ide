import { ipcMain } from 'electron';
import { gitWorktreeManager } from '../../services/GitWorktreeManager';
import { persistenceService } from '../../services/PersistenceService';

export function registerWorktreeHandlers(): void {
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

  ipcMain.handle('worktree:getAgentPrefs', async () => {
    return persistenceService.getWorktreeAgentPrefs();
  });

  ipcMain.handle('worktree:setAgentPref', async (_event, { worktreePath, agentId }: { worktreePath: string; agentId: string }) => {
    await persistenceService.setWorktreeAgentPref(worktreePath, agentId);
    return { success: true };
  });
}

export function unregisterWorktreeHandlers(): void {
  ipcMain.removeHandler('worktree:list');
  ipcMain.removeHandler('worktree:remove');
  ipcMain.removeHandler('worktree:cleanOrphaned');
  ipcMain.removeHandler('worktree:isGitRepo');
  ipcMain.removeHandler('worktree:getAgentPrefs');
  ipcMain.removeHandler('worktree:setAgentPref');
}

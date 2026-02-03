import { ipcMain } from 'electron';
import * as fs from 'fs/promises';
import { projectService } from '../../services/ProjectService';
import { persistenceService } from '../../services/PersistenceService';
import { worktreeWatcherService } from '../../services/WorktreeWatcherService';
import { sessionRegistry } from '../../services/SessionRegistry';
import { agentStatusTracker } from '../../services/AgentStatusTracker';
import { settingsService } from '../../services/SettingsService';
import type { SessionInfo } from '../../../shared/types/session';

/**
 * Check if a directory exists
 */
async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Validate a session can be restored
 */
async function canRestoreSession(session: SessionInfo): Promise<boolean> {
  const cwdExists = await directoryExists(session.cwd);
  if (!cwdExists) {
    console.log(`Skipping session ${session.id}: cwd no longer exists (${session.cwd})`);
    return false;
  }

  if (session.type === 'isolated' && session.worktreePath) {
    const worktreeExists = await directoryExists(session.worktreePath);
    if (!worktreeExists) {
      console.log(`Skipping session ${session.id}: worktree no longer exists (${session.worktreePath})`);
      return false;
    }
  }

  return true;
}

/**
 * Restore sessions for a specific project
 * Exported for use in app startup (index.ts)
 */
export async function restoreProjectSessions(projectPath: string): Promise<number> {
  const settings = settingsService.get();
  if (!settings.restoreSessionsOnStartup) {
    return 0;
  }

  const projectState = await persistenceService.loadForProject(projectPath);
  if (!projectState || !projectState.sessions || projectState.sessions.length === 0) {
    return 0;
  }

  console.log(`Attempting to restore ${projectState.sessions.length} sessions for project: ${projectPath}`);

  let restoredCount = 0;
  for (const sessionInfo of projectState.sessions) {
    if (sessionInfo.status === 'terminated') {
      continue;
    }

    const canRestore = await canRestoreSession(sessionInfo);
    if (!canRestore) {
      continue;
    }

    try {
      const { session, hooksConfigured } = await sessionRegistry.restoreSession(sessionInfo, true);
      agentStatusTracker.registerSession(session.id, session.agentId, hooksConfigured);
      restoredCount++;
      console.log(`Restored session ${session.id} (${session.agentName || 'shell'})`);
    } catch (error) {
      console.error(`Failed to restore session ${sessionInfo.id}:`, error);
    }
  }

  if (restoredCount > 0) {
    console.log(`Successfully restored ${restoredCount} sessions for project: ${projectPath}`);
  }

  return restoredCount;
}

/**
 * Terminate all current sessions (when switching projects)
 */
function terminateCurrentSessions(): void {
  const sessions = sessionRegistry.listSessions();
  for (const session of sessions) {
    if (session.status === 'running' || session.status === 'initializing') {
      try {
        sessionRegistry.terminateSession(session.id);
      } catch (error) {
        console.error(`Failed to terminate session ${session.id}:`, error);
      }
    }
  }
}

export function registerProjectHandlers(): void {
  ipcMain.handle('project:open', async (_event, { path }: { path: string }) => {
    // Get current project to check if we're switching
    const previousProject = projectService.getCurrentProject();

    // If switching projects, save current state and terminate sessions
    if (previousProject && previousProject.path !== path) {
      const sessions = sessionRegistry.listSessions();
      const currentLayout = await persistenceService.loadForProject(previousProject.path);
      if (currentLayout) {
        await persistenceService.saveForProject(previousProject.path, sessions, currentLayout.layout, currentLayout.worktreeAgentPrefs);
      }
      terminateCurrentSessions();
    }

    const result = await projectService.openProject(path);
    if (result.success && result.project?.isGitRepo) {
      worktreeWatcherService.watchProject(path);
    }

    // Restore sessions for the newly opened project
    if (result.success) {
      await restoreProjectSessions(path);
    }

    return result;
  });

  ipcMain.handle('project:close', async () => {
    const currentProject = projectService.getCurrentProject();

    // Save current state before closing
    if (currentProject) {
      const sessions = sessionRegistry.listSessions();
      const projectState = await persistenceService.loadForProject(currentProject.path);
      const layout = projectState?.layout || {
        version: 3 as const,
        config: { rows: 2, cols: 5 },
        panels: [],
      };
      await persistenceService.saveForProject(currentProject.path, sessions, layout, projectState?.worktreeAgentPrefs);

      // Terminate all sessions
      terminateCurrentSessions();
    }

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

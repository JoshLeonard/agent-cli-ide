import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { registerIpcHandlers, unregisterIpcHandlers } from './ipc/handlers';
import { sessionRegistry } from './services/SessionRegistry';
import { gitWorktreeManager } from './services/GitWorktreeManager';
import { processManager } from './services/ProcessManager';
import { agentService } from './services/AgentService';
import { projectService } from './services/ProjectService';
import { persistenceService } from './services/PersistenceService';
import { settingsService } from './services/SettingsService';
import { agentStatusTracker } from './services/AgentStatusTracker';
import type { SessionInfo } from '../shared/types/session';

let mainWindow: BrowserWindow | null = null;

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
 * - Working directory must exist
 * - For isolated sessions, worktree must exist
 */
async function canRestoreSession(session: SessionInfo): Promise<boolean> {
  // Check working directory exists
  const cwdExists = await directoryExists(session.cwd);
  if (!cwdExists) {
    console.log(`Skipping session ${session.id}: cwd no longer exists (${session.cwd})`);
    return false;
  }

  // For isolated sessions, check worktree exists
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
 * Restore sessions from persisted state
 */
async function restoreSessions(): Promise<void> {
  const state = await persistenceService.load();
  if (!state || !state.sessions || state.sessions.length === 0) {
    return;
  }

  console.log(`Attempting to restore ${state.sessions.length} sessions...`);

  let restoredCount = 0;
  for (const sessionInfo of state.sessions) {
    // Skip terminated sessions
    if (sessionInfo.status === 'terminated') {
      continue;
    }

    // Validate session can be restored
    const canRestore = await canRestoreSession(sessionInfo);
    if (!canRestore) {
      continue;
    }

    try {
      const { session, hooksConfigured } = await sessionRegistry.restoreSession(sessionInfo, true);

      // Register with agent status tracker
      agentStatusTracker.registerSession(
        session.id,
        session.agentId,
        hooksConfigured
      );

      restoredCount++;
      console.log(`Restored session ${session.id} (${session.agentName || 'shell'})`);
    } catch (error) {
      console.error(`Failed to restore session ${sessionInfo.id}:`, error);
    }
  }

  if (restoredCount > 0) {
    console.log(`Successfully restored ${restoredCount} sessions`);
  }
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    ...(process.platform === 'darwin' ? { trafficLightPosition: { x: 12, y: 10 } } : {}),
    webPreferences: {
      preload: path.join(__dirname, '../../preload/preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for node-pty
    },
    title: 'Terminal IDE',
    backgroundColor: '#1e1e1e',
  });

  await registerIpcHandlers(mainWindow);

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    await mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Initialize agent service and discover available agents
  await agentService.initialize();
  console.log(`Discovered ${agentService.getAvailableAgents().length} available agents`);

  // Initialize settings service
  await settingsService.initialize();

  // Restore sessions from previous run if enabled (do this BEFORE worktree cleanup)
  const settings = settingsService.get();
  if (settings.restoreSessionsOnStartup) {
    await restoreSessions();
  }

  // Retry any pending worktree deletions from previous sessions
  const retried = await gitWorktreeManager.retryPendingDeletions();
  if (retried.length > 0) {
    console.log(`Cleaned up ${retried.length} pending worktree deletions`);
  }

  // Clean up orphaned worktrees (only those with invalid git metadata)
  const cleaned = await gitWorktreeManager.cleanupOrphaned();
  if (cleaned.length > 0) {
    console.log(`Cleaned up ${cleaned.length} orphaned worktrees`);
  }

  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

let isShuttingDown = false;

function performShutdown(): void {
  if (isShuttingDown) return;
  isShuttingDown = true;

  // Unregister IPC handlers first to stop event forwarding
  unregisterIpcHandlers();

  // Then terminate sessions and processes
  sessionRegistry.terminateAll();
  processManager.killAll();
  projectService.dispose();
}

app.on('window-all-closed', () => {
  performShutdown();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  performShutdown();
});

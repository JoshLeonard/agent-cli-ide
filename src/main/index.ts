import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { registerIpcHandlers, unregisterIpcHandlers } from './ipc/handlers';
import { restoreProjectSessions } from './ipc/handlers/project';
import { sessionRegistry } from './services/SessionRegistry';
import { gitWorktreeManager } from './services/GitWorktreeManager';
import { processManager } from './services/ProcessManager';
import { agentService } from './services/AgentService';
import { projectService } from './services/ProjectService';
import { settingsService } from './services/SettingsService';
import { autoUpdaterService } from './services/AutoUpdater';
import { logger } from './services/Logger';
import { healthMonitor } from './services/HealthMonitor';

// Global crash handlers — must be registered before anything else
process.on('uncaughtException', (error) => {
  logger.error('UNCAUGHT EXCEPTION:', error);
  logger.logMemory();
  // Give the logger time to flush, then force quit
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason) => {
  logger.error('UNHANDLED REJECTION:', reason);
  logger.logMemory();
});

let mainWindow: BrowserWindow | null = null;

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

  // Initialize auto-updater (only in production)
  if (process.env.NODE_ENV !== 'development') {
    autoUpdaterService.initialize(mainWindow);
    // Check for updates after a short delay
    setTimeout(() => {
      autoUpdaterService.checkForUpdates();
    }, 3000);
  }
}

app.whenReady().then(async () => {
  logger.info('App starting');

  // Initialize agent service and discover available agents
  await agentService.initialize();
  logger.info(`Discovered ${agentService.getAvailableAgents().length} available agents`);

  // Initialize settings service
  await settingsService.initialize();

  // Auto-restore last project on startup (before window creation)
  // This sets currentProject in ProjectService so the renderer can fetch it
  const restoredProject = await projectService.restoreProject();
  if (restoredProject) {
    logger.info(`Restored project: ${restoredProject.path}`);
    // Restore sessions for the project
    const sessionCount = await restoreProjectSessions(restoredProject.path);
    if (sessionCount > 0) {
      logger.info(`Restored ${sessionCount} sessions`);
    }
  }

  // Retry any pending worktree deletions from previous sessions
  const retried = await gitWorktreeManager.retryPendingDeletions();
  if (retried.length > 0) {
    logger.info(`Cleaned up ${retried.length} pending worktree deletions`);
  }

  // Clean up orphaned worktrees (only those with invalid git metadata)
  const cleaned = await gitWorktreeManager.cleanupOrphaned();
  if (cleaned.length > 0) {
    logger.info(`Cleaned up ${cleaned.length} orphaned worktrees`);
  }

  await createWindow();
  logger.info('Window created');

  // Start health monitoring
  healthMonitor.start();

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

  logger.info('App shutting down');
  healthMonitor.stop();

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

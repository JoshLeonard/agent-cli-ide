import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { registerIpcHandlers, unregisterIpcHandlers } from './ipc/handlers';
import { sessionRegistry } from './services/SessionRegistry';
import { gitWorktreeManager } from './services/GitWorktreeManager';
import { processManager } from './services/ProcessManager';
import { agentService } from './services/AgentService';
import { projectService } from './services/ProjectService';
import { settingsService } from './services/SettingsService';

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
}

app.whenReady().then(async () => {
  // Initialize agent service and discover available agents
  await agentService.initialize();
  console.log(`Discovered ${agentService.getAvailableAgents().length} available agents`);

  // Initialize settings service
  await settingsService.initialize();

  // Auto-restore last project on startup (before window creation)
  // This sets currentProject in ProjectService so the renderer can fetch it
  const restoredProject = await projectService.restoreProject();
  if (restoredProject) {
    console.log(`Restored project: ${restoredProject.path}`);
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

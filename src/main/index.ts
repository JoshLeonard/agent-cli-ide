import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { registerIpcHandlers, unregisterIpcHandlers } from './ipc/handlers';
import { sessionRegistry } from './services/SessionRegistry';
import { gitWorktreeManager } from './services/GitWorktreeManager';
import { processManager } from './services/ProcessManager';
import { agentService } from './services/AgentService';
import { projectService } from './services/ProjectService';

let mainWindow: BrowserWindow | null = null;

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../../preload/preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for node-pty
    },
    title: 'Terminal IDE',
    backgroundColor: '#1e1e1e',
  });

  registerIpcHandlers(mainWindow);

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

  // Clean up orphaned worktrees from previous sessions
  const cleaned = await gitWorktreeManager.cleanupOrphaned();
  if (cleaned.length > 0) {
    console.log(`Cleaned up ${cleaned.length} orphaned worktrees`);
  }

  // Restore last project if path still exists
  const restoredProject = await projectService.restoreProject();
  if (restoredProject) {
    console.log(`Restored project: ${restoredProject.path}`);
  }

  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Terminate all sessions
  sessionRegistry.terminateAll();
  processManager.killAll();
  unregisterIpcHandlers();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  sessionRegistry.terminateAll();
  processManager.killAll();
  projectService.dispose();
});

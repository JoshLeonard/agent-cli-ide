import { autoUpdater, UpdateInfo } from 'electron-updater';
import { BrowserWindow, ipcMain } from 'electron';
import { eventBus } from './EventBus';

export interface UpdateStatus {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  info?: UpdateInfo;
  progress?: number;
  error?: string;
}

class AutoUpdaterService {
  private mainWindow: BrowserWindow | null = null;
  private updateDownloaded = false;

  initialize(window: BrowserWindow): void {
    this.mainWindow = window;

    // Configure auto-updater
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    // Set up event handlers
    autoUpdater.on('checking-for-update', () => {
      this.sendStatus({ status: 'checking' });
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.sendStatus({ status: 'available', info });
      eventBus.emit('update:available', info);
    });

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      this.sendStatus({ status: 'not-available', info });
    });

    autoUpdater.on('download-progress', (progress) => {
      this.sendStatus({
        status: 'downloading',
        progress: progress.percent
      });
    });

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.updateDownloaded = true;
      this.sendStatus({ status: 'downloaded', info });
      eventBus.emit('update:downloaded', info);
    });

    autoUpdater.on('error', (error: Error) => {
      this.sendStatus({ status: 'error', error: error.message });
      console.error('Auto-update error:', error);
    });

    // Register IPC handlers
    this.registerIpcHandlers();
  }

  private registerIpcHandlers(): void {
    ipcMain.handle('updater:check', async () => {
      try {
        const result = await autoUpdater.checkForUpdates();
        return result?.updateInfo || null;
      } catch (error) {
        console.error('Check for updates failed:', error);
        return null;
      }
    });

    ipcMain.handle('updater:download', async () => {
      try {
        await autoUpdater.downloadUpdate();
        return true;
      } catch (error) {
        console.error('Download update failed:', error);
        return false;
      }
    });

    ipcMain.handle('updater:install', () => {
      if (this.updateDownloaded) {
        autoUpdater.quitAndInstall(false, true);
        return true;
      }
      return false;
    });

    ipcMain.handle('updater:get-version', () => {
      return autoUpdater.currentVersion.version;
    });
  }

  private sendStatus(status: UpdateStatus): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('updater:status', status);
    }
  }

  async checkForUpdates(): Promise<void> {
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      console.error('Auto-update check failed:', error);
    }
  }

  isUpdateDownloaded(): boolean {
    return this.updateDownloaded;
  }
}

export const autoUpdaterService = new AutoUpdaterService();

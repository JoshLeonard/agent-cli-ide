import { ipcMain, dialog, BrowserWindow } from 'electron';
import { sessionRegistry } from '../../services/SessionRegistry';
import { persistenceService } from '../../services/PersistenceService';
import type { PersistedLayoutState } from '../../../shared/types/layout';

export function registerPersistenceHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle('layout:save', async (_event, layout: PersistedLayoutState) => {
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

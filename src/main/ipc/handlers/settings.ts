import { ipcMain } from 'electron';
import { settingsService } from '../../services/SettingsService';
import type { PartialSettings } from '../../../shared/types/settings';

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', () => {
    return settingsService.get();
  });

  ipcMain.handle('settings:update', async (_event, partial: PartialSettings) => {
    return settingsService.update(partial);
  });

  ipcMain.handle('settings:reset', async () => {
    return settingsService.reset();
  });
}

export function unregisterSettingsHandlers(): void {
  ipcMain.removeHandler('settings:get');
  ipcMain.removeHandler('settings:update');
  ipcMain.removeHandler('settings:reset');
}

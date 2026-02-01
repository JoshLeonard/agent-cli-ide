import { ipcMain, clipboard } from 'electron';
import { messagingService } from '../../services/MessagingService';
import { activityFeedService } from '../../services/ActivityFeedService';
import type { MessageSendOptions } from '../../../shared/types/messaging';
import type { ActivityFilter } from '../../../shared/types/activity';

export function registerMessagingHandlers(): void {
  // Messaging handlers
  ipcMain.handle('messaging:send', (_event, {
    targetSessionIds,
    content,
    options,
  }: {
    targetSessionIds: string[];
    content: string;
    options?: MessageSendOptions;
  }) => {
    // Use empty string as source (will be set by renderer based on active session)
    return messagingService.send('', targetSessionIds, content, options);
  });

  ipcMain.handle('messaging:broadcast', (_event, {
    content,
    options,
    excludeSessionId,
  }: {
    content: string;
    options?: MessageSendOptions;
    excludeSessionId?: string;
  }) => {
    return messagingService.broadcast('', content, options, excludeSessionId);
  });

  ipcMain.handle('messaging:setClipboard', (_event, {
    content,
    sourceSessionId,
  }: {
    content: string;
    sourceSessionId: string;
  }) => {
    return messagingService.setClipboard(content, sourceSessionId);
  });

  ipcMain.handle('messaging:getClipboard', () => {
    return messagingService.getClipboard();
  });

  // OS Clipboard handler
  ipcMain.handle('clipboard:readOS', () => {
    return clipboard.readText();
  });

  // Activity feed handlers
  ipcMain.handle('activity:getEvents', (_event, filter: ActivityFilter) => {
    return activityFeedService.getEvents(filter);
  });

  ipcMain.handle('activity:clearEvents', (_event, { sessionId }: { sessionId?: string }) => {
    activityFeedService.clearEvents(sessionId);
    return { success: true };
  });
}

export function unregisterMessagingHandlers(): void {
  ipcMain.removeHandler('messaging:send');
  ipcMain.removeHandler('messaging:broadcast');
  ipcMain.removeHandler('messaging:setClipboard');
  ipcMain.removeHandler('messaging:getClipboard');
  ipcMain.removeHandler('clipboard:readOS');
  ipcMain.removeHandler('activity:getEvents');
  ipcMain.removeHandler('activity:clearEvents');
}

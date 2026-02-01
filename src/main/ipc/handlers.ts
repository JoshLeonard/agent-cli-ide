import { BrowserWindow } from 'electron';
import { agentStatusTracker } from '../services/AgentStatusTracker';
import { activityFeedService } from '../services/ActivityFeedService';
import { hookStateWatcherService } from '../services/HookStateWatcherService';
import { claudeHooksManager } from '../services/ClaudeHooksManager';
import { settingsService } from '../services/SettingsService';
import { worktreeWatcherService } from '../services/WorktreeWatcherService';
import { messagingService } from '../services/MessagingService';

import {
  registerSessionHandlers,
  unregisterSessionHandlers,
  registerAgentHandlers,
  unregisterAgentHandlers,
  registerProjectHandlers,
  unregisterProjectHandlers,
  registerWorktreeHandlers,
  unregisterWorktreeHandlers,
  registerPersistenceHandlers,
  unregisterPersistenceHandlers,
  registerMessagingHandlers,
  unregisterMessagingHandlers,
  registerWindowHandlers,
  unregisterWindowHandlers,
  registerSettingsHandlers,
  unregisterSettingsHandlers,
  registerEventForwarders,
  unregisterEventForwarders,
} from './handlers/index';

export async function registerIpcHandlers(mainWindow: BrowserWindow): Promise<void> {
  // Initialize services
  agentStatusTracker.initialize();
  activityFeedService.initialize();
  hookStateWatcherService.initialize();
  await claudeHooksManager.initialize();
  await settingsService.initialize();

  // Register all domain handlers
  registerSessionHandlers();
  registerAgentHandlers();
  registerProjectHandlers();
  registerWorktreeHandlers();
  registerPersistenceHandlers(mainWindow);
  registerMessagingHandlers();
  registerWindowHandlers(mainWindow);
  registerSettingsHandlers();

  // Forward events from main process to renderer
  registerEventForwarders(mainWindow);
}

export function unregisterIpcHandlers(): void {
  // Unsubscribe from all event forwarders first
  unregisterEventForwarders();

  // Shutdown services
  agentStatusTracker.shutdown();
  activityFeedService.shutdown();
  worktreeWatcherService.shutdown();
  messagingService.shutdown();
  hookStateWatcherService.shutdown();

  // Unregister all domain handlers
  unregisterSessionHandlers();
  unregisterAgentHandlers();
  unregisterProjectHandlers();
  unregisterWorktreeHandlers();
  unregisterPersistenceHandlers();
  unregisterMessagingHandlers();
  unregisterWindowHandlers();
  unregisterSettingsHandlers();
}

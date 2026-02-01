import { BrowserWindow } from 'electron';
import { eventBus, Events } from '../../services/EventBus';
import { Events as ProjectEvents } from '../../services/ProjectService';

// Store event subscriptions for cleanup
const eventSubscriptions: Array<{ unsubscribe: () => void }> = [];

/**
 * Creates an event forwarder that sends events from the main process to the renderer.
 */
function createEventForwarder<T>(
  mainWindow: BrowserWindow,
  eventBusEvent: string,
  ipcChannel: string
): { unsubscribe: () => void } {
  return eventBus.on(eventBusEvent, (data: T) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(ipcChannel, data);
    }
  });
}

export function registerEventForwarders(mainWindow: BrowserWindow): void {
  eventSubscriptions.push(
    createEventForwarder(mainWindow, Events.SESSION_OUTPUT, 'session:output')
  );

  eventSubscriptions.push(
    createEventForwarder(mainWindow, Events.SESSION_TERMINATED, 'session:terminated')
  );

  eventSubscriptions.push(
    createEventForwarder(mainWindow, Events.SESSION_UPDATED, 'session:updated')
  );

  eventSubscriptions.push(
    createEventForwarder(mainWindow, ProjectEvents.PROJECT_UPDATED, 'project:updated')
  );

  eventSubscriptions.push(
    createEventForwarder(mainWindow, Events.AGENT_STATUS_UPDATED, 'agentStatus:updated')
  );

  eventSubscriptions.push(
    createEventForwarder(mainWindow, Events.ACTIVITY_EVENT, 'activity:event')
  );

  eventSubscriptions.push(
    createEventForwarder(mainWindow, Events.MESSAGE_SENT, 'message:sent')
  );

  eventSubscriptions.push(
    createEventForwarder(mainWindow, Events.MESSAGE_RECEIVED, 'message:received')
  );

  eventSubscriptions.push(
    createEventForwarder(mainWindow, Events.WORKTREE_CHANGED, 'worktree:changed')
  );

  eventSubscriptions.push(
    createEventForwarder(mainWindow, Events.SETTINGS_UPDATED, 'settings:updated')
  );
}

export function unregisterEventForwarders(): void {
  for (const subscription of eventSubscriptions) {
    subscription.unsubscribe();
  }
  eventSubscriptions.length = 0;
}

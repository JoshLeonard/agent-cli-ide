type EventCallback<T = unknown> = (data: T) => void;

interface EventSubscription {
  unsubscribe: () => void;
}

export class EventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  on<T>(event: string, callback: EventCallback<T>): EventSubscription {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback);

    return {
      unsubscribe: () => {
        this.off(event, callback);
      },
    };
  }

  off<T>(event: string, callback: EventCallback<T>): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback as EventCallback);
    }
  }

  emit<T>(event: string, data: T): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  once<T>(event: string, callback: EventCallback<T>): EventSubscription {
    const wrapper: EventCallback<T> = (data) => {
      this.off(event, wrapper);
      callback(data);
    };
    return this.on(event, wrapper);
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

// Singleton instance for app-wide events
export const eventBus = new EventBus();

// Typed event names
export const Events = {
  SESSION_OUTPUT: 'session:output',
  SESSION_TERMINATED: 'session:terminated',
  SESSION_UPDATED: 'session:updated',
  SESSION_CREATED: 'session:created',
  AGENT_STATUS_UPDATED: 'agentStatus:updated',
  ACTIVITY_EVENT: 'activity:event',
  MESSAGE_SENT: 'message:sent',
  MESSAGE_RECEIVED: 'message:received',
  WORKTREE_CHANGED: 'worktree:changed',
} as const;

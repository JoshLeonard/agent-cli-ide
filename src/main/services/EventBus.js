export class EventBus {
    listeners = new Map();
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
        return {
            unsubscribe: () => {
                this.off(event, callback);
            },
        };
    }
    off(event, callback) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.delete(callback);
        }
    }
    emit(event, data) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach((callback) => {
                try {
                    callback(data);
                }
                catch (error) {
                    console.error(`Error in event handler for ${event}:`, error);
                }
            });
        }
    }
    once(event, callback) {
        const wrapper = (data) => {
            this.off(event, wrapper);
            callback(data);
        };
        return this.on(event, wrapper);
    }
    removeAllListeners(event) {
        if (event) {
            this.listeners.delete(event);
        }
        else {
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
};
//# sourceMappingURL=EventBus.js.map
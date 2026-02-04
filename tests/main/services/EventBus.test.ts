import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus, Events } from '../../../src/main/services/EventBus';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  describe('on', () => {
    it('should register an event listener', () => {
      const callback = vi.fn();
      eventBus.on('test-event', callback);
      eventBus.emit('test-event', { data: 'test' });

      expect(callback).toHaveBeenCalledWith({ data: 'test' });
    });

    it('should allow multiple listeners for same event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      eventBus.on('test-event', callback1);
      eventBus.on('test-event', callback2);
      eventBus.emit('test-event', 'data');

      expect(callback1).toHaveBeenCalledWith('data');
      expect(callback2).toHaveBeenCalledWith('data');
    });

    it('should return a subscription with unsubscribe method', () => {
      const callback = vi.fn();
      const subscription = eventBus.on('test-event', callback);

      expect(subscription).toHaveProperty('unsubscribe');
      expect(typeof subscription.unsubscribe).toBe('function');
    });

    it('should not call listener after unsubscribe', () => {
      const callback = vi.fn();
      const subscription = eventBus.on('test-event', callback);

      subscription.unsubscribe();
      eventBus.emit('test-event', 'data');

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('off', () => {
    it('should remove a specific listener', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      eventBus.on('test-event', callback1);
      eventBus.on('test-event', callback2);
      eventBus.off('test-event', callback1);
      eventBus.emit('test-event', 'data');

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledWith('data');
    });

    it('should handle removing non-existent listener gracefully', () => {
      const callback = vi.fn();

      // Should not throw when removing listener that was never added
      expect(() => eventBus.off('test-event', callback)).not.toThrow();
    });

    it('should handle removing from non-existent event gracefully', () => {
      const callback = vi.fn();

      // Should not throw when event has no listeners
      expect(() => eventBus.off('non-existent', callback)).not.toThrow();
    });
  });

  describe('emit', () => {
    it('should call all listeners for an event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      eventBus.on('event1', callback1);
      eventBus.on('event1', callback2);
      eventBus.on('event2', callback3);

      eventBus.emit('event1', 'data');

      expect(callback1).toHaveBeenCalledWith('data');
      expect(callback2).toHaveBeenCalledWith('data');
      expect(callback3).not.toHaveBeenCalled();
    });

    it('should not throw when emitting to event with no listeners', () => {
      expect(() => eventBus.emit('no-listeners', 'data')).not.toThrow();
    });

    it('should catch errors in event handlers and continue', () => {
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });
      const successCallback = vi.fn();

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      eventBus.on('test-event', errorCallback);
      eventBus.on('test-event', successCallback);

      // Should not throw
      expect(() => eventBus.emit('test-event', 'data')).not.toThrow();

      // Both callbacks should have been attempted
      expect(errorCallback).toHaveBeenCalled();
      expect(successCallback).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should pass data correctly to listeners', () => {
      const callback = vi.fn();
      const complexData = {
        id: 'test-123',
        nested: { value: 42 },
        array: [1, 2, 3]
      };

      eventBus.on('test-event', callback);
      eventBus.emit('test-event', complexData);

      expect(callback).toHaveBeenCalledWith(complexData);
    });
  });

  describe('once', () => {
    it('should only trigger listener once', () => {
      const callback = vi.fn();

      eventBus.once('test-event', callback);
      eventBus.emit('test-event', 'first');
      eventBus.emit('test-event', 'second');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('first');
    });

    it('should return a subscription that can be unsubscribed before event', () => {
      const callback = vi.fn();

      const subscription = eventBus.once('test-event', callback);
      subscription.unsubscribe();
      eventBus.emit('test-event', 'data');

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('removeAllListeners', () => {
    it('should remove all listeners for a specific event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      eventBus.on('event1', callback1);
      eventBus.on('event1', callback2);
      eventBus.on('event2', callback3);

      eventBus.removeAllListeners('event1');
      eventBus.emit('event1', 'data');
      eventBus.emit('event2', 'data');

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
      expect(callback3).toHaveBeenCalledWith('data');
    });

    it('should remove all listeners when called without argument', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      eventBus.on('event1', callback1);
      eventBus.on('event2', callback2);

      eventBus.removeAllListeners();
      eventBus.emit('event1', 'data');
      eventBus.emit('event2', 'data');

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });
  });

  describe('Events constants', () => {
    it('should define session events', () => {
      expect(Events.SESSION_OUTPUT).toBe('session:output');
      expect(Events.SESSION_TERMINATED).toBe('session:terminated');
      expect(Events.SESSION_UPDATED).toBe('session:updated');
      expect(Events.SESSION_CREATED).toBe('session:created');
    });

    it('should define agent events', () => {
      expect(Events.AGENT_STATUS_UPDATED).toBe('agentStatus:updated');
    });

    it('should define activity events', () => {
      expect(Events.ACTIVITY_EVENT).toBe('activity:event');
    });

    it('should define messaging events', () => {
      expect(Events.MESSAGE_SENT).toBe('message:sent');
      expect(Events.MESSAGE_RECEIVED).toBe('message:received');
    });

    it('should define debug events', () => {
      expect(Events.DEBUG_SESSION_CREATED).toBe('debug:sessionCreated');
      expect(Events.DEBUG_SESSION_STATE_CHANGED).toBe('debug:sessionStateChanged');
      expect(Events.DEBUG_CONSOLE_MESSAGE).toBe('debug:consoleMessage');
      expect(Events.DEBUG_EXCEPTION).toBe('debug:exception');
      expect(Events.DEBUG_BREAKPOINT_HIT).toBe('debug:breakpointHit');
      expect(Events.DEBUG_VARIABLES_UPDATED).toBe('debug:variablesUpdated');
    });
  });

  describe('type safety', () => {
    it('should work with typed events', () => {
      interface SessionData {
        sessionId: string;
        data: string;
      }

      const callback = vi.fn<[SessionData], void>();

      eventBus.on<SessionData>('session:output', callback);
      eventBus.emit<SessionData>('session:output', { sessionId: 'test', data: 'hello' });

      expect(callback).toHaveBeenCalledWith({ sessionId: 'test', data: 'hello' });
    });
  });
});

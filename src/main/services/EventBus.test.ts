import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from './EventBus';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  describe('on/emit', () => {
    it('should emit events to subscribed listeners', () => {
      const callback = vi.fn();
      eventBus.on('test-event', callback);

      eventBus.emit('test-event', { message: 'hello' });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({ message: 'hello' });
    });

    it('should support multiple listeners for the same event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      eventBus.on('test-event', callback1);
      eventBus.on('test-event', callback2);

      eventBus.emit('test-event', 'data');

      expect(callback1).toHaveBeenCalledWith('data');
      expect(callback2).toHaveBeenCalledWith('data');
    });

    it('should not call listeners for different events', () => {
      const callback = vi.fn();
      eventBus.on('event-a', callback);

      eventBus.emit('event-b', 'data');

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle errors in callbacks without stopping other callbacks', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      const successCallback = vi.fn();

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      eventBus.on('test-event', errorCallback);
      eventBus.on('test-event', successCallback);

      eventBus.emit('test-event', 'data');

      expect(errorCallback).toHaveBeenCalled();
      expect(successCallback).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('off', () => {
    it('should remove a specific listener', () => {
      const callback = vi.fn();
      eventBus.on('test-event', callback);

      eventBus.off('test-event', callback);
      eventBus.emit('test-event', 'data');

      expect(callback).not.toHaveBeenCalled();
    });

    it('should only remove the specified listener, not others', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      eventBus.on('test-event', callback1);
      eventBus.on('test-event', callback2);

      eventBus.off('test-event', callback1);
      eventBus.emit('test-event', 'data');

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledWith('data');
    });
  });

  describe('once', () => {
    it('should call listener only once', () => {
      const callback = vi.fn();
      eventBus.once('test-event', callback);

      eventBus.emit('test-event', 'data1');
      eventBus.emit('test-event', 'data2');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('data1');
    });

    it('should return an unsubscribe function', () => {
      const callback = vi.fn();
      const subscription = eventBus.once('test-event', callback);

      subscription.unsubscribe();
      eventBus.emit('test-event', 'data');

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe via returned subscription object', () => {
      const callback = vi.fn();
      const subscription = eventBus.on('test-event', callback);

      subscription.unsubscribe();
      eventBus.emit('test-event', 'data');

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('removeAllListeners', () => {
    it('should remove all listeners for a specific event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      eventBus.on('event-a', callback1);
      eventBus.on('event-a', callback2);
      eventBus.on('event-b', callback1);

      eventBus.removeAllListeners('event-a');

      eventBus.emit('event-a', 'data');
      eventBus.emit('event-b', 'data');

      expect(callback1).toHaveBeenCalledTimes(1); // Only called for event-b
      expect(callback2).not.toHaveBeenCalled();
    });

    it('should remove all listeners for all events when no event specified', () => {
      const callback = vi.fn();

      eventBus.on('event-a', callback);
      eventBus.on('event-b', callback);

      eventBus.removeAllListeners();

      eventBus.emit('event-a', 'data');
      eventBus.emit('event-b', 'data');

      expect(callback).not.toHaveBeenCalled();
    });
  });
});

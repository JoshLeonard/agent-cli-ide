import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessagingService } from '../../../src/main/services/MessagingService';
import { eventBus, Events } from '../../../src/main/services/EventBus';
import { sessionRegistry } from '../../../src/main/services/SessionRegistry';
import { agentStatusTracker } from '../../../src/main/services/AgentStatusTracker';

// Mock dependencies
vi.mock('../../../src/main/services/SessionRegistry', () => ({
  sessionRegistry: {
    getSession: vi.fn(),
    listSessions: vi.fn()
  }
}));

vi.mock('../../../src/main/services/AgentStatusTracker', () => ({
  agentStatusTracker: {
    setActivityState: vi.fn()
  }
}));

vi.mock('../../../src/main/services/EventBus', () => ({
  eventBus: {
    emit: vi.fn()
  },
  Events: {
    MESSAGE_SENT: 'message:sent',
    MESSAGE_RECEIVED: 'message:received'
  }
}));

describe('MessagingService', () => {
  let messagingService: MessagingService;
  let mockSession: {
    id: string;
    status: string;
    write: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    messagingService = new MessagingService();

    mockSession = {
      id: 'session-1',
      status: 'running',
      write: vi.fn()
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    messagingService.shutdown();
  });

  describe('send', () => {
    it('should return error when content is empty', () => {
      const result = messagingService.send('source', ['target'], '');

      expect(result).toEqual({
        success: false,
        error: 'Content cannot be empty'
      });
    });

    it('should return error when no target sessions specified', () => {
      const result = messagingService.send('source', [], 'content');

      expect(result).toEqual({
        success: false,
        error: 'No target sessions specified'
      });
    });

    it('should send message to running session', () => {
      vi.mocked(sessionRegistry.getSession).mockReturnValue(mockSession as never);

      const result = messagingService.send('source', ['session-1'], 'test content');

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(mockSession.write).toHaveBeenCalledWith('test content\r');
    });

    it('should add newline by default', () => {
      vi.mocked(sessionRegistry.getSession).mockReturnValue(mockSession as never);

      messagingService.send('source', ['session-1'], 'command');

      expect(mockSession.write).toHaveBeenCalledWith('command\r');
    });

    it('should not add newline when addNewline is false', () => {
      vi.mocked(sessionRegistry.getSession).mockReturnValue(mockSession as never);

      messagingService.send('source', ['session-1'], 'partial', { addNewline: false });

      expect(mockSession.write).toHaveBeenCalledWith('partial');
    });

    it('should set agent status to working when sending command', () => {
      vi.mocked(sessionRegistry.getSession).mockReturnValue(mockSession as never);

      messagingService.send('source', ['session-1'], 'command', { addNewline: true });

      expect(agentStatusTracker.setActivityState).toHaveBeenCalledWith('session-1', 'working');
    });

    it('should not set agent status when not adding newline', () => {
      vi.mocked(sessionRegistry.getSession).mockReturnValue(mockSession as never);

      messagingService.send('source', ['session-1'], 'partial', { addNewline: false });

      expect(agentStatusTracker.setActivityState).not.toHaveBeenCalled();
    });

    it('should handle delayed message', () => {
      vi.useFakeTimers();
      vi.mocked(sessionRegistry.getSession).mockReturnValue(mockSession as never);

      messagingService.send('source', ['session-1'], 'delayed', { delay: 1000 });

      // Message should not be written immediately
      expect(mockSession.write).not.toHaveBeenCalled();

      // After delay
      vi.advanceTimersByTime(1000);

      expect(mockSession.write).toHaveBeenCalledWith('delayed\r');

      vi.useRealTimers();
    });

    it('should fail for non-existent session', () => {
      vi.mocked(sessionRegistry.getSession).mockReturnValue(undefined);

      const result = messagingService.send('source', ['non-existent'], 'content');

      expect(result).toEqual({
        success: false,
        error: 'All target sessions unavailable'
      });
    });

    it('should fail for non-running session', () => {
      const stoppedSession = { ...mockSession, status: 'terminated' };
      vi.mocked(sessionRegistry.getSession).mockReturnValue(stoppedSession as never);

      const result = messagingService.send('source', ['session-1'], 'content');

      expect(result).toEqual({
        success: false,
        error: 'All target sessions unavailable'
      });
    });

    it('should send to multiple targets', () => {
      const mockSession2 = { ...mockSession, id: 'session-2', write: vi.fn() };

      vi.mocked(sessionRegistry.getSession)
        .mockReturnValueOnce(mockSession as never)
        .mockReturnValueOnce(mockSession2 as never);

      const result = messagingService.send('source', ['session-1', 'session-2'], 'broadcast');

      expect(result.success).toBe(true);
      expect(mockSession.write).toHaveBeenCalled();
      expect(mockSession2.write).toHaveBeenCalled();
    });

    it('should succeed partially when some targets are unavailable', () => {
      vi.mocked(sessionRegistry.getSession)
        .mockReturnValueOnce(mockSession as never)
        .mockReturnValueOnce(undefined);

      const result = messagingService.send('source', ['session-1', 'session-2'], 'content');

      expect(result.success).toBe(true);
      expect(mockSession.write).toHaveBeenCalled();
    });

    it('should emit MESSAGE_SENT event', () => {
      vi.mocked(sessionRegistry.getSession).mockReturnValue(mockSession as never);

      messagingService.send('source', ['session-1'], 'content');

      expect(eventBus.emit).toHaveBeenCalledWith(
        Events.MESSAGE_SENT,
        expect.objectContaining({
          message: expect.objectContaining({
            sourceSessionId: 'source',
            content: 'content'
          })
        })
      );
    });

    it('should emit MESSAGE_RECEIVED event for each target', () => {
      vi.mocked(sessionRegistry.getSession).mockReturnValue(mockSession as never);

      messagingService.send('source', ['session-1'], 'content');

      expect(eventBus.emit).toHaveBeenCalledWith(
        Events.MESSAGE_RECEIVED,
        expect.objectContaining({
          targetSessionId: 'session-1'
        })
      );
    });

    it('should use provided message type', () => {
      vi.mocked(sessionRegistry.getSession).mockReturnValue(mockSession as never);

      messagingService.send('source', ['session-1'], 'content', { type: 'command' });

      expect(eventBus.emit).toHaveBeenCalledWith(
        Events.MESSAGE_SENT,
        expect.objectContaining({
          message: expect.objectContaining({
            type: 'command'
          })
        })
      );
    });
  });

  describe('broadcast', () => {
    it('should send to all running sessions except source', () => {
      const sessions = [
        { id: 'session-1', status: 'running' },
        { id: 'session-2', status: 'running' },
        { id: 'source', status: 'running' }
      ];

      const mockSession2 = { ...mockSession, id: 'session-2', write: vi.fn() };

      vi.mocked(sessionRegistry.listSessions).mockReturnValue(sessions as never);
      vi.mocked(sessionRegistry.getSession)
        .mockReturnValueOnce(mockSession as never)
        .mockReturnValueOnce(mockSession2 as never);

      const result = messagingService.broadcast('source', 'broadcast message');

      expect(result.success).toBe(true);
      expect(result.targetCount).toBe(2);
    });

    it('should return error when no sessions to broadcast to', () => {
      vi.mocked(sessionRegistry.listSessions).mockReturnValue([
        { id: 'source', status: 'running' }
      ] as never);

      const result = messagingService.broadcast('source', 'content');

      expect(result).toEqual({
        success: false,
        error: 'No running sessions to broadcast to'
      });
    });

    it('should exclude specified session', () => {
      const sessions = [
        { id: 'session-1', status: 'running' },
        { id: 'session-2', status: 'running' },
        { id: 'source', status: 'running' }
      ];

      vi.mocked(sessionRegistry.listSessions).mockReturnValue(sessions as never);
      vi.mocked(sessionRegistry.getSession).mockReturnValue(mockSession as never);

      const result = messagingService.broadcast('source', 'content', undefined, 'session-2');

      expect(result.targetCount).toBe(1);
    });

    it('should exclude non-running sessions', () => {
      const sessions = [
        { id: 'session-1', status: 'running' },
        { id: 'session-2', status: 'terminated' },
        { id: 'source', status: 'running' }
      ];

      vi.mocked(sessionRegistry.listSessions).mockReturnValue(sessions as never);
      vi.mocked(sessionRegistry.getSession).mockReturnValue(mockSession as never);

      const result = messagingService.broadcast('source', 'content');

      expect(result.targetCount).toBe(1);
    });
  });

  describe('clipboard operations', () => {
    describe('setClipboard', () => {
      it('should store clipboard content', () => {
        const result = messagingService.setClipboard('clipboard content', 'session-1');

        expect(result.success).toBe(true);
      });
    });

    describe('getClipboard', () => {
      it('should return null when clipboard is empty', () => {
        const result = messagingService.getClipboard();

        expect(result).toBeNull();
      });

      it('should return stored clipboard content', () => {
        messagingService.setClipboard('test content', 'session-1');

        const result = messagingService.getClipboard();

        expect(result).toEqual({
          content: 'test content',
          sourceSessionId: 'session-1',
          timestamp: expect.any(Number)
        });
      });

      it('should overwrite previous clipboard content', () => {
        messagingService.setClipboard('first', 'session-1');
        messagingService.setClipboard('second', 'session-2');

        const result = messagingService.getClipboard();

        expect(result?.content).toBe('second');
        expect(result?.sourceSessionId).toBe('session-2');
      });
    });

    describe('clearClipboard', () => {
      it('should clear clipboard content', () => {
        messagingService.setClipboard('content', 'session-1');
        messagingService.clearClipboard();

        expect(messagingService.getClipboard()).toBeNull();
      });
    });
  });

  describe('shutdown', () => {
    it('should cancel pending delayed writes', () => {
      vi.useFakeTimers();
      vi.mocked(sessionRegistry.getSession).mockReturnValue(mockSession as never);

      messagingService.send('source', ['session-1'], 'delayed', { delay: 5000 });

      // Shutdown before delay completes
      messagingService.shutdown();

      // Advance timer past delay
      vi.advanceTimersByTime(5000);

      // Write should not have been called
      expect(mockSession.write).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should clear clipboard', () => {
      messagingService.setClipboard('content', 'session-1');
      messagingService.shutdown();

      expect(messagingService.getClipboard()).toBeNull();
    });
  });
});

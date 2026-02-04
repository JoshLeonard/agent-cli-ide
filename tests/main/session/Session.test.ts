import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IPty } from 'node-pty';

// Mock dependencies before importing Session
vi.mock('../../../src/main/services/ProcessManager', () => ({
  processManager: {
    spawn: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn()
  }
}));

vi.mock('../../../src/main/services/EventBus', () => ({
  eventBus: {
    emit: vi.fn()
  },
  Events: {
    SESSION_OUTPUT: 'session:output',
    SESSION_TERMINATED: 'session:terminated',
    SESSION_UPDATED: 'session:updated'
  }
}));

vi.mock('../../../src/main/services/AgentService', () => ({
  agentService: {
    getAgent: vi.fn()
  }
}));

import { Session } from '../../../src/main/session/Session';
import { processManager } from '../../../src/main/services/ProcessManager';
import { eventBus, Events } from '../../../src/main/services/EventBus';
import { agentService } from '../../../src/main/services/AgentService';
import type { SessionConfig } from '../../../src/shared/types/session';

describe('Session', () => {
  let mockPty: Partial<IPty> & {
    onData: ReturnType<typeof vi.fn>;
    onExit: ReturnType<typeof vi.fn>;
  };
  let dataHandler: (data: string) => void;
  let exitHandler: (event: { exitCode: number }) => void;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPty = {
      pid: 12345,
      write: vi.fn(),
      resize: vi.fn(),
      kill: vi.fn(),
      onData: vi.fn((handler) => {
        dataHandler = handler;
        return { dispose: vi.fn() };
      }),
      onExit: vi.fn((handler) => {
        exitHandler = handler;
        return { dispose: vi.fn() };
      })
    };

    vi.mocked(processManager.spawn).mockReturnValue({
      pty: mockPty as unknown as IPty,
      pid: 12345
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create session with basic config', () => {
      const config: SessionConfig = {
        type: 'attached',
        cwd: '/home/user/project'
      };

      const session = new Session(config);

      expect(session.type).toBe('attached');
      expect(session.cwd).toBe('/home/user/project');
      expect(session.status).toBe('initializing');
      expect(session.id).toBeDefined();
    });

    it('should use provided id', () => {
      const config: SessionConfig & { id: string } = {
        id: 'custom-id-123',
        type: 'attached',
        cwd: '/home/user'
      };

      const session = new Session(config);

      expect(session.id).toBe('custom-id-123');
    });

    it('should set worktreePath for isolated sessions', () => {
      const config: SessionConfig & { worktreePath: string } = {
        type: 'isolated',
        cwd: '/home/user/project',
        branch: 'feature-branch',
        worktreePath: '/tmp/worktrees/feature'
      };

      const session = new Session(config);

      expect(session.type).toBe('isolated');
      expect(session.worktreePath).toBe('/tmp/worktrees/feature');
      expect(session.cwd).toBe('/tmp/worktrees/feature');
      expect(session.branch).toBe('feature-branch');
    });

    it('should load agent info when agentId is provided', () => {
      const mockAgent = {
        id: 'claude-code',
        name: 'Claude Code',
        icon: '🤖',
        command: 'claude',
        category: 'ai-agent'
      };

      vi.mocked(agentService.getAgent).mockReturnValue(mockAgent);

      const config: SessionConfig = {
        type: 'attached',
        cwd: '/home/user',
        agentId: 'claude-code'
      };

      const session = new Session(config);

      expect(session.agentId).toBe('claude-code');
      expect(session.agentName).toBe('Claude Code');
      expect(session.agentIcon).toBe('🤖');
    });

    it('should handle unknown agent gracefully', () => {
      vi.mocked(agentService.getAgent).mockReturnValue(undefined);

      const config: SessionConfig = {
        type: 'attached',
        cwd: '/home/user',
        agentId: 'unknown-agent'
      };

      const session = new Session(config);

      expect(session.agentId).toBeUndefined();
    });

    it('should store enableDebugApi flag', () => {
      const config: SessionConfig = {
        type: 'attached',
        cwd: '/home/user',
        enableDebugApi: true
      };

      const session = new Session(config);

      expect(session.enableDebugApi).toBe(true);
    });

    it('should store debugApiToken', () => {
      const config: SessionConfig & { debugApiToken: string } = {
        type: 'attached',
        cwd: '/home/user',
        debugApiToken: 'test-token-123'
      };

      const session = new Session(config);

      expect(session.debugApiToken).toBe('test-token-123');
    });
  });

  describe('start', () => {
    it('should spawn PTY process and set status to running', async () => {
      const session = new Session({ type: 'attached', cwd: '/home/user' });

      await session.start();

      expect(processManager.spawn).toHaveBeenCalledWith(
        expect.objectContaining({
          cwd: '/home/user'
        })
      );
      expect(session.status).toBe('running');
      expect(session.pid).toBe(12345);
    });

    it('should pass agent config to spawn', async () => {
      const mockAgent = {
        id: 'claude-code',
        name: 'Claude Code',
        command: 'claude',
        category: 'ai-agent'
      };

      vi.mocked(agentService.getAgent).mockReturnValue(mockAgent);

      const session = new Session({
        type: 'attached',
        cwd: '/home/user',
        agentId: 'claude-code'
      });

      await session.start();

      expect(processManager.spawn).toHaveBeenCalledWith(
        expect.objectContaining({
          agent: mockAgent
        })
      );
    });

    it('should pass debug API config to spawn', async () => {
      const session = new Session({ type: 'attached', cwd: '/home/user' });

      await session.start({
        debugApi: {
          apiUrl: 'http://localhost:3000',
          token: 'test-token'
        }
      });

      expect(processManager.spawn).toHaveBeenCalledWith(
        expect.objectContaining({
          debugApi: {
            apiUrl: 'http://localhost:3000',
            token: 'test-token'
          }
        })
      );
    });

    it('should emit SESSION_UPDATED event on start', async () => {
      const session = new Session({ type: 'attached', cwd: '/home/user' });

      await session.start();

      expect(eventBus.emit).toHaveBeenCalledWith(
        Events.SESSION_UPDATED,
        expect.objectContaining({
          session: expect.objectContaining({
            id: session.id,
            status: 'running'
          })
        })
      );
    });

    it('should emit SESSION_OUTPUT on PTY data', async () => {
      const session = new Session({ type: 'attached', cwd: '/home/user' });
      await session.start();

      // Simulate PTY data
      dataHandler('test output');

      expect(eventBus.emit).toHaveBeenCalledWith(
        Events.SESSION_OUTPUT,
        {
          sessionId: session.id,
          data: 'test output'
        }
      );
    });

    it('should buffer output data', async () => {
      const session = new Session({ type: 'attached', cwd: '/home/user' });
      await session.start();

      dataHandler('first ');
      dataHandler('second');

      expect(session.getBufferedOutput()).toBe('first second');
    });

    it('should emit SESSION_TERMINATED on PTY exit', async () => {
      const session = new Session({ type: 'attached', cwd: '/home/user' });
      await session.start();

      // Simulate PTY exit
      exitHandler({ exitCode: 0 });

      expect(session.status).toBe('terminated');
      expect(eventBus.emit).toHaveBeenCalledWith(
        Events.SESSION_TERMINATED,
        {
          sessionId: session.id,
          exitCode: 0
        }
      );
    });

    it('should set status to error on spawn failure', async () => {
      vi.mocked(processManager.spawn).mockImplementation(() => {
        throw new Error('Spawn failed');
      });

      const session = new Session({ type: 'attached', cwd: '/home/user' });

      await expect(session.start()).rejects.toThrow('Spawn failed');
      expect(session.status).toBe('error');
    });
  });

  describe('write', () => {
    it('should write data to PTY when running', async () => {
      const session = new Session({ type: 'attached', cwd: '/home/user' });
      await session.start();

      session.write('test input');

      expect(mockPty.write).toHaveBeenCalledWith('test input');
    });

    it('should not write when not running', async () => {
      const session = new Session({ type: 'attached', cwd: '/home/user' });
      // Don't start

      session.write('test input');

      expect(mockPty.write).not.toHaveBeenCalled();
    });

    it('should not write when terminated', async () => {
      const session = new Session({ type: 'attached', cwd: '/home/user' });
      await session.start();

      // Simulate termination
      exitHandler({ exitCode: 0 });

      session.write('test input');

      // write was called during start, but not after termination
      expect(mockPty.write).not.toHaveBeenCalledWith('test input');
    });
  });

  describe('resize', () => {
    it('should resize PTY when running', async () => {
      const session = new Session({ type: 'attached', cwd: '/home/user' });
      await session.start();

      session.resize(100, 50);

      expect(processManager.resize).toHaveBeenCalledWith(12345, 100, 50);
    });

    it('should not resize when not running', async () => {
      const session = new Session({ type: 'attached', cwd: '/home/user' });

      session.resize(100, 50);

      expect(processManager.resize).not.toHaveBeenCalled();
    });
  });

  describe('terminate', () => {
    it('should kill the process', async () => {
      const session = new Session({ type: 'attached', cwd: '/home/user' });
      await session.start();

      session.terminate();

      expect(processManager.kill).toHaveBeenCalledWith(12345);
      expect(session.status).toBe('terminated');
    });

    it('should do nothing when pid is not set', () => {
      const session = new Session({ type: 'attached', cwd: '/home/user' });

      session.terminate();

      expect(processManager.kill).not.toHaveBeenCalled();
    });
  });

  describe('terminateAsync', () => {
    it('should wait for PTY exit', async () => {
      const session = new Session({ type: 'attached', cwd: '/home/user' });
      await session.start();

      const terminatePromise = session.terminateAsync();

      // Simulate exit
      setTimeout(() => exitHandler({ exitCode: 0 }), 10);

      await terminatePromise;

      expect(session.status).toBe('terminated');
    });

    it('should resolve immediately if already terminated', async () => {
      const session = new Session({ type: 'attached', cwd: '/home/user' });

      await session.terminateAsync();

      expect(processManager.kill).not.toHaveBeenCalled();
    });

    it('should timeout after 5 seconds', async () => {
      vi.useFakeTimers();

      const session = new Session({ type: 'attached', cwd: '/home/user' });
      await session.start();

      const terminatePromise = session.terminateAsync();

      // Advance past timeout
      vi.advanceTimersByTime(5000);

      await terminatePromise;

      vi.useRealTimers();
    });
  });

  describe('toInfo', () => {
    it('should return session info object', async () => {
      const mockAgent = {
        id: 'claude-code',
        name: 'Claude Code',
        icon: '🤖',
        command: 'claude',
        category: 'ai-agent'
      };

      vi.mocked(agentService.getAgent).mockReturnValue(mockAgent);

      const session = new Session({
        type: 'isolated',
        cwd: '/home/user/project',
        branch: 'feature',
        agentId: 'claude-code',
        enableDebugApi: true,
        worktreePath: '/tmp/worktree'
      } as never);

      await session.start();

      const info = session.toInfo();

      expect(info).toEqual({
        id: session.id,
        type: 'isolated',
        cwd: '/tmp/worktree',
        branch: 'feature',
        worktreePath: '/tmp/worktree',
        status: 'running',
        createdAt: expect.any(Number),
        pid: 12345,
        agentId: 'claude-code',
        agentName: 'Claude Code',
        agentIcon: '🤖',
        enableDebugApi: true
      });
    });

    it('should not include debugApiToken in info', async () => {
      const session = new Session({
        type: 'attached',
        cwd: '/home/user',
        debugApiToken: 'secret-token'
      } as never);

      const info = session.toInfo();

      expect(info).not.toHaveProperty('debugApiToken');
    });
  });

  describe('setDebugApiToken', () => {
    it('should update the debug API token', () => {
      const session = new Session({ type: 'attached', cwd: '/home/user' });

      session.setDebugApiToken('new-token');

      expect(session.debugApiToken).toBe('new-token');
    });
  });

  describe('getBufferedOutput', () => {
    it('should return empty string when no output', () => {
      const session = new Session({ type: 'attached', cwd: '/home/user' });

      expect(session.getBufferedOutput()).toBe('');
    });

    it('should return all buffered output', async () => {
      const session = new Session({ type: 'attached', cwd: '/home/user' });
      await session.start();

      dataHandler('line 1\n');
      dataHandler('line 2\n');
      dataHandler('line 3');

      expect(session.getBufferedOutput()).toBe('line 1\nline 2\nline 3');
    });
  });
});

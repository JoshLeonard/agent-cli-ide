import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IPty } from 'node-pty';

// Mock node-pty before importing ProcessManager
vi.mock('node-pty', () => ({
  spawn: vi.fn()
}));

import * as pty from 'node-pty';
import { ProcessManager, type SpawnOptions } from '../../../src/main/services/ProcessManager';

describe('ProcessManager', () => {
  let processManager: ProcessManager;
  let mockPty: Partial<IPty>;

  beforeEach(() => {
    processManager = new ProcessManager();

    // Create mock PTY process
    mockPty = {
      pid: 12345,
      write: vi.fn(),
      resize: vi.fn(),
      kill: vi.fn(),
      onData: vi.fn(),
      onExit: vi.fn()
    };

    (pty.spawn as ReturnType<typeof vi.fn>).mockReturnValue(mockPty);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getDefaultShell', () => {
    it('should return SHELL env var on Unix systems', () => {
      const originalPlatform = process.platform;
      const originalShell = process.env.SHELL;

      // Mock Unix platform
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      process.env.SHELL = '/bin/zsh';

      const shell = processManager.getDefaultShell();
      expect(shell).toBe('/bin/zsh');

      // Restore
      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
      process.env.SHELL = originalShell;
    });

    it('should fallback to /bin/bash when SHELL is not set', () => {
      const originalPlatform = process.platform;
      const originalShell = process.env.SHELL;

      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      delete process.env.SHELL;

      const shell = processManager.getDefaultShell();
      expect(shell).toBe('/bin/bash');

      // Restore
      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
      process.env.SHELL = originalShell;
    });
  });

  describe('spawn', () => {
    it('should spawn a PTY process with default options', () => {
      const options: SpawnOptions = {
        cwd: '/home/user/project'
      };

      const result = processManager.spawn(options);

      expect(pty.spawn).toHaveBeenCalled();
      expect(result.pty).toBe(mockPty);
      expect(result.pid).toBe(12345);
    });

    it('should use provided shell', () => {
      const options: SpawnOptions = {
        cwd: '/home/user/project',
        shell: '/bin/fish'
      };

      processManager.spawn(options);

      expect(pty.spawn).toHaveBeenCalledWith(
        '/bin/fish',
        expect.any(Array),
        expect.objectContaining({
          cwd: '/home/user/project'
        })
      );
    });

    it('should set TERM to xterm-256color', () => {
      const options: SpawnOptions = {
        cwd: '/home/user/project'
      };

      processManager.spawn(options);

      expect(pty.spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            TERM: 'xterm-256color'
          })
        })
      );
    });

    it('should use provided cols and rows', () => {
      const options: SpawnOptions = {
        cwd: '/home/user/project',
        cols: 120,
        rows: 40
      };

      processManager.spawn(options);

      expect(pty.spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          cols: 120,
          rows: 40
        })
      );
    });

    it('should use default cols and rows when not provided', () => {
      const options: SpawnOptions = {
        cwd: '/home/user/project'
      };

      processManager.spawn(options);

      expect(pty.spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          cols: 80,
          rows: 24
        })
      );
    });

    it('should merge custom environment variables', () => {
      const options: SpawnOptions = {
        cwd: '/home/user/project',
        env: {
          MY_VAR: 'my_value',
          ANOTHER: 'another_value'
        }
      };

      processManager.spawn(options);

      expect(pty.spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            MY_VAR: 'my_value',
            ANOTHER: 'another_value',
            TERM: 'xterm-256color'
          })
        })
      );
    });

    it('should inject debug API env vars when debugApi is provided', () => {
      const options: SpawnOptions = {
        cwd: '/home/user/project',
        debugApi: {
          apiUrl: 'http://localhost:3000',
          token: 'test-token-123',
          debugSessionId: 'debug-session-456'
        }
      };

      processManager.spawn(options);

      expect(pty.spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            TERMINAL_IDE_DEBUG_API: 'http://localhost:3000',
            TERMINAL_IDE_DEBUG_TOKEN: 'test-token-123',
            TERMINAL_IDE_DEBUG_SESSION: 'debug-session-456'
          })
        })
      );
    });

    it('should start AI agent with command after shell starts', () => {
      vi.useFakeTimers();

      const options: SpawnOptions = {
        cwd: '/home/user/project',
        agent: {
          id: 'claude-code',
          name: 'Claude Code',
          command: 'claude',
          category: 'ai-agent'
        }
      };

      processManager.spawn(options);

      // Before timeout, write should not be called
      expect(mockPty.write).not.toHaveBeenCalled();

      // After timeout
      vi.advanceTimersByTime(100);

      expect(mockPty.write).toHaveBeenCalledWith('claude\r');

      vi.useRealTimers();
    });

    it('should add --continue flag for restored Claude Code sessions', () => {
      vi.useFakeTimers();

      const options: SpawnOptions = {
        cwd: '/home/user/project',
        agent: {
          id: 'claude-code',
          name: 'Claude Code',
          command: 'claude',
          category: 'ai-agent'
        },
        isRestored: true
      };

      processManager.spawn(options);
      vi.advanceTimersByTime(100);

      expect(mockPty.write).toHaveBeenCalledWith('claude --continue\r');

      vi.useRealTimers();
    });

    it('should include agent args in command', () => {
      vi.useFakeTimers();

      const options: SpawnOptions = {
        cwd: '/home/user/project',
        agent: {
          id: 'aider',
          name: 'Aider',
          command: 'aider',
          args: ['--model', 'gpt-4'],
          category: 'ai-agent'
        }
      };

      processManager.spawn(options);
      vi.advanceTimersByTime(100);

      expect(mockPty.write).toHaveBeenCalledWith('aider --model gpt-4\r');

      vi.useRealTimers();
    });

    it('should not send agent command for non-AI agents', () => {
      vi.useFakeTimers();

      const options: SpawnOptions = {
        cwd: '/home/user/project',
        agent: {
          id: 'shell',
          name: 'Shell',
          command: 'bash',
          category: 'shell'
        }
      };

      processManager.spawn(options);
      vi.advanceTimersByTime(100);

      expect(mockPty.write).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should track spawned process internally', () => {
      const options: SpawnOptions = { cwd: '/home/user' };
      const { pid } = processManager.spawn(options);

      const proc = processManager.getProcess(pid);
      expect(proc).toBe(mockPty);
    });
  });

  describe('write', () => {
    it('should write data to the process', () => {
      const { pid } = processManager.spawn({ cwd: '/home/user' });

      processManager.write(pid, 'test input');

      expect(mockPty.write).toHaveBeenCalledWith('test input');
    });

    it('should do nothing for non-existent process', () => {
      expect(() => processManager.write(99999, 'test')).not.toThrow();
    });
  });

  describe('resize', () => {
    it('should resize the process terminal', () => {
      const { pid } = processManager.spawn({ cwd: '/home/user' });

      processManager.resize(pid, 100, 50);

      expect(mockPty.resize).toHaveBeenCalledWith(100, 50);
    });

    it('should do nothing for non-existent process', () => {
      expect(() => processManager.resize(99999, 100, 50)).not.toThrow();
    });
  });

  describe('kill', () => {
    it('should kill the process and return true', () => {
      const { pid } = processManager.spawn({ cwd: '/home/user' });

      const result = processManager.kill(pid);

      expect(mockPty.kill).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should remove process from internal tracking', () => {
      const { pid } = processManager.spawn({ cwd: '/home/user' });

      processManager.kill(pid);

      expect(processManager.getProcess(pid)).toBeUndefined();
    });

    it('should return false for non-existent process', () => {
      const result = processManager.kill(99999);
      expect(result).toBe(false);
    });
  });

  describe('getProcess', () => {
    it('should return the process for valid pid', () => {
      const { pid } = processManager.spawn({ cwd: '/home/user' });

      const proc = processManager.getProcess(pid);

      expect(proc).toBe(mockPty);
    });

    it('should return undefined for invalid pid', () => {
      const proc = processManager.getProcess(99999);
      expect(proc).toBeUndefined();
    });
  });

  describe('killAll', () => {
    it('should kill all spawned processes', () => {
      // Spawn multiple processes with different PIDs
      const mockPty1 = { ...mockPty, pid: 1111, kill: vi.fn() };
      const mockPty2 = { ...mockPty, pid: 2222, kill: vi.fn() };
      const mockPty3 = { ...mockPty, pid: 3333, kill: vi.fn() };

      (pty.spawn as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(mockPty1)
        .mockReturnValueOnce(mockPty2)
        .mockReturnValueOnce(mockPty3);

      processManager.spawn({ cwd: '/home/user' });
      processManager.spawn({ cwd: '/home/user' });
      processManager.spawn({ cwd: '/home/user' });

      processManager.killAll();

      expect(mockPty1.kill).toHaveBeenCalled();
      expect(mockPty2.kill).toHaveBeenCalled();
      expect(mockPty3.kill).toHaveBeenCalled();
    });

    it('should clear internal process tracking', () => {
      const { pid } = processManager.spawn({ cwd: '/home/user' });

      processManager.killAll();

      expect(processManager.getProcess(pid)).toBeUndefined();
    });
  });
});

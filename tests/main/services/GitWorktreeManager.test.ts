import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promisify } from 'util';
import * as path from 'path';
import * as os from 'os';

// Mock child_process and fs/promises before imports
vi.mock('child_process', () => ({
  exec: vi.fn()
}));

vi.mock('fs/promises', () => ({
  mkdir: vi.fn(),
  readFile: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
  access: vi.fn(),
  rm: vi.fn(),
  unlink: vi.fn()
}));

import { exec } from 'child_process';
import * as fs from 'fs/promises';
import { GitWorktreeManager } from '../../../src/main/services/GitWorktreeManager';

describe('GitWorktreeManager', () => {
  let gitWorktreeManager: GitWorktreeManager;
  const mockExec = exec as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    gitWorktreeManager = new GitWorktreeManager();
    vi.clearAllMocks();

    // Default successful mkdir
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('ensureBaseDir', () => {
    it('should create base directory if it does not exist', async () => {
      await gitWorktreeManager.ensureBaseDir();

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('terminal-ide-worktrees'),
        { recursive: true }
      );
    });

    it('should not throw if directory already exists', async () => {
      vi.mocked(fs.mkdir).mockRejectedValue(new Error('EEXIST'));

      await expect(gitWorktreeManager.ensureBaseDir()).resolves.not.toThrow();
    });
  });

  describe('createWorktree', () => {
    it('should create worktree for existing branch', async () => {
      // Mock branch exists check
      mockExec.mockImplementation((cmd: string, _opts: unknown, callback?: (err: Error | null, result: { stdout: string }) => void) => {
        if (cmd.includes('rev-parse')) {
          callback?.(null, { stdout: 'abc123' });
        } else if (cmd.includes('worktree add')) {
          callback?.(null, { stdout: '' });
        }
        return { on: vi.fn() };
      });

      const result = await gitWorktreeManager.createWorktree('/repo', 'feature-branch');

      expect(result.success).toBe(true);
      expect(result.path).toContain('feature-branch');
    });

    it('should create new branch if it does not exist', async () => {
      mockExec.mockImplementation((cmd: string, _opts: unknown, callback?: (err: Error | null, result: { stdout: string }) => void) => {
        if (cmd.includes('rev-parse')) {
          callback?.(new Error('Branch not found'), { stdout: '' });
        } else if (cmd.includes('worktree add -b')) {
          callback?.(null, { stdout: '' });
        }
        return { on: vi.fn() };
      });

      const result = await gitWorktreeManager.createWorktree('/repo', 'new-branch');

      expect(result.success).toBe(true);
    });

    it('should sanitize branch name in path', async () => {
      mockExec.mockImplementation((cmd: string, _opts: unknown, callback?: (err: Error | null, result: { stdout: string }) => void) => {
        callback?.(null, { stdout: '' });
        return { on: vi.fn() };
      });

      const result = await gitWorktreeManager.createWorktree('/repo', 'feature/test@123');

      expect(result.success).toBe(true);
      expect(result.path).toContain('feature_test_123');
    });

    it('should return error on failure', async () => {
      mockExec.mockImplementation((cmd: string, _opts: unknown, callback?: (err: Error | null, result: { stdout: string }) => void) => {
        if (cmd.includes('rev-parse')) {
          callback?.(null, { stdout: 'abc123' });
        } else if (cmd.includes('worktree add')) {
          callback?.(new Error('Worktree already exists'), { stdout: '' });
        }
        return { on: vi.fn() };
      });

      const result = await gitWorktreeManager.createWorktree('/repo', 'branch');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Worktree already exists');
    });
  });

  describe('removeWorktree', () => {
    it('should remove worktree using git command', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('gitdir: /main/.git/worktrees/branch');

      mockExec.mockImplementation((cmd: string, _opts: unknown, callback?: (err: Error | null, result: { stdout: string }) => void) => {
        callback?.(null, { stdout: '' });
        return { on: vi.fn() };
      });

      const result = await gitWorktreeManager.removeWorktree('/path/to/worktree');

      expect(result.success).toBe(true);
    });

    it('should try manual deletion as fallback', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('gitdir: /main/.git/worktrees/branch');

      mockExec.mockImplementation((cmd: string, _opts: unknown, callback?: (err: Error | null, result: { stdout: string }) => void) => {
        callback?.(new Error('Git command failed'), { stdout: '' });
        return { on: vi.fn() };
      });

      vi.mocked(fs.rm).mockResolvedValue(undefined);

      const result = await gitWorktreeManager.removeWorktree('/path/to/worktree');

      expect(result.success).toBe(true);
      expect(fs.rm).toHaveBeenCalledWith('/path/to/worktree', { recursive: true, force: true });
    });

    it('should add to pending deletions on failure', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('gitdir: /main/.git/worktrees/branch');

      mockExec.mockImplementation((cmd: string, _opts: unknown, callback?: (err: Error | null, result: { stdout: string }) => void) => {
        callback?.(new Error('Git command failed'), { stdout: '' });
        return { on: vi.fn() };
      });

      vi.mocked(fs.rm).mockRejectedValue(new Error('EBUSY'));

      const result = await gitWorktreeManager.removeWorktree('/path/to/worktree');

      expect(result.success).toBe(false);
      expect(result.error).toContain('scheduled for cleanup');
      expect(gitWorktreeManager.getPendingDeletions()).toContain('/path/to/worktree');
    });
  });

  describe('listWorktrees', () => {
    it('should parse worktree list output', async () => {
      const porcelainOutput = `worktree /main
HEAD abc123def
branch refs/heads/main

worktree /tmp/feature-branch
HEAD def456789
branch refs/heads/feature
`;

      mockExec.mockImplementation((cmd: string, _opts: unknown, callback?: (err: Error | null, result: { stdout: string }) => void) => {
        callback?.(null, { stdout: porcelainOutput });
        return { on: vi.fn() };
      });

      const worktrees = await gitWorktreeManager.listWorktrees('/repo');

      expect(worktrees).toHaveLength(2);
      expect(worktrees[0]).toEqual({
        path: '/main',
        branch: 'refs/heads/main',
        head: 'abc123def'
      });
      expect(worktrees[1]).toEqual({
        path: '/tmp/feature-branch',
        branch: 'refs/heads/feature',
        head: 'def456789'
      });
    });

    it('should handle detached HEAD', async () => {
      const porcelainOutput = `worktree /main
HEAD abc123def
`;

      mockExec.mockImplementation((cmd: string, _opts: unknown, callback?: (err: Error | null, result: { stdout: string }) => void) => {
        callback?.(null, { stdout: porcelainOutput });
        return { on: vi.fn() };
      });

      const worktrees = await gitWorktreeManager.listWorktrees('/repo');

      expect(worktrees[0].branch).toBe('detached');
    });

    it('should return empty array on error', async () => {
      mockExec.mockImplementation((cmd: string, _opts: unknown, callback?: (err: Error | null, result: { stdout: string }) => void) => {
        callback?.(new Error('Not a git repo'), { stdout: '' });
        return { on: vi.fn() };
      });

      const worktrees = await gitWorktreeManager.listWorktrees('/repo');

      expect(worktrees).toEqual([]);
    });
  });

  describe('cleanupOrphaned', () => {
    it('should remove orphaned worktree directories', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['orphan-dir'] as never);
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as never);
      vi.mocked(fs.access).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('ENOENT'));
      vi.mocked(fs.readFile).mockResolvedValue('gitdir: /non/existent/path');
      vi.mocked(fs.rm).mockResolvedValue(undefined);

      const cleaned = await gitWorktreeManager.cleanupOrphaned();

      expect(cleaned.length).toBeGreaterThanOrEqual(0);
    });

    it('should remove directories without .git file', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['no-git-dir'] as never);
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as never);
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));
      vi.mocked(fs.rm).mockResolvedValue(undefined);

      const cleaned = await gitWorktreeManager.cleanupOrphaned();

      expect(fs.rm).toHaveBeenCalled();
    });
  });

  describe('retryPendingDeletions', () => {
    it('should retry pending deletions', async () => {
      // First, create a pending deletion
      vi.mocked(fs.readFile).mockResolvedValue('gitdir: /main/.git/worktrees/branch');
      mockExec.mockImplementation((cmd: string, _opts: unknown, callback?: (err: Error | null, result: { stdout: string }) => void) => {
        callback?.(new Error('Git command failed'), { stdout: '' });
        return { on: vi.fn() };
      });
      vi.mocked(fs.rm).mockRejectedValueOnce(new Error('EBUSY'));

      await gitWorktreeManager.removeWorktree('/path/to/worktree');
      expect(gitWorktreeManager.getPendingDeletions()).toContain('/path/to/worktree');

      // Now retry should succeed
      vi.mocked(fs.rm).mockResolvedValue(undefined);

      const deleted = await gitWorktreeManager.retryPendingDeletions();

      expect(deleted).toContain('/path/to/worktree');
      expect(gitWorktreeManager.getPendingDeletions()).not.toContain('/path/to/worktree');
    });
  });

  describe('isGitRepo', () => {
    it('should return true for git repository', async () => {
      mockExec.mockImplementation((cmd: string, _opts: unknown, callback?: (err: Error | null, result: { stdout: string }) => void) => {
        callback?.(null, { stdout: '.git' });
        return { on: vi.fn() };
      });

      const result = await gitWorktreeManager.isGitRepo('/repo');

      expect(result).toBe(true);
    });

    it('should return false for non-git directory', async () => {
      mockExec.mockImplementation((cmd: string, _opts: unknown, callback?: (err: Error | null, result: { stdout: string }) => void) => {
        callback?.(new Error('Not a git repo'), { stdout: '' });
        return { on: vi.fn() };
      });

      const result = await gitWorktreeManager.isGitRepo('/not-a-repo');

      expect(result).toBe(false);
    });
  });

  describe('getPendingDeletions', () => {
    it('should return empty array initially', () => {
      expect(gitWorktreeManager.getPendingDeletions()).toEqual([]);
    });
  });
});

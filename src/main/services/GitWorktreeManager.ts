import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import type { WorktreeInfo, WorktreeResult } from '../../shared/types/worktree';

const execAsync = promisify(exec);

// Re-export types for backward compatibility
export type { WorktreeInfo, WorktreeResult } from '../../shared/types/worktree';

export class GitWorktreeManager {
  private worktreeBaseDir: string;
  private pendingDeletions: Set<string> = new Set();

  constructor() {
    this.worktreeBaseDir = path.join(os.tmpdir(), 'terminal-ide-worktrees');
  }

  async ensureBaseDir(): Promise<void> {
    try {
      await fs.mkdir(this.worktreeBaseDir, { recursive: true });
    } catch {
      // Directory exists
    }
  }

  async createWorktree(repoPath: string, branch: string): Promise<WorktreeResult> {
    try {
      await this.ensureBaseDir();

      // Generate unique worktree path
      const timestamp = Date.now();
      const safeBranch = branch.replace(/[^a-zA-Z0-9-_]/g, '_');
      const worktreePath = path.join(
        this.worktreeBaseDir,
        `${safeBranch}-${timestamp}`
      );

      // Check if branch exists
      const branchExists = await this.branchExists(repoPath, branch);

      let command: string;
      if (branchExists) {
        command = `git worktree add "${worktreePath}" "${branch}"`;
      } else {
        // Create new branch from current HEAD
        command = `git worktree add -b "${branch}" "${worktreePath}"`;
      }

      await execAsync(command, { cwd: repoPath });

      return {
        success: true,
        path: worktreePath,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create worktree',
      };
    }
  }

  async removeWorktree(worktreePath: string): Promise<WorktreeResult> {
    try {
      // Find the main repo by checking for .git
      const gitPath = path.join(worktreePath, '.git');
      const gitContent = await fs.readFile(gitPath, 'utf-8');

      // .git file in worktree contains: gitdir: /path/to/main/.git/worktrees/name
      const match = gitContent.match(/gitdir:\s*(.+)/);
      if (match) {
        const mainGitDir = path.dirname(path.dirname(match[1].trim()));
        const mainRepoPath = path.dirname(mainGitDir);

        await execAsync(`git worktree remove "${worktreePath}" --force`, {
          cwd: mainRepoPath,
        });
      }

      // Success - remove from pending if it was there
      this.pendingDeletions.delete(worktreePath);
      return { success: true };
    } catch (error) {
      // Add to pending deletions for retry
      this.pendingDeletions.add(worktreePath);

      // Try manual deletion as fallback
      try {
        await fs.rm(worktreePath, { recursive: true, force: true });
        this.pendingDeletions.delete(worktreePath);
        return { success: true };
      } catch {
        return {
          success: false,
          error: `Folder locked, scheduled for cleanup: ${worktreePath}`,
        };
      }
    }
  }

  async listWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
    try {
      const { stdout } = await execAsync('git worktree list --porcelain', {
        cwd: repoPath,
      });

      const worktrees: WorktreeInfo[] = [];
      const entries = stdout.split('\n\n').filter(Boolean);

      for (const entry of entries) {
        const lines = entry.split('\n');
        const wtPath = lines.find((l) => l.startsWith('worktree '))?.slice(9);
        const head = lines.find((l) => l.startsWith('HEAD '))?.slice(5);
        const branch = lines.find((l) => l.startsWith('branch '))?.slice(7);

        if (wtPath && head) {
          worktrees.push({
            path: wtPath,
            branch: branch || 'detached',
            head,
          });
        }
      }

      return worktrees;
    } catch {
      return [];
    }
  }

  async cleanupOrphaned(): Promise<string[]> {
    const cleaned: string[] = [];

    try {
      await this.ensureBaseDir();
      const entries = await fs.readdir(this.worktreeBaseDir);

      for (const entry of entries) {
        const worktreePath = path.join(this.worktreeBaseDir, entry);
        const stat = await fs.stat(worktreePath);

        if (stat.isDirectory()) {
          // Check if .git file exists and is valid
          const gitPath = path.join(worktreePath, '.git');
          try {
            await fs.access(gitPath);
            // Check if the main repo still references this worktree
            const gitContent = await fs.readFile(gitPath, 'utf-8');
            const match = gitContent.match(/gitdir:\s*(.+)/);
            if (match) {
              const worktreeGitDir = match[1].trim();
              try {
                await fs.access(worktreeGitDir);
              } catch {
                // Worktree is orphaned
                await fs.rm(worktreePath, { recursive: true, force: true });
                cleaned.push(worktreePath);
              }
            }
          } catch {
            // No .git file, remove directory
            await fs.rm(worktreePath, { recursive: true, force: true });
            cleaned.push(worktreePath);
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up orphaned worktrees:', error);
    }

    return cleaned;
  }

  async retryPendingDeletions(): Promise<string[]> {
    const deleted: string[] = [];
    for (const worktreePath of this.pendingDeletions) {
      try {
        await fs.rm(worktreePath, { recursive: true, force: true });
        this.pendingDeletions.delete(worktreePath);
        deleted.push(worktreePath);
      } catch {
        // Still locked, will retry later
      }
    }
    return deleted;
  }

  getPendingDeletions(): string[] {
    return Array.from(this.pendingDeletions);
  }

  private async branchExists(repoPath: string, branch: string): Promise<boolean> {
    try {
      await execAsync(`git rev-parse --verify "${branch}"`, { cwd: repoPath });
      return true;
    } catch {
      return false;
    }
  }

  async isGitRepo(dirPath: string): Promise<boolean> {
    try {
      await execAsync('git rev-parse --git-dir', { cwd: dirPath });
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const gitWorktreeManager = new GitWorktreeManager();

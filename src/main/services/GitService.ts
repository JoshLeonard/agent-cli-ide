import { spawn } from 'child_process';
import type {
  GitStatus,
  GitStatusFile,
  GitStatusResult,
  GitBranch,
  GitBranchListResult,
  GitLogEntry,
  GitLogResult,
  GitStash,
  GitStashListResult,
  GitTag,
  GitTagListResult,
  GitRemote,
  GitRemoteListResult,
  GitDiff,
  GitDiffHunk,
  GitDiffLine,
  GitDiffResult,
  GitOperationResult,
  GitCommitResult,
  GitPushResult,
  GitPullResult,
  GitFetchResult,
  GitMergeResult,
  GitFileStatus,
} from '../../shared/types/git';

interface GitExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function execGit(cwd: string, args: string[]): Promise<GitExecResult> {
  return new Promise((resolve) => {
    // Don't use shell: true on Windows as it causes issues with % in format strings
    const proc = spawn('git', args, { cwd });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (exitCode) => {
      resolve({ stdout, stderr, exitCode: exitCode ?? 1 });
    });

    proc.on('error', (error) => {
      stderr = error.message;
      resolve({ stdout, stderr, exitCode: 1 });
    });
  });
}

export class GitService {
  /**
   * Get the current git status for a repository
   */
  async getStatus(repoPath: string): Promise<GitStatusResult> {
    try {
      // Get branch and tracking info
      const branchResult = await execGit(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD']);
      const branch = branchResult.exitCode === 0 ? branchResult.stdout.trim() : 'HEAD';

      // Get upstream tracking info
      let upstream: string | undefined;
      let ahead = 0;
      let behind = 0;

      const upstreamResult = await execGit(repoPath, [
        'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'
      ]);
      if (upstreamResult.exitCode === 0) {
        upstream = upstreamResult.stdout.trim();

        // Get ahead/behind counts
        const countResult = await execGit(repoPath, [
          'rev-list', '--left-right', '--count', `${branch}...${upstream}`
        ]);
        if (countResult.exitCode === 0) {
          const parts = countResult.stdout.trim().split(/\s+/);
          ahead = parseInt(parts[0], 10) || 0;
          behind = parseInt(parts[1], 10) || 0;
        }
      }

      // Get file status with porcelain v2 for detailed info
      const statusResult = await execGit(repoPath, ['status', '--porcelain=v2', '--branch']);
      if (statusResult.exitCode !== 0) {
        return { success: false, error: statusResult.stderr || 'Failed to get status' };
      }

      const files: GitStatusFile[] = [];
      let hasConflicts = false;

      const lines = statusResult.stdout.split('\n');
      for (const line of lines) {
        if (!line) continue;

        // Parse porcelain v2 output
        if (line.startsWith('1 ') || line.startsWith('2 ')) {
          // Changed entry
          const parts = line.split(' ');
          const xy = parts[1];
          const indexStatus = xy[0] as GitFileStatus;
          const workTreeStatus = xy[1] as GitFileStatus;

          // For renames (type 2), path is after the last tab
          let path: string;
          let originalPath: string | undefined;

          if (line.startsWith('2 ')) {
            const tabIndex = line.lastIndexOf('\t');
            const pathPart = line.substring(tabIndex + 1);
            const paths = pathPart.split('\t');
            originalPath = paths[0];
            path = paths[1] || paths[0];
          } else {
            // Path is after the last space
            path = parts[parts.length - 1];
          }

          const hasConflict = indexStatus === 'U' || workTreeStatus === 'U';
          if (hasConflict) hasConflicts = true;

          files.push({
            path,
            indexStatus,
            workTreeStatus,
            originalPath,
            isStaged: indexStatus !== ' ' && indexStatus !== '?',
            isUntracked: false,
            hasConflict,
          });
        } else if (line.startsWith('? ')) {
          // Untracked file
          const path = line.substring(2);
          files.push({
            path,
            indexStatus: '?',
            workTreeStatus: '?',
            isStaged: false,
            isUntracked: true,
            hasConflict: false,
          });
        } else if (line.startsWith('u ')) {
          // Unmerged entry (conflict)
          const parts = line.split(' ');
          const path = parts[parts.length - 1];
          hasConflicts = true;

          files.push({
            path,
            indexStatus: 'U',
            workTreeStatus: 'U',
            isStaged: false,
            isUntracked: false,
            hasConflict: true,
          });
        }
      }

      // Get stash count
      const stashResult = await execGit(repoPath, ['stash', 'list']);
      const stashCount = stashResult.exitCode === 0
        ? stashResult.stdout.split('\n').filter(l => l.trim()).length
        : 0;

      const status: GitStatus = {
        branch,
        upstream,
        ahead,
        behind,
        files,
        hasConflicts,
        stashCount,
        isClean: files.length === 0,
      };

      return { success: true, status };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Stage files for commit
   */
  async stage(repoPath: string, paths: string[]): Promise<GitOperationResult> {
    try {
      const result = await execGit(repoPath, ['add', '--', ...paths]);
      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr || 'Failed to stage files' };
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Stage all changes
   */
  async stageAll(repoPath: string): Promise<GitOperationResult> {
    try {
      const result = await execGit(repoPath, ['add', '-A']);
      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr || 'Failed to stage all files' };
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Unstage files
   */
  async unstage(repoPath: string, paths: string[]): Promise<GitOperationResult> {
    try {
      const result = await execGit(repoPath, ['reset', 'HEAD', '--', ...paths]);
      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr || 'Failed to unstage files' };
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Unstage all files
   */
  async unstageAll(repoPath: string): Promise<GitOperationResult> {
    try {
      const result = await execGit(repoPath, ['reset', 'HEAD']);
      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr || 'Failed to unstage all files' };
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Discard changes in working directory
   */
  async discard(repoPath: string, paths: string[]): Promise<GitOperationResult> {
    try {
      const result = await execGit(repoPath, ['checkout', '--', ...paths]);
      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr || 'Failed to discard changes' };
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create a commit
   */
  async commit(repoPath: string, message: string, amend = false): Promise<GitCommitResult> {
    try {
      const args = ['commit', '-m', message];
      if (amend) args.push('--amend');

      const result = await execGit(repoPath, args);
      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr || 'Failed to commit' };
      }

      // Get the commit SHA
      const shaResult = await execGit(repoPath, ['rev-parse', 'HEAD']);
      const sha = shaResult.exitCode === 0 ? shaResult.stdout.trim() : undefined;

      return { success: true, sha };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Push to remote
   */
  async push(
    repoPath: string,
    remote = 'origin',
    branch?: string,
    force = false,
    setUpstream = false
  ): Promise<GitPushResult> {
    try {
      const args = ['push'];
      if (force) args.push('--force');
      if (setUpstream) args.push('-u');
      args.push(remote);
      if (branch) args.push(branch);

      const result = await execGit(repoPath, args);
      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr || 'Failed to push' };
      }

      const upToDate = result.stderr.includes('Everything up-to-date');
      return { success: true, pushed: !upToDate, upToDate };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Pull from remote
   */
  async pull(
    repoPath: string,
    remote?: string,
    branch?: string,
    rebase = false
  ): Promise<GitPullResult> {
    try {
      const args = ['pull'];
      if (rebase) args.push('--rebase');
      if (remote) args.push(remote);
      if (branch) args.push(branch);

      const result = await execGit(repoPath, args);
      if (result.exitCode !== 0) {
        // Check for conflicts
        if (result.stderr.includes('CONFLICT') || result.stdout.includes('CONFLICT')) {
          const conflicts = this.parseConflictPaths(result.stdout + result.stderr);
          return { success: false, conflicts, error: 'Merge conflicts detected' };
        }
        return { success: false, error: result.stderr || 'Failed to pull' };
      }

      const upToDate = result.stdout.includes('Already up to date');
      return { success: true, updated: !upToDate, upToDate };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Fetch from remote
   */
  async fetch(repoPath: string, remote?: string, prune = false): Promise<GitFetchResult> {
    try {
      const args = ['fetch'];
      if (prune) args.push('--prune');
      if (remote) args.push(remote);
      else args.push('--all');

      const result = await execGit(repoPath, args);
      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr || 'Failed to fetch' };
      }

      return { success: true, fetched: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get list of branches
   */
  async getBranches(repoPath: string, includeRemote = true): Promise<GitBranchListResult> {
    try {
      const args = ['branch', '-v', '--format=%(refname:short)|%(HEAD)|%(upstream:short)|%(upstream:track)'];
      if (includeRemote) args.push('-a');

      const result = await execGit(repoPath, args);
      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr || 'Failed to get branches' };
      }

      const branches: GitBranch[] = [];
      let current: string | undefined;

      for (const line of result.stdout.split('\n')) {
        if (!line.trim()) continue;

        const parts = line.split('|');
        const name = parts[0];
        const isCurrent = parts[1] === '*';
        const upstream = parts[2] || undefined;
        const track = parts[3] || '';

        if (isCurrent) current = name;

        // Parse ahead/behind from track string like "[ahead 1, behind 2]"
        let ahead = 0;
        let behind = 0;
        const aheadMatch = track.match(/ahead (\d+)/);
        const behindMatch = track.match(/behind (\d+)/);
        if (aheadMatch) ahead = parseInt(aheadMatch[1], 10);
        if (behindMatch) behind = parseInt(behindMatch[1], 10);

        const isRemote = name.startsWith('remotes/') || name.includes('/');

        branches.push({
          name,
          current: isCurrent,
          remote: isRemote ? name.split('/')[1] : undefined,
          upstream,
          ahead,
          behind,
        });
      }

      return { success: true, branches, current };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create a new branch
   */
  async createBranch(
    repoPath: string,
    name: string,
    startPoint?: string,
    checkout = false
  ): Promise<GitOperationResult> {
    try {
      const args = checkout ? ['checkout', '-b', name] : ['branch', name];
      if (startPoint) args.push(startPoint);

      const result = await execGit(repoPath, args);
      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr || 'Failed to create branch' };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Delete a branch
   */
  async deleteBranch(repoPath: string, name: string, force = false): Promise<GitOperationResult> {
    try {
      const args = ['branch', force ? '-D' : '-d', name];
      const result = await execGit(repoPath, args);
      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr || 'Failed to delete branch' };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Checkout a branch or commit
   */
  async checkout(repoPath: string, target: string, createBranch = false): Promise<GitOperationResult> {
    try {
      const args = ['checkout'];
      if (createBranch) args.push('-b');
      args.push(target);

      const result = await execGit(repoPath, args);
      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr || 'Failed to checkout' };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Merge a branch
   */
  async merge(
    repoPath: string,
    branch: string,
    noFastForward = false,
    squash = false
  ): Promise<GitMergeResult> {
    try {
      const args = ['merge'];
      if (noFastForward) args.push('--no-ff');
      if (squash) args.push('--squash');
      args.push(branch);

      const result = await execGit(repoPath, args);
      if (result.exitCode !== 0) {
        // Check for conflicts
        if (result.stderr.includes('CONFLICT') || result.stdout.includes('CONFLICT')) {
          const conflicts = this.parseConflictPaths(result.stdout + result.stderr);
          return { success: false, conflicts, error: 'Merge conflicts detected' };
        }
        return { success: false, error: result.stderr || 'Failed to merge' };
      }

      return { success: true, merged: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Abort an in-progress merge
   */
  async abortMerge(repoPath: string): Promise<GitOperationResult> {
    try {
      const result = await execGit(repoPath, ['merge', '--abort']);
      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr || 'Failed to abort merge' };
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get commit log
   */
  async getLog(
    repoPath: string,
    maxCount = 100,
    skip = 0,
    branch?: string,
    path?: string
  ): Promise<GitLogResult> {
    try {
      const format = '%H|%h|%s|%b|%an|%ae|%at|%P|%D';
      const args = [
        'log',
        `--format=${format}`,
        `-n${maxCount}`,
        `--skip=${skip}`,
      ];
      if (branch) args.push(branch);
      if (path) {
        args.push('--');
        args.push(path);
      }

      const result = await execGit(repoPath, args);
      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr || 'Failed to get log' };
      }

      const commits: GitLogEntry[] = [];
      const entries = result.stdout.split('\n').filter(l => l.trim());

      for (const entry of entries) {
        const parts = entry.split('|');
        if (parts.length < 8) continue;

        commits.push({
          sha: parts[0],
          shortSha: parts[1],
          message: parts[2],
          body: parts[3] || undefined,
          author: parts[4],
          authorEmail: parts[5],
          date: parseInt(parts[6], 10) * 1000,
          parents: parts[7] ? parts[7].split(' ') : [],
          refs: parts[8] ? parts[8].split(', ').filter(r => r) : [],
        });
      }

      return { success: true, commits };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get diff for staged or unstaged changes
   */
  async getDiff(
    repoPath: string,
    cached = false,
    path?: string,
    ref1?: string,
    ref2?: string
  ): Promise<GitDiffResult> {
    try {
      const args = ['diff'];
      if (cached) args.push('--cached');
      if (ref1) args.push(ref1);
      if (ref2) args.push(ref2);
      if (path) {
        args.push('--');
        args.push(path);
      }

      const result = await execGit(repoPath, args);
      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr || 'Failed to get diff' };
      }

      const diffs = this.parseDiff(result.stdout);
      return { success: true, diffs };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get stash list
   */
  async getStashes(repoPath: string): Promise<GitStashListResult> {
    try {
      const result = await execGit(repoPath, [
        'stash', 'list', '--format=%gd|%gs|%s|%at'
      ]);
      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr || 'Failed to get stashes' };
      }

      const stashes: GitStash[] = [];
      for (const line of result.stdout.split('\n')) {
        if (!line.trim()) continue;

        const parts = line.split('|');
        const indexMatch = parts[0].match(/stash@\{(\d+)\}/);
        const index = indexMatch ? parseInt(indexMatch[1], 10) : 0;

        stashes.push({
          index,
          message: parts[1] || parts[2] || 'stash',
          branch: '',
          date: parseInt(parts[3], 10) * 1000,
        });
      }

      return { success: true, stashes };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create a stash
   */
  async stash(repoPath: string, message?: string, includeUntracked = false): Promise<GitOperationResult> {
    try {
      const args = ['stash', 'push'];
      if (includeUntracked) args.push('-u');
      if (message) {
        args.push('-m');
        args.push(message);
      }

      const result = await execGit(repoPath, args);
      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr || 'Failed to stash' };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Apply a stash
   */
  async stashApply(repoPath: string, index = 0, pop = false): Promise<GitOperationResult> {
    try {
      const args = ['stash', pop ? 'pop' : 'apply', `stash@{${index}}`];
      const result = await execGit(repoPath, args);
      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr || 'Failed to apply stash' };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Drop a stash
   */
  async stashDrop(repoPath: string, index: number): Promise<GitOperationResult> {
    try {
      const result = await execGit(repoPath, ['stash', 'drop', `stash@{${index}}`]);
      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr || 'Failed to drop stash' };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get tag list
   */
  async getTags(repoPath: string): Promise<GitTagListResult> {
    try {
      const result = await execGit(repoPath, [
        'tag', '-l', '--format=%(refname:short)|%(objectname:short)|%(contents:subject)|%(taggername)|%(creatordate:unix)|%(objecttype)'
      ]);
      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr || 'Failed to get tags' };
      }

      const tags: GitTag[] = [];
      for (const line of result.stdout.split('\n')) {
        if (!line.trim()) continue;

        const parts = line.split('|');
        tags.push({
          name: parts[0],
          sha: parts[1],
          message: parts[2] || undefined,
          tagger: parts[3] || undefined,
          date: parts[4] ? parseInt(parts[4], 10) * 1000 : undefined,
          isAnnotated: parts[5] === 'tag',
        });
      }

      return { success: true, tags };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get remote list
   */
  async getRemotes(repoPath: string): Promise<GitRemoteListResult> {
    try {
      const result = await execGit(repoPath, ['remote', '-v']);
      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr || 'Failed to get remotes' };
      }

      const remoteMap = new Map<string, { fetchUrl?: string; pushUrl?: string }>();

      for (const line of result.stdout.split('\n')) {
        if (!line.trim()) continue;

        const match = line.match(/^(\S+)\s+(\S+)\s+\((\w+)\)$/);
        if (!match) continue;

        const [, name, url, type] = match;
        if (!remoteMap.has(name)) {
          remoteMap.set(name, {});
        }
        const remote = remoteMap.get(name)!;
        if (type === 'fetch') remote.fetchUrl = url;
        if (type === 'push') remote.pushUrl = url;
      }

      const remotes: GitRemote[] = [];
      for (const [name, urls] of remoteMap) {
        remotes.push({
          name,
          fetchUrl: urls.fetchUrl || '',
          pushUrl: urls.pushUrl || urls.fetchUrl || '',
        });
      }

      return { success: true, remotes };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Helper: Parse conflict paths from git output
  private parseConflictPaths(output: string): string[] {
    const conflicts: string[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      // Match patterns like "CONFLICT (content): Merge conflict in <path>"
      const match = line.match(/CONFLICT.*:\s+.*in\s+(.+)$/);
      if (match) {
        conflicts.push(match[1].trim());
      }
    }

    return conflicts;
  }

  // Helper: Parse diff output
  private parseDiff(diffOutput: string): GitDiff[] {
    const diffs: GitDiff[] = [];
    const fileRegex = /^diff --git a\/(.+) b\/(.+)$/gm;
    const hunks = diffOutput.split(/^diff --git /m).filter(d => d.trim());

    for (const chunk of hunks) {
      const lines = ('diff --git ' + chunk).split('\n');
      if (lines.length === 0) continue;

      const headerMatch = lines[0].match(/^diff --git a\/(.+) b\/(.+)$/);
      if (!headerMatch) continue;

      const oldPath = headerMatch[1];
      const newPath = headerMatch[2];
      const isRename = oldPath !== newPath;

      let additions = 0;
      let deletions = 0;
      let binary = false;
      const diffHunks: GitDiffHunk[] = [];

      let currentHunk: GitDiffHunk | null = null;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith('Binary files')) {
          binary = true;
          continue;
        }

        // Hunk header
        const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/);
        if (hunkMatch) {
          currentHunk = {
            oldStart: parseInt(hunkMatch[1], 10),
            oldLines: parseInt(hunkMatch[2] || '1', 10),
            newStart: parseInt(hunkMatch[3], 10),
            newLines: parseInt(hunkMatch[4] || '1', 10),
            header: hunkMatch[5] || '',
            lines: [],
          };
          diffHunks.push(currentHunk);
          continue;
        }

        if (currentHunk) {
          if (line.startsWith('+') && !line.startsWith('+++')) {
            additions++;
            currentHunk.lines.push({
              type: 'add',
              content: line.substring(1),
            });
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            deletions++;
            currentHunk.lines.push({
              type: 'remove',
              content: line.substring(1),
            });
          } else if (line.startsWith(' ')) {
            currentHunk.lines.push({
              type: 'context',
              content: line.substring(1),
            });
          }
        }
      }

      diffs.push({
        filePath: newPath,
        oldPath: isRename ? oldPath : undefined,
        additions,
        deletions,
        binary,
        hunks: diffHunks,
      });
    }

    return diffs;
  }
}

// Singleton instance
export const gitService = new GitService();

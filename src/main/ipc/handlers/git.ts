import { ipcMain } from 'electron';
import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { gitService } from '../../services/GitService';
import type {
  GitStageRequest,
  GitUnstageRequest,
  GitCommitRequest,
  GitPushRequest,
  GitPullRequest,
  GitFetchRequest,
  GitBranchCreateRequest,
  GitBranchDeleteRequest,
  GitCheckoutRequest,
  GitMergeRequest,
  GitStashRequest,
  GitStashApplyRequest,
  GitStashDropRequest,
  GitLogRequest,
  GitDiffRequest,
  GitDiscardRequest,
} from '../../../shared/types/git';

export function registerGitHandlers(): void {
  // Status
  ipcMain.handle('git:status', async (_event, { repoPath }: { repoPath: string }) => {
    return gitService.getStatus(repoPath);
  });

  // Stage/Unstage
  ipcMain.handle('git:stage', async (_event, request: GitStageRequest) => {
    return gitService.stage(request.repoPath, request.paths);
  });

  ipcMain.handle('git:stageAll', async (_event, { repoPath }: { repoPath: string }) => {
    return gitService.stageAll(repoPath);
  });

  ipcMain.handle('git:unstage', async (_event, request: GitUnstageRequest) => {
    return gitService.unstage(request.repoPath, request.paths);
  });

  ipcMain.handle('git:unstageAll', async (_event, { repoPath }: { repoPath: string }) => {
    return gitService.unstageAll(repoPath);
  });

  ipcMain.handle('git:discard', async (_event, request: GitDiscardRequest) => {
    return gitService.discard(request.repoPath, request.paths);
  });

  // Commit
  ipcMain.handle('git:commit', async (_event, request: GitCommitRequest) => {
    return gitService.commit(request.repoPath, request.message, request.amend);
  });

  // Push/Pull/Fetch
  ipcMain.handle('git:push', async (_event, request: GitPushRequest) => {
    return gitService.push(
      request.repoPath,
      request.remote,
      request.branch,
      request.force,
      request.setUpstream
    );
  });

  ipcMain.handle('git:pull', async (_event, request: GitPullRequest) => {
    return gitService.pull(
      request.repoPath,
      request.remote,
      request.branch,
      request.rebase
    );
  });

  ipcMain.handle('git:fetch', async (_event, request: GitFetchRequest) => {
    return gitService.fetch(request.repoPath, request.remote, request.prune);
  });

  // Branches
  ipcMain.handle(
    'git:branches',
    async (_event, { repoPath, includeRemote }: { repoPath: string; includeRemote?: boolean }) => {
      return gitService.getBranches(repoPath, includeRemote);
    }
  );

  ipcMain.handle('git:createBranch', async (_event, request: GitBranchCreateRequest) => {
    return gitService.createBranch(
      request.repoPath,
      request.name,
      request.startPoint,
      request.checkout
    );
  });

  ipcMain.handle('git:deleteBranch', async (_event, request: GitBranchDeleteRequest) => {
    return gitService.deleteBranch(request.repoPath, request.name, request.force);
  });

  ipcMain.handle('git:checkout', async (_event, request: GitCheckoutRequest) => {
    return gitService.checkout(request.repoPath, request.target, request.createBranch);
  });

  // Merge
  ipcMain.handle('git:merge', async (_event, request: GitMergeRequest) => {
    return gitService.merge(
      request.repoPath,
      request.branch,
      request.noFastForward,
      request.squash
    );
  });

  ipcMain.handle('git:abortMerge', async (_event, { repoPath }: { repoPath: string }) => {
    return gitService.abortMerge(repoPath);
  });

  // Log
  ipcMain.handle('git:log', async (_event, request: GitLogRequest) => {
    return gitService.getLog(
      request.repoPath,
      request.maxCount,
      request.skip,
      request.branch,
      request.path
    );
  });

  // Diff
  ipcMain.handle('git:diff', async (_event, request: GitDiffRequest) => {
    return gitService.getDiff(
      request.repoPath,
      request.cached,
      request.path,
      request.ref1,
      request.ref2
    );
  });

  // Stashes
  ipcMain.handle('git:stashes', async (_event, { repoPath }: { repoPath: string }) => {
    return gitService.getStashes(repoPath);
  });

  ipcMain.handle('git:stash', async (_event, request: GitStashRequest) => {
    return gitService.stash(request.repoPath, request.message, request.includeUntracked);
  });

  ipcMain.handle('git:stashApply', async (_event, request: GitStashApplyRequest) => {
    return gitService.stashApply(request.repoPath, request.index, request.pop);
  });

  ipcMain.handle('git:stashDrop', async (_event, request: GitStashDropRequest) => {
    return gitService.stashDrop(request.repoPath, request.index);
  });

  // Tags
  ipcMain.handle('git:tags', async (_event, { repoPath }: { repoPath: string }) => {
    return gitService.getTags(repoPath);
  });

  // Remotes
  ipcMain.handle('git:remotes', async (_event, { repoPath }: { repoPath: string }) => {
    return gitService.getRemotes(repoPath);
  });

  // Show file contents at a specific ref, or working copy if ref is empty
  ipcMain.handle(
    'git:showFile',
    async (_event, { repoPath, ref, filePath }: { repoPath: string; ref: string; filePath: string }) => {
      if (!ref) {
        // Read the actual working copy file
        try {
          const fullPath = path.join(repoPath, filePath);
          const content = await fs.readFile(fullPath, 'utf-8');
          return { success: true, content };
        } catch {
          return { success: true, content: '' };
        }
      }
      return new Promise<{ success: boolean; content?: string; error?: string }>((resolve) => {
        exec(
          `git show "${ref}:${filePath}"`,
          { cwd: repoPath, maxBuffer: 5 * 1024 * 1024 },
          (err, stdout) => {
            if (err) {
              // File might not exist in that ref (new file)
              resolve({ success: true, content: '' });
            } else {
              resolve({ success: true, content: stdout });
            }
          }
        );
      });
    }
  );
}

export function unregisterGitHandlers(): void {
  ipcMain.removeHandler('git:status');
  ipcMain.removeHandler('git:stage');
  ipcMain.removeHandler('git:stageAll');
  ipcMain.removeHandler('git:unstage');
  ipcMain.removeHandler('git:unstageAll');
  ipcMain.removeHandler('git:discard');
  ipcMain.removeHandler('git:commit');
  ipcMain.removeHandler('git:push');
  ipcMain.removeHandler('git:pull');
  ipcMain.removeHandler('git:fetch');
  ipcMain.removeHandler('git:branches');
  ipcMain.removeHandler('git:createBranch');
  ipcMain.removeHandler('git:deleteBranch');
  ipcMain.removeHandler('git:checkout');
  ipcMain.removeHandler('git:merge');
  ipcMain.removeHandler('git:abortMerge');
  ipcMain.removeHandler('git:log');
  ipcMain.removeHandler('git:diff');
  ipcMain.removeHandler('git:stashes');
  ipcMain.removeHandler('git:stash');
  ipcMain.removeHandler('git:stashApply');
  ipcMain.removeHandler('git:stashDrop');
  ipcMain.removeHandler('git:tags');
  ipcMain.removeHandler('git:remotes');
  ipcMain.removeHandler('git:showFile');
}

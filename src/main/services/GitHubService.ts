import { spawn } from 'child_process';
import type {
  GitHubPullRequest,
  GitHubPRFile,
  GitHubAuthResult,
  GitHubPRListResult,
  GitHubPRResult,
  GitHubPRFilesResult,
  GitHubPRDiffResult,
  GitHubSubmitReviewResult,
  ReviewDecision,
  ReviewComment,
} from '../../shared/types/codeReview';

interface GhExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Execute gh CLI command
 */
function execGh(cwd: string, args: string[]): Promise<GhExecResult> {
  return new Promise((resolve) => {
    const proc = spawn('gh', args, { cwd, shell: process.platform === 'win32' });
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

/**
 * Parse owner/repo from git remote URL or repo path
 */
async function getRepoIdentifier(repoPath: string): Promise<{ owner: string; repo: string } | null> {
  // Use gh to get the repo info
  const result = await execGh(repoPath, ['repo', 'view', '--json', 'owner,name']);
  if (result.exitCode !== 0) {
    return null;
  }

  try {
    const data = JSON.parse(result.stdout);
    return {
      owner: data.owner.login,
      repo: data.name,
    };
  } catch {
    return null;
  }
}

export class GitHubService {
  /**
   * Check if gh CLI is authenticated
   */
  async isAuthenticated(repoPath: string): Promise<GitHubAuthResult> {
    try {
      const result = await execGh(repoPath, ['auth', 'status', '--hostname', 'github.com']);

      if (result.exitCode === 0 || result.stderr.includes('Logged in')) {
        // Extract username from output
        const match = result.stderr.match(/Logged in to github\.com account (\S+)/);
        const username = match ? match[1] : undefined;

        return {
          success: true,
          authenticated: true,
          username,
        };
      }

      return {
        success: true,
        authenticated: false,
        error: 'Not authenticated with GitHub CLI',
      };
    } catch (error) {
      return {
        success: false,
        authenticated: false,
        error: error instanceof Error ? error.message : 'Unknown error checking auth status',
      };
    }
  }

  /**
   * List open pull requests for the repository
   */
  async listOpenPRs(repoPath: string): Promise<GitHubPRListResult> {
    try {
      const result = await execGh(repoPath, [
        'pr', 'list',
        '--state', 'open',
        '--json', 'number,title,body,state,author,headRefName,baseRefName,url,additions,deletions,changedFiles,createdAt,updatedAt',
        '--limit', '50',
      ]);

      if (result.exitCode !== 0) {
        return {
          success: false,
          error: result.stderr || 'Failed to list PRs',
        };
      }

      const data = JSON.parse(result.stdout);
      const pullRequests: GitHubPullRequest[] = data.map((pr: {
        number: number;
        title: string;
        body: string | null;
        state: string;
        author: { login: string };
        headRefName: string;
        baseRefName: string;
        url: string;
        additions: number;
        deletions: number;
        changedFiles: number;
        createdAt: string;
        updatedAt: string;
      }) => ({
        number: pr.number,
        title: pr.title,
        body: pr.body,
        state: pr.state.toLowerCase() as 'open' | 'closed' | 'merged',
        author: pr.author.login,
        headBranch: pr.headRefName,
        baseBranch: pr.baseRefName,
        url: pr.url,
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changedFiles,
        createdAt: pr.createdAt,
        updatedAt: pr.updatedAt,
      }));

      return {
        success: true,
        pullRequests,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error listing PRs',
      };
    }
  }

  /**
   * Get a specific pull request
   */
  async getPR(repoPath: string, prNumber: number): Promise<GitHubPRResult> {
    try {
      const result = await execGh(repoPath, [
        'pr', 'view', String(prNumber),
        '--json', 'number,title,body,state,author,headRefName,baseRefName,url,additions,deletions,changedFiles,createdAt,updatedAt',
      ]);

      if (result.exitCode !== 0) {
        return {
          success: false,
          error: result.stderr || 'Failed to get PR',
        };
      }

      const pr = JSON.parse(result.stdout);
      const pullRequest: GitHubPullRequest = {
        number: pr.number,
        title: pr.title,
        body: pr.body,
        state: pr.state.toLowerCase() as 'open' | 'closed' | 'merged',
        author: pr.author.login,
        headBranch: pr.headRefName,
        baseBranch: pr.baseRefName,
        url: pr.url,
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changedFiles,
        createdAt: pr.createdAt,
        updatedAt: pr.updatedAt,
      };

      return {
        success: true,
        pullRequest,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error getting PR',
      };
    }
  }

  /**
   * Get files changed in a pull request
   */
  async getPRFiles(repoPath: string, prNumber: number): Promise<GitHubPRFilesResult> {
    try {
      const repoId = await getRepoIdentifier(repoPath);
      if (!repoId) {
        return {
          success: false,
          error: 'Could not determine repository owner/name',
        };
      }

      const result = await execGh(repoPath, [
        'api',
        `repos/${repoId.owner}/${repoId.repo}/pulls/${prNumber}/files`,
        '--paginate',
      ]);

      if (result.exitCode !== 0) {
        return {
          success: false,
          error: result.stderr || 'Failed to get PR files',
        };
      }

      const data = JSON.parse(result.stdout);
      const files: GitHubPRFile[] = data.map((file: {
        filename: string;
        status: string;
        additions: number;
        deletions: number;
        patch?: string;
        previous_filename?: string;
      }) => ({
        filename: file.filename,
        status: file.status as GitHubPRFile['status'],
        additions: file.additions,
        deletions: file.deletions,
        patch: file.patch,
        previousFilename: file.previous_filename,
      }));

      return {
        success: true,
        files,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error getting PR files',
      };
    }
  }

  /**
   * Get the full diff for a pull request
   */
  async getPRDiff(repoPath: string, prNumber: number): Promise<GitHubPRDiffResult> {
    try {
      const result = await execGh(repoPath, [
        'pr', 'diff', String(prNumber),
      ]);

      if (result.exitCode !== 0) {
        return {
          success: false,
          error: result.stderr || 'Failed to get PR diff',
        };
      }

      return {
        success: true,
        diff: result.stdout,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error getting PR diff',
      };
    }
  }

  /**
   * Checkout PR to a worktree for review
   */
  async checkoutPRToWorktree(
    repoPath: string,
    prNumber: number,
    worktreePath: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // First fetch the PR
      const fetchResult = await execGh(repoPath, [
        'pr', 'checkout', String(prNumber),
        '--detach',
      ]);

      // Get the PR head ref
      const prResult = await this.getPR(repoPath, prNumber);
      if (!prResult.success || !prResult.pullRequest) {
        return { success: false, error: prResult.error || 'Failed to get PR info' };
      }

      // Create worktree with PR branch
      const worktreeResult = await new Promise<GhExecResult>((resolve) => {
        const proc = spawn('git', [
          'worktree', 'add',
          worktreePath,
          `origin/${prResult.pullRequest!.headBranch}`,
        ], { cwd: repoPath });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        proc.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        proc.on('close', (exitCode: number | null) => {
          resolve({ stdout, stderr, exitCode: exitCode ?? 1 });
        });

        proc.on('error', (error: Error) => {
          resolve({ stdout, stderr: error.message, exitCode: 1 });
        });
      });

      if (worktreeResult.exitCode !== 0) {
        return {
          success: false,
          error: worktreeResult.stderr || 'Failed to create worktree',
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error checking out PR',
      };
    }
  }

  /**
   * Submit a review to a pull request
   */
  async submitReview(
    repoPath: string,
    prNumber: number,
    decision: ReviewDecision,
    comments: ReviewComment[],
    body?: string
  ): Promise<GitHubSubmitReviewResult> {
    try {
      const repoId = await getRepoIdentifier(repoPath);
      if (!repoId) {
        return {
          success: false,
          error: 'Could not determine repository owner/name',
        };
      }

      // Map decision to GitHub event
      const eventMap: Record<ReviewDecision, string> = {
        'APPROVE': 'APPROVE',
        'REQUEST_CHANGES': 'REQUEST_CHANGES',
        'COMMENT': 'COMMENT',
      };

      // Filter out ignored comments and format for GitHub
      const reviewComments = comments
        .filter(c => c.status !== 'ignored')
        .map(c => {
          // Format code suggestion if present
          let commentBody = c.body;
          if (c.suggestion) {
            commentBody += `\n\n\`\`\`suggestion\n${c.suggestion}\n\`\`\``;
          }

          return {
            path: c.filePath,
            line: c.lineNumber,
            side: c.side,
            body: commentBody,
          };
        });

      // Build the review payload
      const payload = {
        event: eventMap[decision],
        body: body || '',
        comments: reviewComments,
      };

      // Submit via API
      const result = await execGh(repoPath, [
        'api',
        `repos/${repoId.owner}/${repoId.repo}/pulls/${prNumber}/reviews`,
        '-X', 'POST',
        '-f', `event=${payload.event}`,
        '-f', `body=${payload.body}`,
        ...(reviewComments.length > 0
          ? ['-f', `comments=${JSON.stringify(reviewComments)}`]
          : []
        ),
      ]);

      if (result.exitCode !== 0) {
        // Try alternative approach: submit each comment individually, then submit review
        return this.submitReviewWithIndividualComments(
          repoPath,
          prNumber,
          decision,
          comments,
          body,
          repoId
        );
      }

      const response = JSON.parse(result.stdout);
      return {
        success: true,
        reviewId: response.id,
        url: response.html_url,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error submitting review',
      };
    }
  }

  /**
   * Alternative method to submit review with individual comments
   */
  private async submitReviewWithIndividualComments(
    repoPath: string,
    prNumber: number,
    decision: ReviewDecision,
    comments: ReviewComment[],
    body: string | undefined,
    repoId: { owner: string; repo: string }
  ): Promise<GitHubSubmitReviewResult> {
    try {
      // First create the review
      const createReviewResult = await execGh(repoPath, [
        'api',
        `repos/${repoId.owner}/${repoId.repo}/pulls/${prNumber}/reviews`,
        '-X', 'POST',
        '--input', '-',
      ]);

      // For now, use the simpler gh pr review command
      const args = ['pr', 'review', String(prNumber)];

      switch (decision) {
        case 'APPROVE':
          args.push('--approve');
          break;
        case 'REQUEST_CHANGES':
          args.push('--request-changes');
          break;
        case 'COMMENT':
          args.push('--comment');
          break;
      }

      // Build the review body with all comments
      let reviewBody = body || '';

      const activeComments = comments.filter(c => c.status !== 'ignored');
      if (activeComments.length > 0) {
        if (reviewBody) {
          reviewBody += '\n\n---\n\n';
        }
        reviewBody += '### Review Comments\n\n';

        for (const comment of activeComments) {
          reviewBody += `**${comment.filePath}:${comment.lineNumber}**\n`;
          reviewBody += comment.body;
          if (comment.suggestion) {
            reviewBody += `\n\`\`\`suggestion\n${comment.suggestion}\n\`\`\``;
          }
          reviewBody += '\n\n';
        }
      }

      if (reviewBody) {
        args.push('--body', reviewBody);
      }

      const result = await execGh(repoPath, args);

      if (result.exitCode !== 0) {
        return {
          success: false,
          error: result.stderr || 'Failed to submit review',
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error submitting review',
      };
    }
  }

  /**
   * Get file content from a PR branch
   */
  async getFileFromPR(
    repoPath: string,
    prNumber: number,
    filePath: string
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      // Get PR info to find the head branch
      const prResult = await this.getPR(repoPath, prNumber);
      if (!prResult.success || !prResult.pullRequest) {
        return { success: false, error: prResult.error || 'Failed to get PR' };
      }

      // Fetch the branch
      const fetchResult = await execGh(repoPath, [
        'pr', 'diff', String(prNumber),
      ]);

      // Get file content from the PR branch
      const result = await new Promise<GhExecResult>((resolve) => {
        const proc = spawn('git', [
          'show',
          `origin/${prResult.pullRequest!.headBranch}:${filePath}`,
        ], { cwd: repoPath });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        proc.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        proc.on('close', (exitCode: number | null) => {
          resolve({ stdout, stderr, exitCode: exitCode ?? 1 });
        });

        proc.on('error', (error: Error) => {
          resolve({ stdout, stderr: error.message, exitCode: 1 });
        });
      });

      if (result.exitCode !== 0) {
        return {
          success: false,
          error: result.stderr || 'Failed to get file content',
        };
      }

      return {
        success: true,
        content: result.stdout,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error getting file',
      };
    }
  }
}

// Singleton instance
export const githubService = new GitHubService();

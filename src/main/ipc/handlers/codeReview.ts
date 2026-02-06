import { ipcMain, BrowserWindow } from 'electron';
import { spawn, exec } from 'child_process';
import * as path from 'path';
import { githubService } from '../../services/GitHubService';
import { codeReviewService } from '../../services/CodeReviewService';
import { gitWorktreeManager } from '../../services/GitWorktreeManager';
import { reviewFileWatcher } from '../../services/ReviewFileWatcher';
import { generatePRReviewPrompt, generateLocalReviewPrompt } from '../../services/codeReviewPrompt';
import { eventBus, Events } from '../../services/EventBus';
import type { ChildProcess } from 'child_process';
import type {
  StartReviewRequest,
  AddCommentRequest,
  UpdateCommentRequest,
  ReviewDecision,
} from '../../../shared/types/codeReview';

let mainWindow: BrowserWindow | null = null;
const eventUnsubscribers: (() => void)[] = [];

// Track background AI review processes (not in grid)
const aiReviewProcesses: Map<string, { proc: ChildProcess; worktreePath: string }> = new Map();

/**
 * Extract review JSON from claude -p --output-format json output.
 *
 * The output is a JSON envelope like:
 * { "type":"result", "result": "<agent's text response>", ... }
 *
 * The agent's text response should be raw JSON (we asked for it),
 * but might contain markdown fences or extra text.
 */
function extractReviewJson(stdout: string): Record<string, unknown> | null {
  const trimmed = stdout.trim();

  // Step 1: Parse the outer envelope from --output-format json
  let textToSearch = trimmed;
  try {
    const envelope = JSON.parse(trimmed);
    // The 'result' field contains the agent's final text response
    if (typeof envelope.result === 'string') {
      textToSearch = envelope.result;
    }
    // Maybe the envelope itself has comments (unlikely but check)
    if (envelope.comments && Array.isArray(envelope.comments)) {
      return envelope;
    }
  } catch {
    // Not a JSON envelope, search the raw text
  }

  // Step 2: Try parsing the text directly as JSON
  try {
    const parsed = JSON.parse(textToSearch.trim());
    if (parsed.comments && Array.isArray(parsed.comments)) {
      return parsed;
    }
  } catch {
    // Not raw JSON
  }

  // Step 3: Find JSON in markdown code fences
  const jsonBlockMatch = textToSearch.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (jsonBlockMatch) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1]);
      if (parsed.comments && Array.isArray(parsed.comments)) {
        return parsed;
      }
    } catch {
      // Not valid JSON in code block
    }
  }

  // Step 4: Find a JSON object containing "comments" array anywhere in the text
  // Use a greedy approach: find the first { before "comments" and the last }
  const commentsIdx = textToSearch.indexOf('"comments"');
  if (commentsIdx !== -1) {
    const startIdx = textToSearch.lastIndexOf('{', commentsIdx);
    if (startIdx !== -1) {
      // Find matching closing brace
      let depth = 0;
      for (let i = startIdx; i < textToSearch.length; i++) {
        if (textToSearch[i] === '{') depth++;
        if (textToSearch[i] === '}') depth--;
        if (depth === 0) {
          try {
            const parsed = JSON.parse(textToSearch.slice(startIdx, i + 1));
            if (parsed.comments && Array.isArray(parsed.comments)) {
              return parsed;
            }
          } catch {
            // Invalid JSON
          }
          break;
        }
      }
    }
  }

  console.log('[AIReview] Could not extract review JSON from agent output');
  console.log('[AIReview] Text to search (first 500):', textToSearch.slice(0, 500));
  return null;
}

function removeWorktreeDirect(repoPath: string, worktreePath: string): Promise<void> {
  return new Promise((resolve) => {
    exec(`git worktree remove "${worktreePath}" --force`, { cwd: repoPath }, () => resolve());
  });
}

export function registerCodeReviewHandlers(window: BrowserWindow): void {
  mainWindow = window;

  // Initialize the service
  codeReviewService.initialize();

  // GitHub handlers
  ipcMain.handle('github:isAuthenticated', async (_event, { repoPath }: { repoPath: string }) => {
    return githubService.isAuthenticated(repoPath);
  });

  ipcMain.handle('github:listOpenPRs', async (_event, { repoPath }: { repoPath: string }) => {
    return githubService.listOpenPRs(repoPath);
  });

  ipcMain.handle(
    'github:getPR',
    async (_event, { repoPath, prNumber }: { repoPath: string; prNumber: number }) => {
      return githubService.getPR(repoPath, prNumber);
    }
  );

  ipcMain.handle(
    'github:getPRFiles',
    async (_event, { repoPath, prNumber }: { repoPath: string; prNumber: number }) => {
      return githubService.getPRFiles(repoPath, prNumber);
    }
  );

  ipcMain.handle(
    'github:getPRDiff',
    async (_event, { repoPath, prNumber }: { repoPath: string; prNumber: number }) => {
      return githubService.getPRDiff(repoPath, prNumber);
    }
  );

  // Code Review handlers
  ipcMain.handle('codeReview:start', async (_event, request: StartReviewRequest) => {
    return codeReviewService.startReview(request);
  });

  ipcMain.handle('codeReview:get', async (_event, { reviewId }: { reviewId: string }) => {
    return codeReviewService.getReview(reviewId);
  });

  ipcMain.handle('codeReview:list', async (_event, { projectPath }: { projectPath?: string }) => {
    return codeReviewService.listReviews(projectPath);
  });

  ipcMain.handle('codeReview:addComment', async (_event, request: AddCommentRequest) => {
    return codeReviewService.addComment(request);
  });

  ipcMain.handle('codeReview:updateComment', async (_event, request: UpdateCommentRequest) => {
    return codeReviewService.updateComment(request);
  });

  ipcMain.handle(
    'codeReview:deleteComment',
    async (_event, { reviewId, commentId }: { reviewId: string; commentId: string }) => {
      return codeReviewService.deleteComment(reviewId, commentId);
    }
  );

  ipcMain.handle(
    'codeReview:setDecision',
    async (
      _event,
      { reviewId, decision, overallComment }: { reviewId: string; decision: ReviewDecision; overallComment?: string }
    ) => {
      return codeReviewService.setDecision(reviewId, decision, overallComment);
    }
  );

  ipcMain.handle('codeReview:submit', async (_event, { reviewId }: { reviewId: string }) => {
    return codeReviewService.submitReview(reviewId);
  });

  ipcMain.handle('codeReview:discard', async (_event, { reviewId }: { reviewId: string }) => {
    return codeReviewService.discardReview(reviewId);
  });

  ipcMain.handle(
    'codeReview:markFileViewed',
    async (_event, { reviewId, filePath }: { reviewId: string; filePath: string }) => {
      return codeReviewService.markFileViewed(reviewId, filePath);
    }
  );

  ipcMain.handle(
    'codeReview:setFileIndex',
    async (_event, { reviewId, index }: { reviewId: string; index: number }) => {
      return codeReviewService.setCurrentFileIndex(reviewId, index);
    }
  );

  ipcMain.handle(
    'codeReview:startAIReview',
    async (_event, { reviewId, agentId }: { reviewId: string; agentId?: string }) => {
      const reviewResult = codeReviewService.getReview(reviewId);
      if (!reviewResult.success || !reviewResult.review) {
        return { success: false, error: reviewResult.error || 'Review not found' };
      }

      const review = reviewResult.review;

      try {
        // Set status to AI reviewing
        codeReviewService.setReviewStatus(reviewId, 'ai_reviewing');

        // Build the prompt — the agent will run git diff and read files itself
        let prompt: string;
        if (review.source === 'pr' && review.pullRequest) {
          prompt = generatePRReviewPrompt(review.pullRequest);
        } else {
          prompt = generateLocalReviewPrompt();
        }

        // Spawn claude -p with full tool access — agent reads files for accurate line numbers
        console.log(`[AIReview] Spawning claude -p, prompt length: ${prompt.length}`);
        const proc = spawn('claude', ['-p', '--output-format', 'json'], {
          cwd: review.projectPath,
          shell: process.platform === 'win32',
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env },
        });

        // Write prompt to stdin then close it
        proc.stdin?.write(prompt);
        proc.stdin?.end();

        aiReviewProcesses.set(reviewId, { proc, worktreePath: review.projectPath });

        // Collect stdout to capture agent's response
        let stdoutData = '';
        proc.stdout?.on('data', (chunk: Buffer) => {
          stdoutData += chunk.toString();
        });

        let stderrData = '';
        proc.stderr?.on('data', (chunk: Buffer) => {
          stderrData += chunk.toString();
        });

        proc.on('close', async (exitCode) => {
          console.log(`[AIReview] Process exited with code: ${exitCode}`);
          console.log(`[AIReview] stdout length: ${stdoutData.length}`);
          console.log(`[AIReview] stdout preview: ${stdoutData.slice(0, 500)}`);
          if (stderrData) console.log(`[AIReview] stderr: ${stderrData.slice(0, 500)}`);

          aiReviewProcesses.delete(reviewId);

          const currentReview = codeReviewService.getReview(reviewId);
          if (!currentReview.success || currentReview.review?.status !== 'ai_reviewing') {
            return; // Already cancelled
          }

          // Parse JSON from stdout
          if (stdoutData.trim()) {
            const reviewJson = extractReviewJson(stdoutData);
            if (reviewJson) {
              await codeReviewService.importAIReviewFromJson(reviewId, reviewJson);
              eventBus.emit(Events.CODE_REVIEW_AI_COMPLETED, { reviewId, success: true });
              return;
            }
          }

          // Failed to parse
          codeReviewService.setReviewStatus(reviewId, 'ready');
          const errMsg = stderrData.trim()
            ? `Agent error: ${stderrData.trim().slice(0, 200)}`
            : exitCode
              ? `Agent exited with code ${exitCode}`
              : 'Agent produced no review output';
          eventBus.emit(Events.CODE_REVIEW_AI_COMPLETED, {
            reviewId,
            success: false,
            error: errMsg,
          });
        });

        proc.on('error', async (err) => {
          aiReviewProcesses.delete(reviewId);
          codeReviewService.setReviewStatus(reviewId, 'ready');
          eventBus.emit(Events.CODE_REVIEW_AI_COMPLETED, {
            reviewId,
            success: false,
            error: `Failed to spawn agent: ${err.message}`,
          });
        });

        return { success: true };
      } catch (error) {
        codeReviewService.setReviewStatus(reviewId, 'ready');
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to start AI review',
        };
      }
    }
  );

  ipcMain.handle(
    'codeReview:cancelAIReview',
    async (_event, { reviewId }: { reviewId: string }) => {
      const entry = aiReviewProcesses.get(reviewId);
      if (!entry) {
        return { success: false, error: 'No AI review in progress' };
      }

      try {
        const reviewResult = codeReviewService.getReview(reviewId);
        const projectPath = reviewResult.review?.projectPath || '';
        // Kill the process - the 'close' handler will do cleanup
        entry.proc.kill();
        aiReviewProcesses.delete(reviewId);
        codeReviewService.setReviewStatus(reviewId, 'ready');
        await reviewFileWatcher.stopWatching(reviewId);
        await removeWorktreeDirect(projectPath, entry.worktreePath);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to cancel AI review',
        };
      }
    }
  );

  // Forward events to renderer
  const reviewUpdatedSub = eventBus.on(Events.CODE_REVIEW_UPDATED, (data: { review: unknown }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('codeReview:updated', data);
    }
  });
  eventUnsubscribers.push(reviewUpdatedSub.unsubscribe);

  const reviewSubmittedSub = eventBus.on(Events.CODE_REVIEW_SUBMITTED, (data: { review: unknown }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const review = data.review as { id: string };
      mainWindow.webContents.send('codeReview:submitted', { reviewId: review.id });
    }
  });
  eventUnsubscribers.push(reviewSubmittedSub.unsubscribe);

  const aiCompletedSub = eventBus.on(
    Events.CODE_REVIEW_AI_COMPLETED,
    (data: { reviewId: string; success: boolean; error?: string }) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('codeReview:aiCompleted', data);
      }
    }
  );
  eventUnsubscribers.push(aiCompletedSub.unsubscribe);
}

export function unregisterCodeReviewHandlers(): void {
  // Shutdown service
  codeReviewService.shutdown();

  // Unsubscribe from events
  eventUnsubscribers.forEach((unsub) => unsub());
  eventUnsubscribers.length = 0;

  // Remove IPC handlers
  ipcMain.removeHandler('github:isAuthenticated');
  ipcMain.removeHandler('github:listOpenPRs');
  ipcMain.removeHandler('github:getPR');
  ipcMain.removeHandler('github:getPRFiles');
  ipcMain.removeHandler('github:getPRDiff');
  ipcMain.removeHandler('codeReview:start');
  ipcMain.removeHandler('codeReview:get');
  ipcMain.removeHandler('codeReview:list');
  ipcMain.removeHandler('codeReview:addComment');
  ipcMain.removeHandler('codeReview:updateComment');
  ipcMain.removeHandler('codeReview:deleteComment');
  ipcMain.removeHandler('codeReview:setDecision');
  ipcMain.removeHandler('codeReview:submit');
  ipcMain.removeHandler('codeReview:discard');
  ipcMain.removeHandler('codeReview:markFileViewed');
  ipcMain.removeHandler('codeReview:setFileIndex');
  ipcMain.removeHandler('codeReview:startAIReview');
  ipcMain.removeHandler('codeReview:cancelAIReview');

  mainWindow = null;
}

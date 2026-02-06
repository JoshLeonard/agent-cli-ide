import * as fs from 'fs/promises';
import * as path from 'path';
import { watch, FSWatcher } from 'fs';
import { eventBus, Events } from './EventBus';
import { codeReviewService } from './CodeReviewService';
import type { AIReviewOutput } from '../../shared/types/codeReview';

interface WatcherEntry {
  reviewId: string;
  worktreePath: string;
  watcher: FSWatcher | null;
  pollInterval: NodeJS.Timeout | null;
}

export class ReviewFileWatcher {
  private watchers: Map<string, WatcherEntry> = new Map();

  /**
   * Start watching for the review JSON file in a worktree
   */
  async startWatching(reviewId: string, worktreePath: string): Promise<void> {
    // Clean up any existing watcher for this review
    await this.stopWatching(reviewId);

    const filePath = path.join(worktreePath, '.claude', 'review-comments.json');
    const dirPath = path.join(worktreePath, '.claude');

    const entry: WatcherEntry = {
      reviewId,
      worktreePath,
      watcher: null,
      pollInterval: null,
    };

    // Try to use fs.watch first (more efficient)
    try {
      // Ensure directory exists
      await fs.mkdir(dirPath, { recursive: true });

      entry.watcher = watch(dirPath, async (eventType, filename) => {
        if (filename === 'review-comments.json' && eventType === 'change') {
          await this.handleFileChange(reviewId, filePath);
        }
      });

      entry.watcher.on('error', (error) => {
        console.error(`Watcher error for review ${reviewId}:`, error);
        // Fall back to polling
        this.startPolling(entry, filePath);
      });
    } catch (error) {
      // Fall back to polling if watch fails
      this.startPolling(entry, filePath);
    }

    this.watchers.set(reviewId, entry);
  }

  /**
   * Start polling for file changes (fallback)
   */
  private startPolling(entry: WatcherEntry, filePath: string): void {
    if (entry.pollInterval) {
      clearInterval(entry.pollInterval);
    }

    let lastMtime = 0;

    entry.pollInterval = setInterval(async () => {
      try {
        const stat = await fs.stat(filePath);
        const mtime = stat.mtimeMs;

        if (mtime > lastMtime) {
          lastMtime = mtime;
          await this.handleFileChange(entry.reviewId, filePath);
        }
      } catch {
        // File doesn't exist yet, keep polling
      }
    }, 2000); // Check every 2 seconds
  }

  /**
   * Handle file change event
   */
  private async handleFileChange(reviewId: string, filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const review = JSON.parse(content) as AIReviewOutput;

      // Validate the review structure
      if (!review.comments || !Array.isArray(review.comments)) {
        console.warn('Invalid review file format');
        return;
      }

      // Import the comments into the review
      const result = await codeReviewService.importAIReviewComments(reviewId, filePath);

      if (result.success) {
        // Emit completion event
        eventBus.emit(Events.CODE_REVIEW_AI_COMPLETED, {
          reviewId,
          success: true,
        });

        // Stop watching since we've read the file
        await this.stopWatching(reviewId);
      }
    } catch (error) {
      // File might be partially written, wait for complete write
      console.debug('Waiting for complete review file...');
    }
  }

  /**
   * Stop watching for a review
   */
  async stopWatching(reviewId: string): Promise<void> {
    const entry = this.watchers.get(reviewId);
    if (!entry) return;

    if (entry.watcher) {
      entry.watcher.close();
    }

    if (entry.pollInterval) {
      clearInterval(entry.pollInterval);
    }

    this.watchers.delete(reviewId);
  }

  /**
   * Check if a review file exists and is complete
   */
  async checkForExistingReview(worktreePath: string): Promise<AIReviewOutput | null> {
    const filePath = path.join(worktreePath, '.claude', 'review-comments.json');

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const review = JSON.parse(content) as AIReviewOutput;

      // Validate the review structure
      if (review.comments && Array.isArray(review.comments) && review.verdict) {
        return review;
      }
    } catch {
      // File doesn't exist or is invalid
    }

    return null;
  }

  /**
   * Clean up all watchers
   */
  async shutdown(): Promise<void> {
    for (const reviewId of this.watchers.keys()) {
      await this.stopWatching(reviewId);
    }
  }
}

// Singleton instance
export const reviewFileWatcher = new ReviewFileWatcher();

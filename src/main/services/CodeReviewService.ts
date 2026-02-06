import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { githubService } from './GitHubService';
import { gitService } from './GitService';
import { eventBus, Events } from './EventBus';
import type {
  CodeReviewState,
  ReviewComment,
  ReviewDecision,
  ReviewSource,
  ReviewStatus,
  PersistedCodeReview,
  AIReviewOutput,
  AIReviewComment,
  StartReviewRequest,
  StartReviewResult,
  AddCommentRequest,
  UpdateCommentRequest,
  CodeReviewResult,
  GetReviewResult,
  ListReviewsResult,
  CommentStatus,
  GitHubPRFile,
} from '../../shared/types/codeReview';

// Maximum incomplete reviews to keep per project
const MAX_REVIEWS_PER_PROJECT = 5;
// Age in ms after which submitted reviews are cleaned up (24 hours)
const SUBMITTED_REVIEW_MAX_AGE = 24 * 60 * 60 * 1000;
// Age in ms after which stale reviews are cleaned up (7 days)
const STALE_REVIEW_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

interface ReviewsState {
  reviews: PersistedCodeReview[];
  lastSaved: number;
}

export class CodeReviewService {
  private reviews: Map<string, CodeReviewState> = new Map();
  private persistPath: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.persistPath = path.join(userDataPath, 'code-reviews.json');
  }

  /**
   * Initialize the service and restore any saved reviews
   */
  async initialize(): Promise<void> {
    await this.loadPersistedReviews();
    await this.cleanupOldReviews();
  }

  /**
   * Start a new code review
   */
  async startReview(request: StartReviewRequest): Promise<StartReviewResult> {
    try {
      const reviewId = uuidv4();
      const now = Date.now();

      // Create initial review state
      const review: CodeReviewState = {
        id: reviewId,
        projectPath: request.projectPath,
        source: request.source,
        prNumber: request.prNumber,
        files: [],
        comments: [],
        status: 'loading',
        currentFileIndex: 0,
        viewedFiles: [],
        createdAt: now,
        updatedAt: now,
      };

      this.reviews.set(reviewId, review);

      // Fetch PR data or local changes
      if (request.source === 'pr' && request.prNumber) {
        await this.loadPRData(reviewId, request.projectPath, request.prNumber);
      } else if (request.source === 'local') {
        await this.loadLocalChanges(reviewId, request.projectPath, request.baseBranch);
      }

      const updatedReview = this.reviews.get(reviewId);
      if (!updatedReview) {
        return { success: false, error: 'Review not found after loading' };
      }

      // Emit event
      eventBus.emit(Events.CODE_REVIEW_STARTED, { review: updatedReview });

      return {
        success: true,
        reviewId,
        review: updatedReview,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error starting review',
      };
    }
  }

  /**
   * Load PR data from GitHub
   */
  private async loadPRData(reviewId: string, projectPath: string, prNumber: number): Promise<void> {
    const review = this.reviews.get(reviewId);
    if (!review) return;

    try {
      // Get PR details
      const prResult = await githubService.getPR(projectPath, prNumber);
      if (!prResult.success || !prResult.pullRequest) {
        review.status = 'ready';
        review.error = prResult.error || 'Failed to fetch PR';
        return;
      }

      review.pullRequest = prResult.pullRequest;

      // Get PR files
      const filesResult = await githubService.getPRFiles(projectPath, prNumber);
      if (filesResult.success && filesResult.files) {
        review.files = filesResult.files;
      }

      review.status = 'ready';
      review.updatedAt = Date.now();
    } catch (error) {
      review.status = 'ready';
      review.error = error instanceof Error ? error.message : 'Unknown error loading PR';
    }
  }

  /**
   * Load local uncommitted changes
   */
  private async loadLocalChanges(
    reviewId: string,
    projectPath: string,
    baseBranch?: string
  ): Promise<void> {
    const review = this.reviews.get(reviewId);
    if (!review) return;

    try {
      // Get diff from git
      const diffResult = await gitService.getDiff(projectPath, false);
      const stagedDiffResult = await gitService.getDiff(projectPath, true);

      if (!diffResult.success && !stagedDiffResult.success) {
        review.status = 'ready';
        review.error = diffResult.error || 'Failed to get diff';
        return;
      }

      // Combine staged and unstaged diffs into files
      const fileMap = new Map<string, GitHubPRFile>();

      const processDiffs = (diffs: typeof diffResult.diffs) => {
        if (!diffs) return;
        for (const diff of diffs) {
          if (!fileMap.has(diff.filePath)) {
            fileMap.set(diff.filePath, {
              filename: diff.filePath,
              status: 'modified',
              additions: diff.additions,
              deletions: diff.deletions,
              patch: diff.hunks.map(h =>
                `@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@${h.header}\n` +
                h.lines.map(l => {
                  const prefix = l.type === 'add' ? '+' : l.type === 'remove' ? '-' : ' ';
                  return prefix + l.content;
                }).join('\n')
              ).join('\n'),
            });
          } else {
            const existing = fileMap.get(diff.filePath)!;
            existing.additions += diff.additions;
            existing.deletions += diff.deletions;
          }
        }
      };

      processDiffs(diffResult.diffs);
      processDiffs(stagedDiffResult.diffs);

      review.files = Array.from(fileMap.values());
      review.status = 'ready';
      review.updatedAt = Date.now();
    } catch (error) {
      review.status = 'ready';
      review.error = error instanceof Error ? error.message : 'Unknown error loading changes';
    }
  }

  /**
   * Get a review by ID
   */
  getReview(reviewId: string): GetReviewResult {
    const review = this.reviews.get(reviewId);
    if (!review) {
      return { success: false, error: 'Review not found' };
    }
    return { success: true, review };
  }

  /**
   * List all reviews for a project
   */
  listReviews(projectPath?: string): ListReviewsResult {
    const reviews: PersistedCodeReview[] = [];

    for (const review of this.reviews.values()) {
      if (!projectPath || review.projectPath === projectPath) {
        reviews.push(this.toPersistedReview(review));
      }
    }

    return { success: true, reviews };
  }

  /**
   * Add a comment to a review
   */
  addComment(request: AddCommentRequest): CodeReviewResult {
    const review = this.reviews.get(request.reviewId);
    if (!review) {
      return { success: false, error: 'Review not found' };
    }

    const comment: ReviewComment = {
      id: uuidv4(),
      filePath: request.filePath,
      lineNumber: request.lineNumber,
      endLineNumber: request.endLineNumber,
      side: request.side,
      body: request.body,
      author: 'user',
      status: 'pending',
      suggestion: request.suggestion,
      createdAt: Date.now(),
    };

    review.comments.push(comment);
    review.updatedAt = Date.now();

    eventBus.emit(Events.CODE_REVIEW_UPDATED, { review });

    return { success: true };
  }

  /**
   * Update a comment
   */
  updateComment(request: UpdateCommentRequest): CodeReviewResult {
    const review = this.reviews.get(request.reviewId);
    if (!review) {
      return { success: false, error: 'Review not found' };
    }

    const comment = review.comments.find(c => c.id === request.commentId);
    if (!comment) {
      return { success: false, error: 'Comment not found' };
    }

    if (request.body !== undefined) {
      comment.body = request.body;
      comment.status = 'edited';
    }
    if (request.status !== undefined) {
      comment.status = request.status;
    }
    if (request.suggestion !== undefined) {
      comment.suggestion = request.suggestion;
    }

    comment.updatedAt = Date.now();
    review.updatedAt = Date.now();

    eventBus.emit(Events.CODE_REVIEW_UPDATED, { review });

    return { success: true };
  }

  /**
   * Delete a comment
   */
  deleteComment(reviewId: string, commentId: string): CodeReviewResult {
    const review = this.reviews.get(reviewId);
    if (!review) {
      return { success: false, error: 'Review not found' };
    }

    const index = review.comments.findIndex(c => c.id === commentId);
    if (index === -1) {
      return { success: false, error: 'Comment not found' };
    }

    review.comments.splice(index, 1);
    review.updatedAt = Date.now();

    eventBus.emit(Events.CODE_REVIEW_UPDATED, { review });

    return { success: true };
  }

  /**
   * Set the review decision
   */
  setDecision(
    reviewId: string,
    decision: ReviewDecision,
    overallComment?: string
  ): CodeReviewResult {
    const review = this.reviews.get(reviewId);
    if (!review) {
      return { success: false, error: 'Review not found' };
    }

    review.decision = decision;
    if (overallComment !== undefined) {
      review.overallComment = overallComment;
    }
    review.updatedAt = Date.now();

    eventBus.emit(Events.CODE_REVIEW_UPDATED, { review });

    return { success: true };
  }

  /**
   * Submit the review to GitHub
   */
  async submitReview(reviewId: string): Promise<CodeReviewResult> {
    const review = this.reviews.get(reviewId);
    if (!review) {
      return { success: false, error: 'Review not found' };
    }

    if (review.source !== 'pr' || !review.prNumber) {
      return { success: false, error: 'Can only submit PR reviews to GitHub' };
    }

    if (!review.decision) {
      return { success: false, error: 'Review decision is required' };
    }

    review.status = 'submitting';
    review.updatedAt = Date.now();
    eventBus.emit(Events.CODE_REVIEW_UPDATED, { review });

    try {
      const result = await githubService.submitReview(
        review.projectPath,
        review.prNumber,
        review.decision,
        review.comments,
        review.overallComment
      );

      if (!result.success) {
        review.status = 'ready';
        review.error = result.error;
        eventBus.emit(Events.CODE_REVIEW_UPDATED, { review });
        return { success: false, error: result.error };
      }

      review.status = 'submitted';
      review.updatedAt = Date.now();
      eventBus.emit(Events.CODE_REVIEW_SUBMITTED, { review });

      // Persist and schedule cleanup
      await this.persistReviews();

      return { success: true };
    } catch (error) {
      review.status = 'ready';
      review.error = error instanceof Error ? error.message : 'Unknown error submitting review';
      eventBus.emit(Events.CODE_REVIEW_UPDATED, { review });
      return { success: false, error: review.error };
    }
  }

  /**
   * Discard a review
   */
  discardReview(reviewId: string): CodeReviewResult {
    const review = this.reviews.get(reviewId);
    if (!review) {
      return { success: false, error: 'Review not found' };
    }

    this.reviews.delete(reviewId);

    eventBus.emit(Events.CODE_REVIEW_DISCARDED, { reviewId });

    // Persist immediately
    this.persistReviews();

    return { success: true };
  }

  /**
   * Mark a file as viewed
   */
  markFileViewed(reviewId: string, filePath: string): CodeReviewResult {
    const review = this.reviews.get(reviewId);
    if (!review) {
      return { success: false, error: 'Review not found' };
    }

    if (!review.viewedFiles.includes(filePath)) {
      review.viewedFiles.push(filePath);
    }
    review.updatedAt = Date.now();

    return { success: true };
  }

  /**
   * Set current file index
   */
  setCurrentFileIndex(reviewId: string, index: number): CodeReviewResult {
    const review = this.reviews.get(reviewId);
    if (!review) {
      return { success: false, error: 'Review not found' };
    }

    if (index < 0 || index >= review.files.length) {
      return { success: false, error: 'Invalid file index' };
    }

    review.currentFileIndex = index;
    review.updatedAt = Date.now();

    // Mark current file as viewed
    if (review.files[index]) {
      const fname = review.files[index].filename;
      if (!review.viewedFiles.includes(fname)) {
        review.viewedFiles.push(fname);
      }
    }

    return { success: true };
  }

  /**
   * Import AI review comments from JSON file
   */
  async importAIReviewComments(reviewId: string, jsonPath: string): Promise<CodeReviewResult> {
    const review = this.reviews.get(reviewId);
    if (!review) {
      return { success: false, error: 'Review not found' };
    }

    try {
      const content = await fs.readFile(jsonPath, 'utf-8');
      const aiReview: AIReviewOutput = JSON.parse(content);

      // Convert AI comments to review comments
      const newComments: ReviewComment[] = aiReview.comments.map((c: AIReviewComment) => ({
        id: uuidv4(),
        filePath: c.file,
        lineNumber: c.line,
        endLineNumber: c.endLine,
        side: c.side,
        body: c.body,
        author: 'ai' as const,
        status: 'pending' as CommentStatus,
        severity: c.severity,
        suggestion: c.suggestion,
        createdAt: Date.now(),
      }));

      review.comments.push(...newComments);

      if (aiReview.summary) {
        review.overallComment = aiReview.summary;
      }

      if (aiReview.verdict) {
        review.decision = aiReview.verdict;
      }

      review.status = 'ready';
      review.updatedAt = Date.now();

      eventBus.emit(Events.CODE_REVIEW_UPDATED, { review });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to import AI review',
      };
    }
  }

  /**
   * Import AI review comments from a parsed JSON object (from stdout capture)
   */
  async importAIReviewFromJson(reviewId: string, data: Record<string, unknown>): Promise<CodeReviewResult> {
    const review = this.reviews.get(reviewId);
    if (!review) {
      return { success: false, error: 'Review not found' };
    }

    try {
      const aiReview = data as unknown as AIReviewOutput;

      if (!aiReview.comments || !Array.isArray(aiReview.comments)) {
        return { success: false, error: 'Invalid AI review format: missing comments array' };
      }

      const newComments: ReviewComment[] = aiReview.comments.map((c: AIReviewComment) => ({
        id: uuidv4(),
        filePath: c.file,
        lineNumber: c.line,
        endLineNumber: c.endLine,
        side: c.side || 'RIGHT',
        body: c.body,
        author: 'ai' as const,
        status: 'pending' as CommentStatus,
        severity: c.severity,
        suggestion: c.suggestion,
        createdAt: Date.now(),
      }));

      review.comments.push(...newComments);

      if (aiReview.summary) {
        review.overallComment = aiReview.summary;
      }

      if (aiReview.verdict) {
        review.decision = aiReview.verdict;
      }

      review.status = 'ready';
      review.updatedAt = Date.now();

      eventBus.emit(Events.CODE_REVIEW_UPDATED, { review });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to import AI review',
      };
    }
  }

  /**
   * Set review status (for AI review workflow)
   */
  setReviewStatus(reviewId: string, status: ReviewStatus): CodeReviewResult {
    const review = this.reviews.get(reviewId);
    if (!review) {
      return { success: false, error: 'Review not found' };
    }

    review.status = status;
    review.updatedAt = Date.now();

    eventBus.emit(Events.CODE_REVIEW_UPDATED, { review });

    return { success: true };
  }

  /**
   * Set agent session for AI review
   */
  setAgentSession(reviewId: string, sessionId: string, worktreePath: string): CodeReviewResult {
    const review = this.reviews.get(reviewId);
    if (!review) {
      return { success: false, error: 'Review not found' };
    }

    review.agentSessionId = sessionId;
    review.worktreePath = worktreePath;
    review.updatedAt = Date.now();

    return { success: true };
  }

  /**
   * Convert review state to persisted format
   */
  private toPersistedReview(review: CodeReviewState): PersistedCodeReview {
    return {
      id: review.id,
      projectPath: review.projectPath,
      source: review.source,
      prNumber: review.prNumber,
      prTitle: review.pullRequest?.title,
      comments: review.comments,
      decision: review.decision,
      overallComment: review.overallComment,
      status: review.status,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    };
  }

  /**
   * Persist reviews to disk
   */
  private async persistReviews(): Promise<void> {
    try {
      const persistedReviews: PersistedCodeReview[] = [];

      for (const review of this.reviews.values()) {
        // Only persist reviews that are in progress or ready
        if (review.status === 'ai_reviewing' || review.status === 'ready') {
          persistedReviews.push(this.toPersistedReview(review));
        }
        // Keep submitted reviews for 24 hours
        if (review.status === 'submitted') {
          const age = Date.now() - review.updatedAt;
          if (age < SUBMITTED_REVIEW_MAX_AGE) {
            persistedReviews.push(this.toPersistedReview(review));
          }
        }
      }

      const state: ReviewsState = {
        reviews: persistedReviews,
        lastSaved: Date.now(),
      };

      const dir = path.dirname(this.persistPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.persistPath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to persist code reviews:', error);
    }
  }

  /**
   * Load persisted reviews from disk
   */
  private async loadPersistedReviews(): Promise<void> {
    try {
      const content = await fs.readFile(this.persistPath, 'utf-8');
      const state: ReviewsState = JSON.parse(content);

      for (const persisted of state.reviews) {
        // Convert to full review state
        const review: CodeReviewState = {
          id: persisted.id,
          projectPath: persisted.projectPath,
          source: persisted.source,
          prNumber: persisted.prNumber,
          files: [], // Will be re-fetched on demand
          comments: persisted.comments,
          overallComment: persisted.overallComment,
          decision: persisted.decision,
          status: persisted.status === 'ai_reviewing' ? 'ready' : persisted.status,
          currentFileIndex: 0,
          viewedFiles: [],
          createdAt: persisted.createdAt,
          updatedAt: persisted.updatedAt,
        };

        this.reviews.set(review.id, review);
      }
    } catch {
      // No persisted reviews or error reading file
    }
  }

  /**
   * Clean up old reviews
   */
  private async cleanupOldReviews(): Promise<void> {
    const now = Date.now();
    const projectReviewCounts = new Map<string, number>();

    for (const [reviewId, review] of this.reviews.entries()) {
      // Remove submitted reviews older than 24 hours
      if (review.status === 'submitted') {
        const age = now - review.updatedAt;
        if (age > SUBMITTED_REVIEW_MAX_AGE) {
          this.reviews.delete(reviewId);
          continue;
        }
      }

      // Remove stale reviews older than 7 days
      if (review.status !== 'submitted') {
        const age = now - review.updatedAt;
        if (age > STALE_REVIEW_MAX_AGE) {
          this.reviews.delete(reviewId);
          continue;
        }
      }

      // Count reviews per project
      const count = projectReviewCounts.get(review.projectPath) || 0;
      projectReviewCounts.set(review.projectPath, count + 1);
    }

    // Limit reviews per project
    for (const projectPath of projectReviewCounts.keys()) {
      const projectReviews = Array.from(this.reviews.values())
        .filter(r => r.projectPath === projectPath && r.status !== 'submitted')
        .sort((a, b) => b.updatedAt - a.updatedAt);

      // Remove oldest reviews beyond the limit
      for (let i = MAX_REVIEWS_PER_PROJECT; i < projectReviews.length; i++) {
        this.reviews.delete(projectReviews[i].id);
      }
    }

    await this.persistReviews();
  }

  /**
   * Shutdown and persist
   */
  async shutdown(): Promise<void> {
    await this.persistReviews();
  }
}

// Singleton instance
export const codeReviewService = new CodeReviewService();

/**
 * Code Review Types
 * Types for autonomous code review workflow with AI agents
 */

// ============================================================================
// GitHub Types
// ============================================================================

/**
 * PR metadata from GitHub
 */
export interface GitHubPullRequest {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed' | 'merged';
  author: string;
  headBranch: string;
  baseBranch: string;
  url: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Changed file with patch from GitHub PR
 */
export interface GitHubPRFile {
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed';
  additions: number;
  deletions: number;
  patch?: string;
  previousFilename?: string; // For renames
}

// ============================================================================
// Review Comment Types
// ============================================================================

/**
 * Comment severity for AI-generated comments
 */
export type CommentSeverity = 'error' | 'warning' | 'suggestion' | 'info';

/**
 * Comment status in the review workflow
 */
export type CommentStatus = 'pending' | 'edited' | 'ignored';

/**
 * Side of the diff (old vs new version)
 */
export type DiffSide = 'LEFT' | 'RIGHT';

/**
 * Review comment (from AI or user)
 */
export interface ReviewComment {
  id: string;
  filePath: string;
  lineNumber: number;
  endLineNumber?: number; // For multi-line comments
  side: DiffSide;
  body: string;
  author: 'ai' | 'user';
  status: CommentStatus;
  severity?: CommentSeverity;
  suggestion?: string; // Code suggestion (GitHub format)
  createdAt: number;
  updatedAt?: number;
}

// ============================================================================
// Review State Types
// ============================================================================

/**
 * Review decision (verdict)
 */
export type ReviewDecision = 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';

/**
 * Review source (PR or local changes)
 */
export type ReviewSource = 'pr' | 'local';

/**
 * Review status in the workflow
 */
export type ReviewStatus =
  | 'loading'       // Fetching PR data
  | 'ai_reviewing'  // AI agent is reviewing
  | 'ready'         // Ready for user review
  | 'submitting'    // Submitting to GitHub
  | 'submitted';    // Successfully submitted

/**
 * Overall review state
 */
export interface CodeReviewState {
  id: string;
  projectPath: string;
  source: ReviewSource;
  prNumber?: number; // Only for PR reviews
  pullRequest?: GitHubPullRequest;
  files: GitHubPRFile[];
  comments: ReviewComment[];
  overallComment?: string;
  decision?: ReviewDecision;
  status: ReviewStatus;
  currentFileIndex: number;
  viewedFiles: string[]; // Files user has viewed
  worktreePath?: string; // Path to review worktree (for AI review)
  agentSessionId?: string; // Session ID of reviewing agent
  error?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Persisted review state (subset for storage)
 */
export interface PersistedCodeReview {
  id: string;
  projectPath: string;
  source: ReviewSource;
  prNumber?: number;
  prTitle?: string;
  comments: ReviewComment[];
  decision?: ReviewDecision;
  overallComment?: string;
  status: ReviewStatus;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// AI Review JSON Format
// ============================================================================

/**
 * AI-generated review comment in JSON file format
 */
export interface AIReviewComment {
  file: string;
  line: number;
  endLine?: number;
  side: DiffSide;
  body: string;
  severity: CommentSeverity;
  suggestion?: string;
}

/**
 * AI review output JSON format (.claude/review-comments.json)
 */
export interface AIReviewOutput {
  prNumber?: number;
  reviewedAt: string;
  summary: string;
  comments: AIReviewComment[];
  verdict: ReviewDecision;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * GitHub authentication status
 */
export interface GitHubAuthResult {
  success: boolean;
  authenticated: boolean;
  username?: string;
  error?: string;
}

/**
 * List of open PRs
 */
export interface GitHubPRListResult {
  success: boolean;
  pullRequests?: GitHubPullRequest[];
  error?: string;
}

/**
 * Single PR result
 */
export interface GitHubPRResult {
  success: boolean;
  pullRequest?: GitHubPullRequest;
  error?: string;
}

/**
 * PR files result
 */
export interface GitHubPRFilesResult {
  success: boolean;
  files?: GitHubPRFile[];
  error?: string;
}

/**
 * PR diff result
 */
export interface GitHubPRDiffResult {
  success: boolean;
  diff?: string;
  error?: string;
}

/**
 * Submit review result
 */
export interface GitHubSubmitReviewResult {
  success: boolean;
  reviewId?: number;
  url?: string;
  error?: string;
}

/**
 * Start review request
 */
export interface StartReviewRequest {
  projectPath: string;
  source: ReviewSource;
  prNumber?: number; // Required if source is 'pr'
  baseBranch?: string; // For local reviews, defaults to main/master
}

/**
 * Start review result
 */
export interface StartReviewResult {
  success: boolean;
  reviewId?: string;
  review?: CodeReviewState;
  error?: string;
}

/**
 * Add comment request
 */
export interface AddCommentRequest {
  reviewId: string;
  filePath: string;
  lineNumber: number;
  endLineNumber?: number;
  side: DiffSide;
  body: string;
  suggestion?: string;
}

/**
 * Update comment request
 */
export interface UpdateCommentRequest {
  reviewId: string;
  commentId: string;
  body?: string;
  status?: CommentStatus;
  suggestion?: string;
}

/**
 * Code review operation result
 */
export interface CodeReviewResult {
  success: boolean;
  error?: string;
}

/**
 * Get review result
 */
export interface GetReviewResult {
  success: boolean;
  review?: CodeReviewState;
  error?: string;
}

/**
 * List reviews result
 */
export interface ListReviewsResult {
  success: boolean;
  reviews?: PersistedCodeReview[];
  error?: string;
}

// ============================================================================
// AI Review Integration Types
// ============================================================================

/**
 * AI review session state
 */
export interface AIReviewSession {
  reviewId: string;
  worktreePath: string;
  sessionId: string;
  startedAt: number;
  status: 'starting' | 'running' | 'completed' | 'failed';
  error?: string;
}

/**
 * Request to start AI review
 */
export interface StartAIReviewRequest {
  reviewId: string;
  agentId?: string; // Agent to use, defaults to claude-code
}

/**
 * Result of AI review completion
 */
export interface AIReviewCompleteResult {
  success: boolean;
  comments?: ReviewComment[];
  summary?: string;
  verdict?: ReviewDecision;
  error?: string;
}

import { create } from 'zustand';
import type {
  CodeReviewState,
  ReviewComment,
  ReviewDecision,
  ReviewSource,
  GitHubPullRequest,
  GitHubPRFile,
  CommentStatus,
  DiffSide,
} from '../../shared/types/codeReview';

interface CodeReviewStore {
  // Dialog state
  isDialogOpen: boolean;
  isSelectorOpen: boolean;

  // Review state
  review: CodeReviewState | null;
  isLoading: boolean;
  error: string | null;

  // PR list (for selector)
  pullRequests: GitHubPullRequest[];
  isPRListLoading: boolean;
  prListError: string | null;

  // File content for diff viewer (full file contents)
  currentFileDiff: string | null; // kept for backward compat
  currentFileOriginal: string | null;
  currentFileModified: string | null;
  isDiffLoading: boolean;

  // Selected comment
  selectedCommentId: string | null;

  // AI review progress
  aiReviewStartedAt: number | null;

  // View preferences
  sideBySideView: boolean;

  // Dialog actions
  openSelector: () => void;
  closeSelector: () => void;
  openDialog: () => void;
  closeDialog: () => void;

  // PR list actions
  loadPRList: (projectPath: string) => Promise<void>;
  clearPRList: () => void;

  // Review lifecycle actions
  startReview: (projectPath: string, source: ReviewSource, prNumber?: number) => Promise<void>;
  loadReview: (reviewId: string) => Promise<void>;
  discardReview: () => Promise<void>;
  submitReview: () => Promise<boolean>;

  // File navigation
  selectFile: (index: number) => void;
  nextFile: () => void;
  previousFile: () => void;

  // Comment actions
  addComment: (
    filePath: string,
    lineNumber: number,
    side: DiffSide,
    body: string,
    suggestion?: string
  ) => Promise<void>;
  editComment: (commentId: string, body: string, suggestion?: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  ignoreComment: (commentId: string) => Promise<void>;
  selectComment: (commentId: string | null) => void;

  // Decision actions
  setDecision: (decision: ReviewDecision, overallComment?: string) => Promise<void>;

  // AI review
  startAIReview: (agentId?: string) => Promise<void>;
  cancelAIReview: () => Promise<void>;

  // View actions
  toggleViewMode: () => void;
  markCurrentFileViewed: () => void;
  loadFileDiff: (filename: string) => Promise<void>;

  // Utility
  getCommentsForFile: (filePath: string) => ReviewComment[];
  getCommentCountForFile: (filePath: string) => number;
  getActiveCommentCount: () => number;

  // IPC event handlers
  handleReviewUpdated: (review: CodeReviewState) => void;
  handleReviewSubmitted: (reviewId: string) => void;
  handleAICompleted: (data: { reviewId: string; success: boolean; error?: string }) => void;

  // Cleanup
  cleanup: () => void;
}

export const useCodeReviewStore = create<CodeReviewStore>((set, get) => ({
  // Initial state
  isDialogOpen: false,
  isSelectorOpen: false,
  review: null,
  isLoading: false,
  error: null,
  pullRequests: [],
  isPRListLoading: false,
  prListError: null,
  currentFileDiff: null, currentFileOriginal: null, currentFileModified: null,
  isDiffLoading: false,
  selectedCommentId: null,
  aiReviewStartedAt: null,
  sideBySideView: true,

  // Dialog actions
  openSelector: () => {
    set({ isSelectorOpen: true, prListError: null });
  },

  closeSelector: () => {
    set({ isSelectorOpen: false });
  },

  openDialog: () => {
    set({ isDialogOpen: true, error: null });
  },

  closeDialog: () => {
    set({
      isDialogOpen: false,
      selectedCommentId: null,
      currentFileDiff: null, currentFileOriginal: null, currentFileModified: null,
    });
  },

  // PR list actions
  loadPRList: async (projectPath: string) => {
    set({ isPRListLoading: true, prListError: null });

    try {
      // First check if authenticated
      const authResult = await window.terminalIDE.github.isAuthenticated(projectPath);
      if (!authResult.authenticated) {
        set({
          isPRListLoading: false,
          prListError: 'Not authenticated with GitHub CLI. Run `gh auth login` to authenticate.',
        });
        return;
      }

      // Load PRs
      const result = await window.terminalIDE.github.listOpenPRs(projectPath);
      if (result.success && result.pullRequests) {
        set({ pullRequests: result.pullRequests, isPRListLoading: false });
      } else {
        set({
          isPRListLoading: false,
          prListError: result.error || 'Failed to load pull requests',
        });
      }
    } catch (error) {
      set({
        isPRListLoading: false,
        prListError: error instanceof Error ? error.message : 'Failed to load pull requests',
      });
    }
  },

  clearPRList: () => {
    set({ pullRequests: [], prListError: null });
  },

  // Review lifecycle actions
  startReview: async (projectPath: string, source: ReviewSource, prNumber?: number) => {
    set({ isLoading: true, error: null });

    try {
      const result = await window.terminalIDE.codeReview.start({
        projectPath,
        source,
        prNumber,
      });

      if (result.success && result.review) {
        set({
          review: result.review,
          isLoading: false,
          isSelectorOpen: false,
          isDialogOpen: true,
        });

        // Load diff for first file
        if (result.review.files.length > 0) {
          get().loadFileDiff(result.review.files[0].filename);
        }
      } else {
        set({
          isLoading: false,
          error: result.error || 'Failed to start review',
        });
      }
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to start review',
      });
    }
  },

  loadReview: async (reviewId: string) => {
    set({ isLoading: true, error: null });

    try {
      const result = await window.terminalIDE.codeReview.get(reviewId);

      if (result.success && result.review) {
        set({
          review: result.review,
          isLoading: false,
          isDialogOpen: true,
        });

        // Load diff for first file
        if (result.review.files.length > 0) {
          get().loadFileDiff(result.review.files[0].filename);
        }
      } else {
        set({
          isLoading: false,
          error: result.error || 'Failed to load review',
        });
      }
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load review',
      });
    }
  },

  discardReview: async () => {
    const review = get().review;
    if (!review) return;

    try {
      await window.terminalIDE.codeReview.discard(review.id);
      set({
        review: null,
        isDialogOpen: false,
        currentFileDiff: null, currentFileOriginal: null, currentFileModified: null,
        selectedCommentId: null,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to discard review',
      });
    }
  },

  submitReview: async (): Promise<boolean> => {
    const review = get().review;
    if (!review) return false;

    set({ isLoading: true, error: null });

    try {
      const result = await window.terminalIDE.codeReview.submit(review.id);

      if (result.success) {
        set({ isLoading: false });
        return true;
      } else {
        set({
          isLoading: false,
          error: result.error || 'Failed to submit review',
        });
        return false;
      }
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to submit review',
      });
      return false;
    }
  },

  // File navigation
  selectFile: (index: number) => {
    const review = get().review;
    if (!review || index < 0 || index >= review.files.length) return;

    // Update via IPC
    window.terminalIDE.codeReview.setFileIndex(review.id, index);

    // Optimistically update local state
    set((state) => ({
      review: state.review
        ? { ...state.review, currentFileIndex: index }
        : null,
      selectedCommentId: null,
    }));

    // Load diff for new file
    get().loadFileDiff(review.files[index].filename);
  },

  nextFile: () => {
    const review = get().review;
    if (!review) return;

    const nextIndex = review.currentFileIndex + 1;
    if (nextIndex < review.files.length) {
      get().selectFile(nextIndex);
    }
  },

  previousFile: () => {
    const review = get().review;
    if (!review) return;

    const prevIndex = review.currentFileIndex - 1;
    if (prevIndex >= 0) {
      get().selectFile(prevIndex);
    }
  },

  // Internal: Load full file contents for the diff viewer
  loadFileDiff: async (filename: string) => {
    const review = get().review;
    if (!review) return;

    set({ isDiffLoading: true });

    try {
      if (review.source === 'pr' && review.pullRequest) {
        // PR: original = file at base branch, modified = file at head branch
        const [origResult, modResult] = await Promise.all([
          window.terminalIDE.git.showFile(review.projectPath, review.pullRequest.baseBranch, filename),
          window.terminalIDE.git.showFile(review.projectPath, review.pullRequest.headBranch, filename),
        ]);

        set({
          currentFileOriginal: origResult.content || '',
          currentFileModified: modResult.content || '',
          currentFileDiff: 'full-file', // signal that we have full file content
          isDiffLoading: false,
        });
      } else {
        // Local changes: original = HEAD version, modified = working copy (empty ref = read file)
        const [origResult, modResult] = await Promise.all([
          window.terminalIDE.git.showFile(review.projectPath, 'HEAD', filename),
          window.terminalIDE.git.showFile(review.projectPath, '', filename),
        ]);

        set({
          currentFileOriginal: origResult.content || '',
          currentFileModified: modResult.content || '',
          currentFileDiff: 'full-file',
          isDiffLoading: false,
        });
      }
    } catch (error) {
      set({
        currentFileDiff: null, currentFileOriginal: null, currentFileModified: null,
        isDiffLoading: false,
      });
    }
  },

  // Comment actions
  addComment: async (
    filePath: string,
    lineNumber: number,
    side: DiffSide,
    body: string,
    suggestion?: string
  ) => {
    const review = get().review;
    if (!review) return;

    try {
      await window.terminalIDE.codeReview.addComment({
        reviewId: review.id,
        filePath,
        lineNumber,
        side,
        body,
        suggestion,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to add comment',
      });
    }
  },

  editComment: async (commentId: string, body: string, suggestion?: string) => {
    const review = get().review;
    if (!review) return;

    try {
      await window.terminalIDE.codeReview.updateComment({
        reviewId: review.id,
        commentId,
        body,
        suggestion,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to edit comment',
      });
    }
  },

  deleteComment: async (commentId: string) => {
    const review = get().review;
    if (!review) return;

    try {
      await window.terminalIDE.codeReview.deleteComment(review.id, commentId);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete comment',
      });
    }
  },

  ignoreComment: async (commentId: string) => {
    const review = get().review;
    if (!review) return;

    try {
      await window.terminalIDE.codeReview.updateComment({
        reviewId: review.id,
        commentId,
        status: 'ignored',
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to ignore comment',
      });
    }
  },

  selectComment: (commentId: string | null) => {
    set({ selectedCommentId: commentId });
  },

  // Decision actions
  setDecision: async (decision: ReviewDecision, overallComment?: string) => {
    const review = get().review;
    if (!review) return;

    try {
      await window.terminalIDE.codeReview.setDecision(review.id, decision, overallComment);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to set decision',
      });
    }
  },

  // AI review
  startAIReview: async (agentId?: string) => {
    const review = get().review;
    if (!review) return;

    set({ isLoading: true, error: null });

    try {
      const result = await window.terminalIDE.codeReview.startAIReview(review.id, agentId);

      if (result.success) {
        set({
          isLoading: false,
          aiReviewStartedAt: Date.now(),
          review: { ...review, status: 'ai_reviewing' },
        });
      } else {
        set({
          isLoading: false,
          error: result.error || 'Failed to start AI review',
        });
      }
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to start AI review',
      });
    }
  },

  cancelAIReview: async () => {
    const review = get().review;
    if (!review) return;

    try {
      const result = await window.terminalIDE.codeReview.cancelAIReview(review.id);
      if (result.success) {
        set({
          aiReviewStartedAt: null,
          review: { ...review, status: 'ready' },
        });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to cancel AI review',
      });
    }
  },

  // View actions
  toggleViewMode: () => {
    set((state) => ({ sideBySideView: !state.sideBySideView }));
  },

  markCurrentFileViewed: () => {
    const review = get().review;
    if (!review || review.files.length === 0) return;

    const currentFile = review.files[review.currentFileIndex];
    if (currentFile) {
      window.terminalIDE.codeReview.markFileViewed(review.id, currentFile.filename);
    }
  },

  // Utility
  getCommentsForFile: (filePath: string): ReviewComment[] => {
    const review = get().review;
    if (!review) return [];
    return review.comments.filter((c) => c.filePath === filePath);
  },

  getCommentCountForFile: (filePath: string): number => {
    const review = get().review;
    if (!review) return 0;
    return review.comments.filter(
      (c) => c.filePath === filePath && c.status !== 'ignored'
    ).length;
  },

  getActiveCommentCount: (): number => {
    const review = get().review;
    if (!review) return 0;
    return review.comments.filter((c) => c.status !== 'ignored').length;
  },

  // IPC event handlers
  handleReviewUpdated: (updatedReview: CodeReviewState) => {
    const currentReview = get().review;
    if (currentReview && currentReview.id === updatedReview.id) {
      set({ review: updatedReview });
    }
  },

  handleReviewSubmitted: (reviewId: string) => {
    const currentReview = get().review;
    if (currentReview && currentReview.id === reviewId) {
      set({
        review: { ...currentReview, status: 'submitted' },
      });
    }
  },

  handleAICompleted: (data: { reviewId: string; success: boolean; error?: string }) => {
    const currentReview = get().review;
    if (currentReview && currentReview.id === data.reviewId) {
      if (data.success) {
        set({ aiReviewStartedAt: null });
        // Reload the review to get AI comments
        get().loadReview(data.reviewId);
      } else {
        set({
          aiReviewStartedAt: null,
          error: data.error || 'AI review failed',
          review: { ...currentReview, status: 'ready' },
        });
      }
    }
  },

  // Cleanup
  cleanup: () => {
    set({
      isDialogOpen: false,
      isSelectorOpen: false,
      review: null,
      isLoading: false,
      error: null,
      pullRequests: [],
      currentFileDiff: null, currentFileOriginal: null, currentFileModified: null,
      selectedCommentId: null,
    });
  },
}));

/**
 * Extract the diff for a specific file from a unified diff string
 */
function extractFileDiff(fullDiff: string, filename: string): string | null {
  const lines = fullDiff.split('\n');
  let inTargetFile = false;
  const fileDiffLines: string[] = [];

  for (const line of lines) {
    // Check for file header
    if (line.startsWith('diff --git ')) {
      if (inTargetFile) {
        // We've reached the next file, stop
        break;
      }
      // Check if this is the file we want
      if (line.includes(`b/${filename}`)) {
        inTargetFile = true;
      }
    }

    if (inTargetFile) {
      fileDiffLines.push(line);
    }
  }

  return fileDiffLines.length > 0 ? fileDiffLines.join('\n') : null;
}

// Helper to initialize event listeners
export function initCodeReviewListeners(): () => void {
  const store = useCodeReviewStore.getState();

  const unsubUpdated = window.terminalIDE.codeReview.onUpdated((data) => {
    store.handleReviewUpdated(data.review);
  });

  const unsubSubmitted = window.terminalIDE.codeReview.onSubmitted((data) => {
    store.handleReviewSubmitted(data.reviewId);
  });

  const unsubAICompleted = window.terminalIDE.codeReview.onAICompleted((data) => {
    store.handleAICompleted(data);
  });

  return () => {
    unsubUpdated();
    unsubSubmitted();
    unsubAICompleted();
  };
}

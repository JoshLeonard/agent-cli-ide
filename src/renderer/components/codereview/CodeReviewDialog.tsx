import React, { useEffect, useRef, useCallback, useState } from 'react';
import * as monaco from 'monaco-editor';
import { useCodeReviewStore } from '../../stores/codeReviewStore';
import { useProjectStore } from '../../stores/projectStore';
import { CodeReviewFileList } from './CodeReviewFileList';
import { CodeReviewCommentPanel } from './CodeReviewCommentPanel';
import type { ReviewDecision } from '../../../shared/types/codeReview';
import './CodeReviewDialog.css';

export const CodeReviewDialog: React.FC = () => {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const diffEditorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [commentPanelWidth, setCommentPanelWidth] = useState(280);
  const isResizingLeft = useRef(false);
  const isResizingRight = useRef(false);
  const [showDecisionDropdown, setShowDecisionDropdown] = useState(false);

  const {
    isDialogOpen,
    review,
    isLoading,
    error,
    currentFileOriginal,
    currentFileModified,
    isDiffLoading,
    sideBySideView,
    aiReviewStartedAt,
    closeDialog,
    discardReview,
    submitReview,
    startAIReview,
    cancelAIReview,
    selectFile,
    nextFile,
    previousFile,
    toggleViewMode,
    setDecision,
    getCommentsForFile,
    selectComment,
    selectedCommentId,
  } = useCodeReviewStore();

  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const isAIReviewing = review?.status === 'ai_reviewing';

  // Elapsed time timer for AI review
  useEffect(() => {
    if (!isAIReviewing || !aiReviewStartedAt) {
      setElapsedSeconds(0);
      return;
    }

    setElapsedSeconds(Math.floor((Date.now() - aiReviewStartedAt) / 1000));

    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - aiReviewStartedAt) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isAIReviewing, aiReviewStartedAt]);

  const projectPath = useProjectStore((state) => state.currentProject?.path);

  const currentFile = review?.files[review.currentFileIndex];
  const currentFileComments = currentFile ? getCommentsForFile(currentFile.filename) : [];

  // Initialize Monaco diff editor
  useEffect(() => {
    if (!editorContainerRef.current || !isDialogOpen) return;

    const editor = monaco.editor.createDiffEditor(editorContainerRef.current, {
      theme: 'vs-dark',
      automaticLayout: true,
      renderSideBySide: sideBySideView,
      readOnly: true,
      originalEditable: false,
      enableSplitViewResizing: true,
      scrollBeyondLastLine: false,
      minimap: { enabled: false },
      fontSize: 13,
      lineNumbers: 'on',
      renderWhitespace: 'selection',
      scrollbar: {
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
      },
      glyphMargin: true, // For comment indicators
    });

    diffEditorRef.current = editor;

    return () => {
      editor.dispose();
      diffEditorRef.current = null;
    };
  }, [isDialogOpen]);

  // Update side-by-side view mode
  useEffect(() => {
    if (diffEditorRef.current) {
      diffEditorRef.current.updateOptions({ renderSideBySide: sideBySideView });
    }
  }, [sideBySideView]);

  // Update editor content when file contents change
  useEffect(() => {
    if (!diffEditorRef.current || !currentFile) return;
    if (currentFileOriginal === null && currentFileModified === null) return;

    const language = getLanguageFromFilename(currentFile.filename);

    const originalModel = monaco.editor.createModel(currentFileOriginal || '', language);
    const modifiedModel = monaco.editor.createModel(currentFileModified || '', language);

    diffEditorRef.current.setModel({
      original: originalModel,
      modified: modifiedModel,
    });

    // Add comment decorations
    addCommentDecorations(diffEditorRef.current, currentFileComments);

    return () => {
      originalModel.dispose();
      modifiedModel.dispose();
    };
  }, [currentFileOriginal, currentFileModified, currentFile, currentFileComments]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isDialogOpen) return;

      // Escape - close modal
      if (e.key === 'Escape') {
        closeDialog();
        e.preventDefault();
        return;
      }

      // j/k for file navigation
      if (e.key === 'j' && !e.ctrlKey && !e.metaKey) {
        const activeElement = document.activeElement;
        const isInEditor = editorContainerRef.current?.contains(activeElement);
        if (!isInEditor) {
          nextFile();
          e.preventDefault();
        }
      }
      if (e.key === 'k' && !e.ctrlKey && !e.metaKey) {
        const activeElement = document.activeElement;
        const isInEditor = editorContainerRef.current?.contains(activeElement);
        if (!isInEditor) {
          previousFile();
          e.preventDefault();
        }
      }

      // Ctrl+Enter to submit
      if (e.ctrlKey && e.key === 'Enter') {
        if (review?.decision) {
          submitReview();
          e.preventDefault();
        }
      }
    },
    [isDialogOpen, closeDialog, nextFile, previousFile, submitReview, review?.decision]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Sidebar resize handlers
  const handleLeftResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingLeft.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleRightResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRight.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleResizeMove = (e: MouseEvent) => {
      const modalElement = document.querySelector('.code-review-dialog');
      if (!modalElement) return;
      const modalRect = modalElement.getBoundingClientRect();

      if (isResizingLeft.current) {
        const newWidth = e.clientX - modalRect.left;
        setSidebarWidth(Math.max(150, Math.min(400, newWidth)));
      }

      if (isResizingRight.current) {
        const newWidth = modalRect.right - e.clientX;
        setCommentPanelWidth(Math.max(200, Math.min(500, newWidth)));
      }
    };

    const handleResizeEnd = () => {
      if (isResizingLeft.current || isResizingRight.current) {
        isResizingLeft.current = false;
        isResizingRight.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, []);

  const handleDiscard = async () => {
    if (confirm('Discard this review? All comments will be lost.')) {
      await discardReview();
    }
  };

  const handleSubmit = async () => {
    if (!review?.decision) {
      setShowDecisionDropdown(true);
      return;
    }
    const success = await submitReview();
    if (success) {
      closeDialog();
    }
  };

  const handleDecisionSelect = async (decision: ReviewDecision) => {
    await setDecision(decision);
    setShowDecisionDropdown(false);
  };

  if (!isDialogOpen || !review) {
    return null;
  }

  const prTitle = review.pullRequest?.title || 'Local Changes';
  const prNumber = review.prNumber ? `#${review.prNumber}` : '';
  const activeCommentCount = review.comments.filter(c => c.status !== 'ignored').length;

  return (
    <div className="code-review-dialog-overlay" onClick={closeDialog}>
      <div className="code-review-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="code-review-dialog-header">
          <div className="code-review-dialog-title">
            <span className="code-review-dialog-pr-number">{prNumber}</span>
            <span className="code-review-dialog-pr-title">{prTitle}</span>
            {review.status === 'ai_reviewing' && (
              <span className="code-review-dialog-status-badge">AI Reviewing...</span>
            )}
          </div>
          <div className="code-review-dialog-header-actions">
            <button
              className="code-review-dialog-view-toggle"
              onClick={toggleViewMode}
              title={sideBySideView ? 'Switch to unified view' : 'Switch to side-by-side view'}
            >
              {sideBySideView ? 'Unified' : 'Split'}
            </button>
            <button className="code-review-dialog-close" onClick={closeDialog} title="Close (Esc)">
              &times;
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="code-review-dialog-content">
          {/* File sidebar */}
          <div className="code-review-dialog-sidebar" style={{ width: sidebarWidth }}>
            <CodeReviewFileList
              files={review.files}
              currentIndex={review.currentFileIndex}
              viewedFiles={review.viewedFiles}
              onSelect={selectFile}
              getCommentCount={(filePath) =>
                review.comments.filter(c => c.filePath === filePath && c.status !== 'ignored').length
              }
            />
          </div>
          <div
            className="code-review-dialog-resize-handle"
            onMouseDown={handleLeftResizeStart}
          />

          {/* Diff editor */}
          <div className="code-review-dialog-editor">
            {isAIReviewing && (
              <div className="code-review-ai-progress-overlay">
                <div className="code-review-ai-progress-card">
                  <div className="code-review-ai-progress-spinner">
                    <div className="code-review-ai-spinner-ring" />
                  </div>
                  <div className="code-review-ai-progress-title">AI is reviewing the code</div>
                  <div className="code-review-ai-progress-subtitle">
                    The agent is analyzing {review.files.length} file{review.files.length !== 1 ? 's' : ''} for issues, suggestions, and improvements
                  </div>
                  <div className="code-review-ai-progress-steps">
                    <div className={`code-review-ai-step ${elapsedSeconds >= 0 ? 'code-review-ai-step--active' : ''}`}>
                      <span className="code-review-ai-step-icon">&#10003;</span>
                      <span>Creating isolated worktree</span>
                    </div>
                    <div className={`code-review-ai-step ${elapsedSeconds >= 3 ? 'code-review-ai-step--active' : ''}`}>
                      <span className="code-review-ai-step-icon">{elapsedSeconds >= 3 ? '&#10003;' : '...'}</span>
                      <span>Starting AI agent</span>
                    </div>
                    <div className={`code-review-ai-step ${elapsedSeconds >= 5 ? 'code-review-ai-step--active' : ''}`}>
                      <span className="code-review-ai-step-icon">{elapsedSeconds >= 5 ? '\u25CF' : '...'}</span>
                      <span>Reviewing code changes</span>
                    </div>
                    <div className="code-review-ai-step">
                      <span className="code-review-ai-step-icon">...</span>
                      <span>Writing review comments</span>
                    </div>
                  </div>
                  <div className="code-review-ai-progress-timer">
                    {formatElapsedTime(elapsedSeconds)}
                  </div>
                  <button
                    className="code-review-ai-progress-cancel"
                    onClick={cancelAIReview}
                  >
                    Cancel Review
                  </button>
                </div>
              </div>
            )}
            {!isAIReviewing && isDiffLoading && (
              <div className="code-review-dialog-loading">Loading diff...</div>
            )}
            {!isAIReviewing && error && (
              <div className="code-review-dialog-error">{error}</div>
            )}
            {!isAIReviewing && !isDiffLoading && !error && currentFile && (
              <div className="code-review-dialog-editor-header">
                <span className="code-review-dialog-filename">{currentFile.filename}</span>
                <span className="code-review-dialog-file-stats">
                  <span className="code-review-dialog-additions">+{currentFile.additions}</span>
                  <span className="code-review-dialog-deletions">-{currentFile.deletions}</span>
                </span>
              </div>
            )}
            <div
              ref={editorContainerRef}
              className="code-review-dialog-editor-container"
              style={{ display: isAIReviewing ? 'none' : undefined }}
            />
          </div>

          {/* Resize handle for comments */}
          <div
            className="code-review-dialog-resize-handle"
            onMouseDown={handleRightResizeStart}
          />

          {/* Comment panel */}
          <div className="code-review-dialog-comments" style={{ width: commentPanelWidth }}>
            <CodeReviewCommentPanel
              comments={currentFileComments}
              selectedCommentId={selectedCommentId}
              onSelectComment={selectComment}
              reviewId={review.id}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="code-review-dialog-footer">
          <div className="code-review-dialog-nav">
            <button
              className="code-review-dialog-btn code-review-dialog-btn--secondary"
              onClick={previousFile}
              disabled={review.currentFileIndex === 0}
              title="Previous file (k)"
            >
              &lt; Prev
            </button>
            <span className="code-review-dialog-counter">
              {review.currentFileIndex + 1} / {review.files.length}
            </span>
            <button
              className="code-review-dialog-btn code-review-dialog-btn--secondary"
              onClick={nextFile}
              disabled={review.currentFileIndex >= review.files.length - 1}
              title="Next file (j)"
            >
              Next &gt;
            </button>
          </div>

          <div className="code-review-dialog-footer-info">
            {activeCommentCount > 0 && (
              <span className="code-review-dialog-comment-count">
                {activeCommentCount} comment{activeCommentCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="code-review-dialog-actions">
            {isAIReviewing ? (
              <button
                className="code-review-dialog-btn code-review-dialog-btn--danger"
                onClick={cancelAIReview}
              >
                Cancel AI Review
              </button>
            ) : (
              <>
                <button
                  className="code-review-dialog-btn code-review-dialog-btn--ai"
                  onClick={() => startAIReview()}
                  disabled={isLoading}
                  title="Have an AI agent review the code and generate comments"
                >
                  AI Review
                </button>
                <button
                  className="code-review-dialog-btn code-review-dialog-btn--danger"
                  onClick={handleDiscard}
                  disabled={isLoading}
                >
                  Discard
                </button>
              </>
            )}

            {review.source === 'pr' && (
              <div className="code-review-dialog-submit-group">
                <button
                  className={`code-review-dialog-btn code-review-dialog-btn--primary ${
                    review.decision ? 'code-review-dialog-btn--has-decision' : ''
                  }`}
                  onClick={handleSubmit}
                  disabled={isLoading || review.status === 'ai_reviewing'}
                  title="Submit review (Ctrl+Enter)"
                >
                  {review.decision ? `Submit: ${formatDecision(review.decision)}` : 'Submit Review'}
                </button>
                <button
                  className="code-review-dialog-btn code-review-dialog-btn--dropdown"
                  onClick={() => setShowDecisionDropdown(!showDecisionDropdown)}
                  disabled={isLoading}
                >
                  &#9662;
                </button>
                {showDecisionDropdown && (
                  <div className="code-review-dialog-decision-dropdown">
                    <button
                      className="code-review-dialog-decision-option"
                      onClick={() => handleDecisionSelect('APPROVE')}
                    >
                      <span className="code-review-decision-icon code-review-decision-icon--approve">&#10003;</span>
                      Approve
                    </button>
                    <button
                      className="code-review-dialog-decision-option"
                      onClick={() => handleDecisionSelect('REQUEST_CHANGES')}
                    >
                      <span className="code-review-decision-icon code-review-decision-icon--changes">&#10007;</span>
                      Request Changes
                    </button>
                    <button
                      className="code-review-dialog-decision-option"
                      onClick={() => handleDecisionSelect('COMMENT')}
                    >
                      <span className="code-review-decision-icon code-review-decision-icon--comment">&#128172;</span>
                      Comment Only
                    </button>
                  </div>
                )}
              </div>
            )}

            {review.source === 'local' && (
              <button
                className="code-review-dialog-btn code-review-dialog-btn--secondary"
                onClick={closeDialog}
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Get Monaco language ID from filename
 */
function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    css: 'css',
    scss: 'scss',
    html: 'html',
    md: 'markdown',
    py: 'python',
    rs: 'rust',
    go: 'go',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    yaml: 'yaml',
    yml: 'yaml',
    sh: 'shell',
    bash: 'shell',
  };
  return languageMap[ext] || 'plaintext';
}

/**
 * Add comment decorations to the diff editor
 */
function addCommentDecorations(
  editor: monaco.editor.IStandaloneDiffEditor,
  comments: { lineNumber: number; side: 'LEFT' | 'RIGHT' }[]
): void {
  const modifiedEditor = editor.getModifiedEditor();

  const decorations = comments
    .filter(c => c.side === 'RIGHT')
    .map(c => ({
      range: new monaco.Range(c.lineNumber, 1, c.lineNumber, 1),
      options: {
        isWholeLine: true,
        glyphMarginClassName: 'code-review-comment-glyph',
        glyphMarginHoverMessage: { value: 'Click to view comment' },
      },
    }));

  modifiedEditor.createDecorationsCollection(decorations);
}

/**
 * Format elapsed seconds as "Xm Ys"
 */
function formatElapsedTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

/**
 * Format decision for display
 */
function formatDecision(decision: ReviewDecision): string {
  switch (decision) {
    case 'APPROVE':
      return 'Approve';
    case 'REQUEST_CHANGES':
      return 'Request Changes';
    case 'COMMENT':
      return 'Comment';
    default:
      return decision;
  }
}

export default CodeReviewDialog;

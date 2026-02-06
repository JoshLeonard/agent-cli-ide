import React, { useState } from 'react';
import { useCodeReviewStore } from '../../stores/codeReviewStore';
import type { ReviewComment, CommentSeverity } from '../../../shared/types/codeReview';
import { MarkdownRenderer } from '../ui/MarkdownRenderer';

interface CodeReviewCommentPanelProps {
  comments: ReviewComment[];
  selectedCommentId: string | null;
  onSelectComment: (commentId: string | null) => void;
  reviewId: string;
}

export const CodeReviewCommentPanel: React.FC<CodeReviewCommentPanelProps> = ({
  comments,
  selectedCommentId,
  onSelectComment,
  reviewId,
}) => {
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState('');
  const { editComment, deleteComment, ignoreComment } = useCodeReviewStore();

  const activeComments = comments.filter((c) => c.status !== 'ignored');
  const ignoredComments = comments.filter((c) => c.status === 'ignored');

  const handleEditStart = (comment: ReviewComment) => {
    setEditingCommentId(comment.id);
    setEditingBody(comment.body);
    onSelectComment(comment.id);
  };

  const handleEditSave = async () => {
    if (editingCommentId) {
      await editComment(editingCommentId, editingBody);
      setEditingCommentId(null);
      setEditingBody('');
    }
  };

  const handleEditCancel = () => {
    setEditingCommentId(null);
    setEditingBody('');
  };

  const handleDelete = async (commentId: string) => {
    if (confirm('Delete this comment?')) {
      await deleteComment(commentId);
      if (selectedCommentId === commentId) {
        onSelectComment(null);
      }
    }
  };

  const handleIgnore = async (commentId: string) => {
    await ignoreComment(commentId);
  };

  const handleRestore = async (commentId: string) => {
    // Update status back to pending
    await editComment(commentId, comments.find(c => c.id === commentId)?.body || '');
  };

  return (
    <div className="code-review-comment-panel">
      <div className="code-review-comment-panel-header">
        <span className="code-review-comment-panel-title">Comments</span>
        <span className="code-review-comment-panel-count">
          {activeComments.length} active
        </span>
      </div>

      <div className="code-review-comment-panel-content">
        {activeComments.length === 0 && ignoredComments.length === 0 ? (
          <div className="code-review-comment-panel-empty">
            No comments on this file
          </div>
        ) : (
          <>
            {activeComments.map((comment) => (
              <CommentCard
                key={comment.id}
                comment={comment}
                isSelected={selectedCommentId === comment.id}
                isEditing={editingCommentId === comment.id}
                editingBody={editingBody}
                onSelect={() => onSelectComment(comment.id)}
                onEditStart={() => handleEditStart(comment)}
                onEditBodyChange={setEditingBody}
                onEditSave={handleEditSave}
                onEditCancel={handleEditCancel}
                onDelete={() => handleDelete(comment.id)}
                onIgnore={() => handleIgnore(comment.id)}
              />
            ))}

            {ignoredComments.length > 0 && (
              <div className="code-review-comment-panel-ignored">
                <div className="code-review-comment-panel-ignored-header">
                  Ignored ({ignoredComments.length})
                </div>
                {ignoredComments.map((comment) => (
                  <div
                    key={comment.id}
                    className="code-review-comment-card code-review-comment-card--ignored"
                  >
                    <div className="code-review-comment-location">
                      Line {comment.lineNumber}
                    </div>
                    <div className="code-review-comment-body-preview">
                      {comment.body.slice(0, 100)}
                      {comment.body.length > 100 ? '...' : ''}
                    </div>
                    <button
                      className="code-review-comment-restore"
                      onClick={() => handleRestore(comment.id)}
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

interface CommentCardProps {
  comment: ReviewComment;
  isSelected: boolean;
  isEditing: boolean;
  editingBody: string;
  onSelect: () => void;
  onEditStart: () => void;
  onEditBodyChange: (body: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onDelete: () => void;
  onIgnore: () => void;
}

const CommentCard: React.FC<CommentCardProps> = ({
  comment,
  isSelected,
  isEditing,
  editingBody,
  onSelect,
  onEditStart,
  onEditBodyChange,
  onEditSave,
  onEditCancel,
  onDelete,
  onIgnore,
}) => {
  return (
    <div
      className={`code-review-comment-card ${isSelected ? 'code-review-comment-card--selected' : ''} ${
        comment.status === 'edited' ? 'code-review-comment-card--edited' : ''
      }`}
      onClick={onSelect}
    >
      <div className="code-review-comment-header">
        <div className="code-review-comment-meta">
          <span className="code-review-comment-location">
            Line {comment.lineNumber}
          </span>
          <span className={`code-review-comment-author code-review-comment-author--${comment.author}`}>
            {comment.author === 'ai' ? 'AI' : 'You'}
          </span>
          {comment.severity && (
            <span className={`code-review-comment-severity code-review-comment-severity--${comment.severity}`}>
              {getSeverityIcon(comment.severity)}
            </span>
          )}
          {comment.status === 'edited' && (
            <span className="code-review-comment-edited-badge">Edited</span>
          )}
        </div>
        <div className="code-review-comment-actions">
          {!isEditing && (
            <>
              <button
                className="code-review-comment-action"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditStart();
                }}
                title="Edit"
              >
                &#9998;
              </button>
              {comment.author === 'ai' && (
                <button
                  className="code-review-comment-action"
                  onClick={(e) => {
                    e.stopPropagation();
                    onIgnore();
                  }}
                  title="Ignore"
                >
                  &#128065;
                </button>
              )}
              <button
                className="code-review-comment-action code-review-comment-action--danger"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                title="Delete"
              >
                &#128465;
              </button>
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="code-review-comment-edit">
          <textarea
            className="code-review-comment-edit-textarea"
            value={editingBody}
            onChange={(e) => onEditBodyChange(e.target.value)}
            autoFocus
          />
          <div className="code-review-comment-edit-actions">
            <button
              className="code-review-comment-edit-btn code-review-comment-edit-btn--save"
              onClick={(e) => {
                e.stopPropagation();
                onEditSave();
              }}
            >
              Save
            </button>
            <button
              className="code-review-comment-edit-btn code-review-comment-edit-btn--cancel"
              onClick={(e) => {
                e.stopPropagation();
                onEditCancel();
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="code-review-comment-body">
            <MarkdownRenderer content={comment.body} />
          </div>
          {comment.suggestion && (
            <div className="code-review-comment-suggestion">
              <div className="code-review-comment-suggestion-header">
                Suggested change
              </div>
              <pre className="code-review-comment-suggestion-code">
                {comment.suggestion}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
};

function getSeverityIcon(severity: CommentSeverity): string {
  switch (severity) {
    case 'error':
      return '&#9888;'; // Warning triangle
    case 'warning':
      return '&#9888;';
    case 'suggestion':
      return '&#128161;'; // Light bulb
    case 'info':
      return '&#8505;'; // Info
    default:
      return '';
  }
}

export default CodeReviewCommentPanel;

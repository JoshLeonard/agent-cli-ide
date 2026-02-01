import React, { useState } from 'react';
import { useGitStore } from '../../../stores/gitStore';
import type { GitStash } from '../../../../shared/types/git';

interface StashesTabProps {
  repoPath: string;
}

export const StashesTab: React.FC<StashesTabProps> = ({ repoPath }) => {
  const {
    stashes,
    isStashesLoading,
    isLoading,
    createStash,
    applyStash,
    dropStash,
  } = useGitStore();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [stashMessage, setStashMessage] = useState('');
  const [includeUntracked, setIncludeUntracked] = useState(false);

  if (isStashesLoading && stashes.length === 0) {
    return <div className="git-panel-loading">Loading stashes...</div>;
  }

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `Yesterday`;
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const handleCreateStash = async () => {
    const success = await createStash(repoPath, stashMessage || undefined, includeUntracked);
    if (success) {
      setStashMessage('');
      setIncludeUntracked(false);
      setShowCreateDialog(false);
    }
  };

  const handleApplyStash = (index: number) => {
    applyStash(repoPath, index, false);
  };

  const handlePopStash = (index: number) => {
    if (confirm('Apply and drop this stash?')) {
      applyStash(repoPath, index, true);
    }
  };

  const handleDropStash = (index: number) => {
    if (confirm('Drop this stash? This cannot be undone.')) {
      dropStash(repoPath, index);
    }
  };

  const renderStash = (stash: GitStash) => {
    return (
      <div key={stash.index} className="git-stash-item">
        <div className="git-stash-item-header">
          <span className="git-stash-item-index">stash@{`{${stash.index}}`}</span>
          <span className="git-stash-item-date">{formatDate(stash.date)}</span>
        </div>
        <div className="git-stash-item-message" title={stash.message}>
          {stash.message}
        </div>
        <div className="git-stash-item-actions">
          <button
            className="git-panel-btn git-panel-btn--secondary"
            onClick={() => handleApplyStash(stash.index)}
            disabled={isLoading}
            title="Apply stash"
          >
            Apply
          </button>
          <button
            className="git-panel-btn git-panel-btn--secondary"
            onClick={() => handlePopStash(stash.index)}
            disabled={isLoading}
            title="Apply and drop stash"
          >
            Pop
          </button>
          <button
            className="git-panel-btn git-panel-btn--danger"
            onClick={() => handleDropStash(stash.index)}
            disabled={isLoading}
            title="Drop stash"
          >
            Drop
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="git-stashes-tab">
      {/* Action bar */}
      <div className="git-panel-action-bar">
        <button
          className="git-panel-btn git-panel-btn--primary"
          onClick={() => setShowCreateDialog(true)}
          disabled={isLoading}
        >
          + Stash Changes
        </button>
      </div>

      {/* Create stash dialog */}
      {showCreateDialog && (
        <div className="git-panel-section">
          <div className="git-create-stash-form">
            <input
              type="text"
              className="git-input"
              placeholder="Stash message (optional)"
              value={stashMessage}
              onChange={(e) => setStashMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateStash();
                if (e.key === 'Escape') setShowCreateDialog(false);
              }}
              autoFocus
            />
            <label className="git-checkbox-label">
              <input
                type="checkbox"
                checked={includeUntracked}
                onChange={(e) => setIncludeUntracked(e.target.checked)}
              />
              Include untracked files
            </label>
            <div className="git-create-stash-actions">
              <button
                className="git-panel-btn git-panel-btn--primary"
                onClick={handleCreateStash}
                disabled={isLoading}
              >
                Stash
              </button>
              <button
                className="git-panel-btn git-panel-btn--secondary"
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stash list */}
      {stashes.length > 0 && (
        <div className="git-stash-list">
          {stashes.map(renderStash)}
        </div>
      )}

      {/* Empty state */}
      {stashes.length === 0 && !isStashesLoading && (
        <div className="git-panel-empty">
          <span className="git-panel-empty-icon">&#128230;</span>
          <span>No stashes</span>
          <span style={{ fontSize: '11px', marginTop: '8px', color: '#666' }}>
            Stash your changes to save them for later
          </span>
        </div>
      )}
    </div>
  );
};

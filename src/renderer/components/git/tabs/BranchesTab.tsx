import React, { useState } from 'react';
import { useGitStore } from '../../../stores/gitStore';
import type { GitBranch } from '../../../../shared/types/git';

interface BranchesTabProps {
  repoPath: string;
}

export const BranchesTab: React.FC<BranchesTabProps> = ({ repoPath }) => {
  const {
    branches,
    currentBranch,
    isBranchesLoading,
    isLoading,
    createBranch,
    deleteBranch,
    checkout,
    fetch,
  } = useGitStore();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');

  if (isBranchesLoading && branches.length === 0) {
    return <div className="git-panel-loading">Loading branches...</div>;
  }

  // Separate local and remote branches
  const localBranches = branches.filter((b) => !b.name.startsWith('remotes/'));
  const remoteBranches = branches.filter((b) => b.name.startsWith('remotes/'));

  const handleCheckout = async (branchName: string) => {
    // For remote branches, extract the branch name without remote prefix
    let targetBranch = branchName;
    if (branchName.startsWith('remotes/')) {
      // Extract branch name after remote (e.g., "remotes/origin/main" -> "main")
      const parts = branchName.split('/');
      targetBranch = parts.slice(2).join('/');
    }
    await checkout(repoPath, targetBranch);
  };

  const handleDeleteBranch = async (branch: GitBranch) => {
    if (branch.current) {
      alert('Cannot delete the current branch');
      return;
    }

    const confirmMsg = `Delete branch "${branch.name}"?`;
    if (confirm(confirmMsg)) {
      const success = await deleteBranch(repoPath, branch.name);
      if (!success) {
        // Try force delete if normal delete fails
        if (confirm(`Branch "${branch.name}" is not fully merged. Force delete?`)) {
          await deleteBranch(repoPath, branch.name, true);
        }
      }
    }
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;

    const success = await createBranch(repoPath, newBranchName.trim(), true);
    if (success) {
      setNewBranchName('');
      setShowCreateDialog(false);
    }
  };

  const handleFetch = () => {
    fetch(repoPath);
  };

  const renderBranch = (branch: GitBranch) => {
    const isRemote = branch.name.startsWith('remotes/');
    const displayName = isRemote
      ? branch.name.replace('remotes/', '')
      : branch.name;

    return (
      <div
        key={branch.name}
        className={`git-branch-item ${branch.current ? 'git-branch-item--current' : ''}`}
      >
        <span className="git-branch-item-icon">
          {branch.current ? '●' : '○'}
        </span>
        <span className="git-branch-item-name" title={branch.name}>
          {displayName}
        </span>
        {branch.ahead > 0 && (
          <span className="git-branch-item-ahead" title={`${branch.ahead} commits ahead`}>
            ↑{branch.ahead}
          </span>
        )}
        {branch.behind > 0 && (
          <span className="git-branch-item-behind" title={`${branch.behind} commits behind`}>
            ↓{branch.behind}
          </span>
        )}
        <div className="git-branch-item-actions">
          {!branch.current && (
            <button
              className="git-file-item-action"
              onClick={() => handleCheckout(branch.name)}
              disabled={isLoading}
              title="Checkout"
            >
              ↵
            </button>
          )}
          {!branch.current && !isRemote && (
            <button
              className="git-file-item-action"
              onClick={() => handleDeleteBranch(branch)}
              disabled={isLoading}
              title="Delete"
            >
              &times;
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="git-branches-tab">
      {/* Action bar */}
      <div className="git-panel-action-bar">
        <button
          className="git-panel-btn git-panel-btn--secondary"
          onClick={() => setShowCreateDialog(true)}
          disabled={isLoading}
        >
          + New Branch
        </button>
        <button
          className="git-panel-btn git-panel-btn--secondary"
          onClick={handleFetch}
          disabled={isLoading}
        >
          ↓ Fetch
        </button>
      </div>

      {/* Create branch dialog */}
      {showCreateDialog && (
        <div className="git-panel-section">
          <div className="git-create-branch-form">
            <input
              type="text"
              className="git-input"
              placeholder="New branch name"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateBranch();
                if (e.key === 'Escape') setShowCreateDialog(false);
              }}
              autoFocus
            />
            <div className="git-create-branch-actions">
              <button
                className="git-panel-btn git-panel-btn--primary"
                onClick={handleCreateBranch}
                disabled={!newBranchName.trim() || isLoading}
              >
                Create
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

      {/* Local branches */}
      <div className="git-panel-section">
        <div className="git-panel-section-header">
          <span className="git-panel-section-title">
            Local ({localBranches.length})
          </span>
        </div>
        <div className="git-branch-list">
          {localBranches.map(renderBranch)}
        </div>
      </div>

      {/* Remote branches */}
      {remoteBranches.length > 0 && (
        <div className="git-panel-section">
          <div className="git-panel-section-header">
            <span className="git-panel-section-title">
              Remote ({remoteBranches.length})
            </span>
          </div>
          <div className="git-branch-list">
            {remoteBranches.map(renderBranch)}
          </div>
        </div>
      )}

      {/* Empty state */}
      {branches.length === 0 && (
        <div className="git-panel-empty">
          <span className="git-panel-empty-icon">&#9737;</span>
          <span>No branches found</span>
        </div>
      )}
    </div>
  );
};

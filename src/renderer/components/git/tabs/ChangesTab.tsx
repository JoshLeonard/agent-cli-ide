import React from 'react';
import { useGitStore } from '../../../stores/gitStore';
import type { GitStatusFile } from '../../../../shared/types/git';

interface ChangesTabProps {
  repoPath: string;
}

export const ChangesTab: React.FC<ChangesTabProps> = ({ repoPath }) => {
  const {
    status,
    isStatusLoading,
    commitMessage,
    isCommitting,
    isPushing,
    isPulling,
    setCommitMessage,
    stageFiles,
    unstageFiles,
    stageAll,
    unstageAll,
    discardChanges,
    commit,
    push,
    pull,
  } = useGitStore();

  if (isStatusLoading && !status) {
    return <div className="git-panel-loading">Loading...</div>;
  }

  if (!status) {
    return (
      <div className="git-panel-empty">
        <span className="git-panel-empty-icon">&#9737;</span>
        <span>No git repository</span>
      </div>
    );
  }

  const stagedFiles = status.files.filter((f) => f.isStaged);
  const unstagedFiles = status.files.filter((f) => !f.isStaged && !f.isUntracked);
  const untrackedFiles = status.files.filter((f) => f.isUntracked);

  const getStatusIcon = (file: GitStatusFile): string => {
    if (file.hasConflict) return 'U';
    if (file.isUntracked) return '?';
    if (file.isStaged) {
      return file.indexStatus;
    }
    return file.workTreeStatus;
  };

  const getStatusClass = (file: GitStatusFile): string => {
    if (file.hasConflict) return 'git-file-item-status--conflict';
    if (file.isUntracked) return 'git-file-item-status--untracked';
    const statusChar = file.isStaged ? file.indexStatus : file.workTreeStatus;
    switch (statusChar) {
      case 'A':
        return 'git-file-item-status--added';
      case 'M':
        return 'git-file-item-status--modified';
      case 'D':
        return 'git-file-item-status--deleted';
      case 'R':
        return 'git-file-item-status--renamed';
      default:
        return 'git-file-item-status--modified';
    }
  };

  const handleStageFile = (path: string) => {
    stageFiles(repoPath, [path]);
  };

  const handleUnstageFile = (path: string) => {
    unstageFiles(repoPath, [path]);
  };

  const handleDiscardFile = (path: string) => {
    if (confirm(`Discard changes to ${path}? This cannot be undone.`)) {
      discardChanges(repoPath, [path]);
    }
  };

  const handleCommit = () => {
    commit(repoPath);
  };

  const handlePush = () => {
    push(repoPath, !status.upstream);
  };

  const handlePull = () => {
    pull(repoPath);
  };

  const canCommit = stagedFiles.length > 0 && commitMessage.trim().length > 0;

  const renderFileItem = (file: GitStatusFile, isStaged: boolean) => {
    const fileName = file.path.split('/').pop() || file.path;
    const filePath = file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : '';

    return (
      <div key={file.path} className="git-file-item">
        <span className={`git-file-item-status ${getStatusClass(file)}`}>
          {getStatusIcon(file)}
        </span>
        <span className="git-file-item-name" title={file.path}>
          {fileName}
        </span>
        {filePath && (
          <span className="git-file-item-path" title={filePath}>
            {filePath}
          </span>
        )}
        <div className="git-file-item-actions">
          {isStaged ? (
            <button
              className="git-file-item-action"
              onClick={() => handleUnstageFile(file.path)}
              title="Unstage"
            >
              -
            </button>
          ) : (
            <>
              <button
                className="git-file-item-action"
                onClick={() => handleStageFile(file.path)}
                title="Stage"
              >
                +
              </button>
              {!file.isUntracked && (
                <button
                  className="git-file-item-action"
                  onClick={() => handleDiscardFile(file.path)}
                  title="Discard Changes"
                >
                  &times;
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="git-changes-tab">
      {/* Commit input */}
      <div className="git-commit-input">
        <textarea
          className="git-commit-textarea"
          placeholder="Commit message (press Ctrl+Enter to commit)"
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.ctrlKey && e.key === 'Enter' && canCommit) {
              handleCommit();
            }
          }}
        />
        <div className="git-commit-actions">
          <button
            className="git-panel-btn git-panel-btn--primary git-commit-btn"
            onClick={handleCommit}
            disabled={!canCommit || isCommitting}
          >
            {isCommitting ? 'Committing...' : 'Commit'}
          </button>
        </div>
      </div>

      {/* Push/Pull actions */}
      <div className="git-panel-action-bar">
        <button
          className="git-panel-btn git-panel-btn--secondary"
          onClick={handlePull}
          disabled={isPulling}
          title="Pull changes from remote"
        >
          {isPulling ? 'Pulling...' : '↓ Pull'}
        </button>
        <button
          className="git-panel-btn git-panel-btn--secondary"
          onClick={handlePush}
          disabled={isPushing}
          title={status.upstream ? 'Push to remote' : 'Push and set upstream'}
        >
          {isPushing ? 'Pushing...' : status.upstream ? '↑ Push' : '↑ Publish'}
        </button>
      </div>

      {/* Staged Changes */}
      {stagedFiles.length > 0 && (
        <div className="git-panel-section">
          <div className="git-panel-section-header">
            <span className="git-panel-section-title">
              Staged Changes ({stagedFiles.length})
            </span>
            <div className="git-panel-section-actions">
              <button
                className="git-panel-btn git-panel-btn--icon"
                onClick={() => unstageAll(repoPath)}
                title="Unstage All"
              >
                -
              </button>
            </div>
          </div>
          <div className="git-file-list">
            {stagedFiles.map((file) => renderFileItem(file, true))}
          </div>
        </div>
      )}

      {/* Unstaged Changes */}
      {unstagedFiles.length > 0 && (
        <div className="git-panel-section">
          <div className="git-panel-section-header">
            <span className="git-panel-section-title">
              Changes ({unstagedFiles.length})
            </span>
            <div className="git-panel-section-actions">
              <button
                className="git-panel-btn git-panel-btn--icon"
                onClick={() => stageAll(repoPath)}
                title="Stage All"
              >
                +
              </button>
            </div>
          </div>
          <div className="git-file-list">
            {unstagedFiles.map((file) => renderFileItem(file, false))}
          </div>
        </div>
      )}

      {/* Untracked Files */}
      {untrackedFiles.length > 0 && (
        <div className="git-panel-section">
          <div className="git-panel-section-header">
            <span className="git-panel-section-title">
              Untracked ({untrackedFiles.length})
            </span>
            <div className="git-panel-section-actions">
              <button
                className="git-panel-btn git-panel-btn--icon"
                onClick={() => stageFiles(repoPath, untrackedFiles.map((f) => f.path))}
                title="Stage All Untracked"
              >
                +
              </button>
            </div>
          </div>
          <div className="git-file-list">
            {untrackedFiles.map((file) => renderFileItem(file, false))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {status.isClean && (
        <div className="git-panel-empty">
          <span className="git-panel-empty-icon">&#10003;</span>
          <span>Working tree clean</span>
        </div>
      )}
    </div>
  );
};

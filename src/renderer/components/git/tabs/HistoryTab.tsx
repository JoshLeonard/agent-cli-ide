import React from 'react';
import { useGitStore } from '../../../stores/gitStore';
import type { GitLogEntry } from '../../../../shared/types/git';

interface HistoryTabProps {
  repoPath: string;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({ repoPath }) => {
  const {
    commits,
    isCommitsLoading,
    loadMoreCommits,
    checkout,
  } = useGitStore();

  if (isCommitsLoading && commits.length === 0) {
    return <div className="git-panel-loading">Loading history...</div>;
  }

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  const handleCheckout = (sha: string) => {
    if (confirm(`Checkout commit ${sha.substring(0, 7)}? This will detach HEAD.`)) {
      checkout(repoPath, sha);
    }
  };

  const handleLoadMore = () => {
    loadMoreCommits(repoPath);
  };

  const renderCommit = (commit: GitLogEntry) => {
    const hasRefs = commit.refs && commit.refs.length > 0;

    return (
      <div key={commit.sha} className="git-commit-item">
        <div className="git-commit-item-header">
          <span className="git-commit-item-sha" title={commit.sha}>
            {commit.shortSha}
          </span>
          {hasRefs && (
            <div className="git-commit-item-refs">
              {commit.refs.map((ref) => (
                <span
                  key={ref}
                  className={`git-commit-item-ref ${ref.startsWith('tag:') ? 'git-commit-item-ref--tag' : ''}`}
                >
                  {ref.replace('HEAD -> ', '').replace('tag: ', '')}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="git-commit-item-message" title={commit.message}>
          {commit.message}
        </div>
        <div className="git-commit-item-meta">
          <span className="git-commit-item-author">{commit.author}</span>
          <span className="git-commit-item-date">{formatDate(commit.date)}</span>
        </div>
        <div className="git-commit-item-actions">
          <button
            className="git-file-item-action"
            onClick={() => handleCheckout(commit.sha)}
            title="Checkout this commit"
          >
            ↵
          </button>
          <button
            className="git-file-item-action"
            onClick={() => navigator.clipboard.writeText(commit.sha)}
            title="Copy SHA"
          >
            &#128203;
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="git-history-tab">
      <div className="git-commit-list">
        {commits.map(renderCommit)}
      </div>

      {commits.length > 0 && (
        <div className="git-panel-section">
          <button
            className="git-panel-btn git-panel-btn--secondary"
            onClick={handleLoadMore}
            disabled={isCommitsLoading}
            style={{ width: '100%' }}
          >
            {isCommitsLoading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}

      {commits.length === 0 && !isCommitsLoading && (
        <div className="git-panel-empty">
          <span className="git-panel-empty-icon">&#128218;</span>
          <span>No commits found</span>
        </div>
      )}
    </div>
  );
};

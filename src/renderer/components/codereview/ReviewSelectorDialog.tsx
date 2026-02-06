import React, { useEffect, useState } from 'react';
import { useCodeReviewStore } from '../../stores/codeReviewStore';
import { useProjectStore } from '../../stores/projectStore';
import type { GitHubPullRequest } from '../../../shared/types/codeReview';
import './ReviewSelectorDialog.css';

export const ReviewSelectorDialog: React.FC = () => {
  const {
    isSelectorOpen,
    closeSelector,
    pullRequests,
    isPRListLoading,
    prListError,
    loadPRList,
    startReview,
    isLoading,
  } = useCodeReviewStore();

  const projectPath = useProjectStore((state) => state.currentProject?.path);
  const [selectedTab, setSelectedTab] = useState<'pr' | 'local'>('pr');

  useEffect(() => {
    if (isSelectorOpen && projectPath) {
      loadPRList(projectPath);
    }
  }, [isSelectorOpen, projectPath, loadPRList]);

  const handleSelectPR = async (pr: GitHubPullRequest) => {
    if (projectPath) {
      await startReview(projectPath, 'pr', pr.number);
    }
  };

  const handleReviewLocal = async () => {
    if (projectPath) {
      await startReview(projectPath, 'local');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeSelector();
    }
  };

  if (!isSelectorOpen) {
    return null;
  }

  return (
    <div className="review-selector-overlay" onClick={closeSelector} onKeyDown={handleKeyDown}>
      <div className="review-selector-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="review-selector-header">
          <h2 className="review-selector-title">Start Code Review</h2>
          <button className="review-selector-close" onClick={closeSelector} title="Close">
            &times;
          </button>
        </div>

        <div className="review-selector-tabs">
          <button
            className={`review-selector-tab ${selectedTab === 'pr' ? 'review-selector-tab--active' : ''}`}
            onClick={() => setSelectedTab('pr')}
          >
            Pull Requests
          </button>
          <button
            className={`review-selector-tab ${selectedTab === 'local' ? 'review-selector-tab--active' : ''}`}
            onClick={() => setSelectedTab('local')}
          >
            Local Changes
          </button>
        </div>

        <div className="review-selector-content">
          {selectedTab === 'pr' && (
            <div className="review-selector-pr-list">
              {isPRListLoading && (
                <div className="review-selector-loading">Loading pull requests...</div>
              )}
              {prListError && (
                <div className="review-selector-error">
                  <span className="review-selector-error-icon">&#9888;</span>
                  <span>{prListError}</span>
                </div>
              )}
              {!isPRListLoading && !prListError && pullRequests.length === 0 && (
                <div className="review-selector-empty">No open pull requests found</div>
              )}
              {!isPRListLoading && !prListError && pullRequests.map((pr) => (
                <button
                  key={pr.number}
                  className="review-selector-pr-item"
                  onClick={() => handleSelectPR(pr)}
                  disabled={isLoading}
                >
                  <div className="review-selector-pr-header">
                    <span className="review-selector-pr-number">#{pr.number}</span>
                    <span className="review-selector-pr-title">{pr.title}</span>
                  </div>
                  <div className="review-selector-pr-meta">
                    <span className="review-selector-pr-author">by {pr.author}</span>
                    <span className="review-selector-pr-branch">
                      {pr.headBranch} &rarr; {pr.baseBranch}
                    </span>
                    <span className="review-selector-pr-stats">
                      <span className="review-selector-pr-additions">+{pr.additions}</span>
                      <span className="review-selector-pr-deletions">-{pr.deletions}</span>
                      <span className="review-selector-pr-files">
                        {pr.changedFiles} file{pr.changedFiles !== 1 ? 's' : ''}
                      </span>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedTab === 'local' && (
            <div className="review-selector-local">
              <div className="review-selector-local-info">
                <p>Review your uncommitted local changes.</p>
                <p className="review-selector-local-note">
                  This will analyze your staged and unstaged changes and allow AI to provide feedback.
                </p>
              </div>
              <button
                className="review-selector-local-btn"
                onClick={handleReviewLocal}
                disabled={isLoading || !projectPath}
              >
                {isLoading ? 'Starting...' : 'Review Local Changes'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReviewSelectorDialog;

import React, { useEffect, useCallback } from 'react';
import { useGitStore } from '../../stores/gitStore';
import { useProjectStore } from '../../stores/projectStore';
import { ChangesTab } from './tabs/ChangesTab';
import { BranchesTab } from './tabs/BranchesTab';
import { HistoryTab } from './tabs/HistoryTab';
import { StashesTab } from './tabs/StashesTab';
import './GitPanel.css';

export const GitPanel: React.FC = () => {
  const {
    isPanelOpen,
    activeTab,
    status,
    isStatusLoading,
    error,
    closePanel,
    setActiveTab,
    refreshStatus,
    refreshBranches,
    refreshCommits,
    refreshStashes,
    clearError,
  } = useGitStore();

  const currentProject = useProjectStore((state) => state.currentProject);
  const repoPath = currentProject?.path || '';

  // Load initial data when panel opens
  useEffect(() => {
    if (isPanelOpen && repoPath) {
      refreshStatus(repoPath);
    }
  }, [isPanelOpen, repoPath, refreshStatus]);

  // Load tab-specific data when tab changes
  useEffect(() => {
    if (!isPanelOpen || !repoPath) return;

    switch (activeTab) {
      case 'branches':
        refreshBranches(repoPath);
        break;
      case 'history':
        refreshCommits(repoPath);
        break;
      case 'stashes':
        refreshStashes(repoPath);
        break;
    }
  }, [activeTab, isPanelOpen, repoPath, refreshBranches, refreshCommits, refreshStashes]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isPanelOpen) return;

    if (e.key === 'Escape') {
      closePanel();
      e.preventDefault();
    }
  }, [isPanelOpen, closePanel]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isPanelOpen) return null;

  const tabs = [
    { id: 'changes' as const, label: 'Changes', count: status?.files.length || 0 },
    { id: 'branches' as const, label: 'Branches' },
    { id: 'history' as const, label: 'History' },
    { id: 'stashes' as const, label: 'Stashes', count: status?.stashCount || 0 },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'changes':
        return <ChangesTab repoPath={repoPath} />;
      case 'branches':
        return <BranchesTab repoPath={repoPath} />;
      case 'history':
        return <HistoryTab repoPath={repoPath} />;
      case 'stashes':
        return <StashesTab repoPath={repoPath} />;
    }
  };

  return (
    <div className="git-panel">
      <div className="git-panel-header">
        <h3 className="git-panel-title">
          <span className="git-panel-title-icon">&#9737;</span>
          Source Control
        </h3>
        <div className="git-panel-header-actions">
          <button
            className="git-panel-btn git-panel-btn--icon"
            onClick={() => refreshStatus(repoPath)}
            disabled={isStatusLoading}
            title="Refresh"
          >
            &#x21bb;
          </button>
          <button
            className="git-panel-btn git-panel-btn--icon"
            onClick={closePanel}
            title="Close (Esc)"
          >
            &times;
          </button>
        </div>
      </div>

      {/* Branch indicator */}
      {status && (
        <div className="git-panel-branch-bar">
          <span className="git-panel-branch-name">
            <span className="git-panel-branch-icon">&#9737;</span>
            {status.branch}
          </span>
          {status.upstream && (
            <span className="git-panel-sync-status">
              {status.ahead > 0 && (
                <span className="git-panel-sync-ahead" title={`${status.ahead} commits ahead`}>
                  &uarr;{status.ahead}
                </span>
              )}
              {status.behind > 0 && (
                <span className="git-panel-sync-behind" title={`${status.behind} commits behind`}>
                  &darr;{status.behind}
                </span>
              )}
            </span>
          )}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="git-panel-error">
          <span>{error}</span>
          <button className="git-panel-error-dismiss" onClick={clearError}>
            &times;
          </button>
        </div>
      )}

      {/* Tab navigation */}
      <div className="git-panel-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`git-panel-tab ${activeTab === tab.id ? 'git-panel-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="git-panel-tab-count">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="git-panel-content">
        {renderTabContent()}
      </div>
    </div>
  );
};

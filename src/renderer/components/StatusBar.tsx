import React from 'react';
import { useProjectStore } from '../stores/projectStore';
import { useGitStore } from '../stores/gitStore';
import { useQuickChatStore } from '../stores/quickChatStore';
import { useCodeReviewStore } from '../stores/codeReviewStore';

export const StatusBar: React.FC = () => {
  const currentProject = useProjectStore((state) => state.currentProject);
  const { status, togglePanel } = useGitStore();
  const openQuickChat = useQuickChatStore((state) => state.open);
  const openCodeReview = useCodeReviewStore((state) => state.openSelector);

  if (!currentProject) return null;

  const changedFilesCount = status?.files.length || 0;
  const syncStatus = status ? { ahead: status.ahead, behind: status.behind } : null;

  return (
    <div className="status-bar">
      <div className="status-bar-left">
        <span className="status-bar-item">
          <span className="status-bar-icon">&#128193;</span>
          {currentProject.path}
        </span>
      </div>
      <div className="status-bar-right">
        <button
          className="status-bar-item status-bar-btn"
          onClick={openCodeReview}
          title="Code Review (Ctrl+Shift+R)"
        >
          <svg className="status-bar-icon-svg" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5.75 1a.75.75 0 0 0-.75.75v3c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-3a.75.75 0 0 0-.75-.75h-4.5zm.75 3V2.5h3V4h-3zm-2.874-.467a.75.75 0 0 1-.058 1.06L1.8 6.217l1.768 1.624a.75.75 0 1 1-1.016 1.102l-2.25-2.069a.75.75 0 0 1 0-1.102l2.25-2.182a.75.75 0 0 1 1.06.058zM13.874 4.533a.75.75 0 0 0 .058-1.06.75.75 0 0 0-1.06-.058l-2.25 2.182a.75.75 0 0 0 0 1.102l2.25 2.069a.75.75 0 1 0 1.016-1.102L12.12 6.042l1.768-1.624z M3.5 11a.75.75 0 0 0 0 1.5h9a.75.75 0 0 0 0-1.5h-9zm0 3a.75.75 0 0 0 0 1.5h5a.75.75 0 0 0 0-1.5h-5z"/>
          </svg>
        </button>
        <button
          className="status-bar-item status-bar-btn"
          onClick={openQuickChat}
          title="Quick Chat (Ctrl+Shift+Q)"
        >
          <span className="status-bar-icon">&#128172;</span>
        </button>
        {currentProject.isGitRepo && currentProject.gitBranch && (
          <button
            className="status-bar-item status-bar-git-btn"
            onClick={togglePanel}
            title="Open Source Control (Ctrl+Shift+G)"
          >
            <span className="status-bar-icon">&#9737;</span>
            <span className="status-bar-branch">{currentProject.gitBranch}</span>
            {syncStatus && (syncStatus.ahead > 0 || syncStatus.behind > 0) && (
              <span className="status-bar-sync">
                {syncStatus.ahead > 0 && <span className="status-bar-ahead">↑{syncStatus.ahead}</span>}
                {syncStatus.behind > 0 && <span className="status-bar-behind">↓{syncStatus.behind}</span>}
              </span>
            )}
            {changedFilesCount > 0 && (
              <span className="status-bar-changes">{changedFilesCount}</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

import React from 'react';
import { useProjectStore } from '../stores/projectStore';
import { useGitStore } from '../stores/gitStore';
import { useQuickChatStore } from '../stores/quickChatStore';

export const StatusBar: React.FC = () => {
  const currentProject = useProjectStore((state) => state.currentProject);
  const { status, togglePanel } = useGitStore();
  const openQuickChat = useQuickChatStore((state) => state.open);

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

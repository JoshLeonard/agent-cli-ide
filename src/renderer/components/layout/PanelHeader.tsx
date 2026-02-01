import React from 'react';
import type { SessionInfo } from '../../../shared/types/session';
import { FileReviewBadge } from '../review/FileReviewBadge';
import { useFileReviewStore } from '../../stores/fileReviewStore';

interface PanelHeaderProps {
  session: SessionInfo;
  onClose: () => void;
}

function getBasename(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts[parts.length - 1] || path;
}

export const PanelHeader: React.FC<PanelHeaderProps> = ({ session, onClose }) => {
  const displayName = session.branch || getBasename(session.cwd);
  const icon = session.agentIcon || '📟';
  const openReview = useFileReviewStore((state) => state.openReview);

  const handleReviewClick = () => {
    openReview(session.id);
  };

  return (
    <div className="panel-header">
      <span className="panel-header-icon">{icon}</span>
      <span className="panel-header-title" title={session.cwd}>
        {displayName}
      </span>
      <FileReviewBadge sessionId={session.id} onClick={handleReviewClick} />
      <button
        className="panel-header-close"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        title="Close session"
      >
        ×
      </button>
    </div>
  );
};

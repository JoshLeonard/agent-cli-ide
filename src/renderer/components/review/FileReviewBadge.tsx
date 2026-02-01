import React from 'react';
import { useFileReviewStore } from '../../stores/fileReviewStore';
import './FileReviewBadge.css';

// Badge component that shows unreviewed file change count on panel headers
// Appears next to the close button when files have been modified

interface FileReviewBadgeProps {
  sessionId: string;
  onClick: () => void;
}

export const FileReviewBadge: React.FC<FileReviewBadgeProps> = ({
  sessionId,
  onClick,
}) => {
  const count = useFileReviewStore((state) => state.getUnreviewedCount(sessionId));

  if (count === 0) {
    return null;
  }

  return (
    <button
      className="file-review-badge"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={`${count} file${count > 1 ? 's' : ''} changed - click to review`}
    >
      {count}
    </button>
  );
};

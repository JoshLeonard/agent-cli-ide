import React from 'react';
import type { PendingFileChange } from '../../../shared/types/fileReview';

interface FileReviewListProps {
  changes: PendingFileChange[];
  currentIndex: number;
  hasUnsavedChanges: boolean;
  onSelect: (index: number) => void;
}

function getChangeIcon(changeType: PendingFileChange['changeType']): string {
  switch (changeType) {
    case 'created':
      return '+';
    case 'modified':
      return '~';
    case 'deleted':
      return '-';
    default:
      return '?';
  }
}

function getChangeIconClass(changeType: PendingFileChange['changeType']): string {
  switch (changeType) {
    case 'created':
      return 'file-review-list-icon--added';
    case 'modified':
      return 'file-review-list-icon--modified';
    case 'deleted':
      return 'file-review-list-icon--deleted';
    default:
      return '';
  }
}

function getFileName(filePath: string): string {
  return filePath.split('/').pop() || filePath;
}

export const FileReviewList: React.FC<FileReviewListProps> = ({
  changes,
  currentIndex,
  hasUnsavedChanges,
  onSelect,
}) => {
  return (
    <div className="file-review-list">
      {changes.map((change, index) => {
        const isSelected = index === currentIndex;
        const isCurrentUnsaved = isSelected && hasUnsavedChanges;

        return (
          <button
            key={change.id}
            className={`file-review-list-item ${isSelected ? 'file-review-list-item--selected' : ''} ${change.reviewed ? 'file-review-list-item--reviewed' : ''}`}
            onClick={() => onSelect(index)}
            title={change.filePath}
          >
            <span className={`file-review-list-icon ${getChangeIconClass(change.changeType)}`}>
              {getChangeIcon(change.changeType)}
            </span>
            <span className="file-review-list-name">
              {getFileName(change.filePath)}
            </span>
            {isCurrentUnsaved && (
              <span className="file-review-list-unsaved" title="Unsaved changes">
                *
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import type { PendingFileChange } from '../../../shared/types/fileReview';
import { FileTree } from './FileTree';
import { buildFileTree } from './buildFileTree';

interface FileReviewListProps {
  changes: PendingFileChange[];
  currentIndex: number;
  hasUnsavedChanges: boolean;
  onSelect: (index: number) => void;
}

type ViewMode = 'tree' | 'list';

const STORAGE_KEY = 'fileReviewViewMode';

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
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'tree' || saved === 'list') {
        return saved;
      }
    } catch {
      // Ignore storage errors
    }
    return 'tree'; // Default to tree view
  });

  const tree = useMemo(() => buildFileTree(changes), [changes]);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Ignore storage errors
    }
  };

  return (
    <div className="file-review-list-container">
      {/* View mode toggle */}
      <div className="file-review-view-toggle">
        <button
          className={`file-review-view-toggle-btn ${viewMode === 'tree' ? 'file-review-view-toggle-btn--active' : ''}`}
          onClick={() => handleViewModeChange('tree')}
          title="Tree view"
          aria-pressed={viewMode === 'tree'}
        >
          <span className="file-review-view-toggle-icon file-review-view-toggle-icon--tree" />
        </button>
        <button
          className={`file-review-view-toggle-btn ${viewMode === 'list' ? 'file-review-view-toggle-btn--active' : ''}`}
          onClick={() => handleViewModeChange('list')}
          title="List view"
          aria-pressed={viewMode === 'list'}
        >
          <span className="file-review-view-toggle-icon file-review-view-toggle-icon--list" />
        </button>
      </div>

      {/* Conditional rendering based on view mode */}
      {viewMode === 'tree' ? (
        <FileTree
          tree={tree}
          currentIndex={currentIndex}
          hasUnsavedChanges={hasUnsavedChanges}
          onSelect={onSelect}
        />
      ) : (
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
      )}
    </div>
  );
};

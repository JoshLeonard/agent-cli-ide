import React from 'react';
import type { GitHubPRFile } from '../../../shared/types/codeReview';

interface CodeReviewFileListProps {
  files: GitHubPRFile[];
  currentIndex: number;
  viewedFiles: string[];
  onSelect: (index: number) => void;
  getCommentCount: (filePath: string) => number;
}

export const CodeReviewFileList: React.FC<CodeReviewFileListProps> = ({
  files,
  currentIndex,
  viewedFiles,
  onSelect,
  getCommentCount,
}) => {
  // Group files by directory
  const groupedFiles = groupFilesByDirectory(files);

  return (
    <div className="code-review-file-list">
      <div className="code-review-file-list-header">
        <span className="code-review-file-list-title">Files</span>
        <span className="code-review-file-list-count">
          {files.length} file{files.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="code-review-file-list-content">
        {Object.entries(groupedFiles).map(([dir, dirFiles]) => (
          <div key={dir} className="code-review-file-group">
            {dir && (
              <div className="code-review-file-group-header" title={dir}>
                {dir}
              </div>
            )}
            {dirFiles.map(({ file, originalIndex }) => {
              const commentCount = getCommentCount(file.filename);
              const isViewed = viewedFiles.includes(file.filename);
              const isSelected = originalIndex === currentIndex;

              return (
                <button
                  key={file.filename}
                  className={`code-review-file-item ${isSelected ? 'code-review-file-item--selected' : ''} ${
                    isViewed ? 'code-review-file-item--viewed' : ''
                  }`}
                  onClick={() => onSelect(originalIndex)}
                  title={file.filename}
                >
                  <span className={`code-review-file-status code-review-file-status--${file.status}`}>
                    {getStatusIcon(file.status)}
                  </span>
                  <span className="code-review-file-name">
                    {getFileName(file.filename)}
                  </span>
                  {commentCount > 0 && (
                    <span className="code-review-file-comment-count">{commentCount}</span>
                  )}
                  <span className="code-review-file-stats">
                    {file.additions > 0 && (
                      <span className="code-review-file-additions">+{file.additions}</span>
                    )}
                    {file.deletions > 0 && (
                      <span className="code-review-file-deletions">-{file.deletions}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

interface FileWithIndex {
  file: GitHubPRFile;
  originalIndex: number;
}

function groupFilesByDirectory(files: GitHubPRFile[]): Record<string, FileWithIndex[]> {
  const groups: Record<string, FileWithIndex[]> = {};

  files.forEach((file, originalIndex) => {
    const parts = file.filename.split('/');
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '';

    if (!groups[dir]) {
      groups[dir] = [];
    }
    groups[dir].push({ file, originalIndex });
  });

  // Sort directories
  const sortedGroups: Record<string, FileWithIndex[]> = {};
  Object.keys(groups)
    .sort()
    .forEach((key) => {
      sortedGroups[key] = groups[key];
    });

  return sortedGroups;
}

function getFileName(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1];
}

function getStatusIcon(status: GitHubPRFile['status']): string {
  switch (status) {
    case 'added':
      return 'A';
    case 'removed':
      return 'D';
    case 'modified':
      return 'M';
    case 'renamed':
      return 'R';
    case 'copied':
      return 'C';
    default:
      return '?';
  }
}

export default CodeReviewFileList;

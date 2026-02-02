import React, { useState, useEffect, useCallback } from 'react';
import type { FileTreeNode } from './buildFileTree';
import type { FileChangeType } from '../../../shared/types/fileReview';

interface FileTreeProps {
  tree: FileTreeNode[];
  currentIndex: number;
  hasUnsavedChanges: boolean;
  onSelect: (index: number) => void;
  storageKey?: string; // Key for persisting expand state
}

interface FileTreeItemProps {
  node: FileTreeNode;
  depth: number;
  currentIndex: number;
  hasUnsavedChanges: boolean;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  onSelect: (index: number) => void;
}

function getChangeIcon(changeType?: FileChangeType): string {
  switch (changeType) {
    case 'created':
      return '+';
    case 'modified':
      return '~';
    case 'deleted':
      return '-';
    default:
      return '';
  }
}

function getChangeIconClass(changeType?: FileChangeType): string {
  switch (changeType) {
    case 'created':
      return 'file-tree-icon--added';
    case 'modified':
      return 'file-tree-icon--modified';
    case 'deleted':
      return 'file-tree-icon--deleted';
    default:
      return '';
  }
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({
  node,
  depth,
  currentIndex,
  hasUnsavedChanges,
  expandedPaths,
  onToggle,
  onSelect,
}) => {
  const isExpanded = expandedPaths.has(node.path);
  const isFile = node.type === 'file';
  const isSelected = isFile && node.changeIndex === currentIndex;
  const isCurrentUnsaved = isSelected && hasUnsavedChanges;

  const handleClick = () => {
    if (isFile && node.changeIndex !== undefined) {
      onSelect(node.changeIndex);
    } else {
      onToggle(node.path);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <>
      <div
        className={`file-tree-item ${isFile ? 'file-tree-item--file' : 'file-tree-item--folder'} ${isSelected ? 'file-tree-item--selected' : ''} ${node.reviewed ? 'file-tree-item--reviewed' : ''}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="treeitem"
        tabIndex={0}
        aria-expanded={!isFile ? isExpanded : undefined}
        aria-selected={isSelected}
        title={node.path}
      >
        {/* Expand/collapse icon for folders */}
        {!isFile && (
          <span className="file-tree-expand">
            {isExpanded ? '▾' : '▸'}
          </span>
        )}

        {/* Folder or file icon */}
        <span className={`file-tree-type-icon ${isFile ? getChangeIconClass(node.changeType) : 'file-tree-type-icon--folder'}`}>
          {isFile ? getChangeIcon(node.changeType) : ''}
        </span>

        {/* Name */}
        <span className="file-tree-name">
          {node.name}
        </span>

        {/* File count for folders */}
        {!isFile && node.fileCount !== undefined && node.fileCount > 0 && (
          <span className="file-tree-count">
            ({node.fileCount})
          </span>
        )}

        {/* Unsaved indicator for files */}
        {isCurrentUnsaved && (
          <span className="file-tree-unsaved" title="Unsaved changes">
            *
          </span>
        )}
      </div>

      {/* Render children if expanded */}
      {!isFile && isExpanded && node.children && (
        <div className="file-tree-children" role="group">
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              currentIndex={currentIndex}
              hasUnsavedChanges={hasUnsavedChanges}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </>
  );
};

export const FileTree: React.FC<FileTreeProps> = ({
  tree,
  currentIndex,
  hasUnsavedChanges,
  onSelect,
  storageKey = 'fileReviewExpandedPaths',
}) => {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    // Try to restore from sessionStorage
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        return new Set(JSON.parse(saved));
      }
    } catch {
      // Ignore parse errors
    }
    // Default: expand all folders
    const allPaths = new Set<string>();
    const collectFolders = (nodes: FileTreeNode[]) => {
      nodes.forEach(node => {
        if (node.type === 'folder') {
          allPaths.add(node.path);
          if (node.children) {
            collectFolders(node.children);
          }
        }
      });
    };
    collectFolders(tree);
    return allPaths;
  });

  // Persist expand state to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify([...expandedPaths]));
    } catch {
      // Ignore storage errors
    }
  }, [expandedPaths, storageKey]);

  // Update expanded paths when tree changes (e.g., new folders)
  useEffect(() => {
    const collectAllFolderPaths = (nodes: FileTreeNode[]): string[] => {
      const paths: string[] = [];
      nodes.forEach(node => {
        if (node.type === 'folder') {
          paths.push(node.path);
          if (node.children) {
            paths.push(...collectAllFolderPaths(node.children));
          }
        }
      });
      return paths;
    };

    const allFolderPaths = collectAllFolderPaths(tree);

    // Add any new folders that aren't in the current set
    setExpandedPaths(prev => {
      const newSet = new Set(prev);
      let changed = false;
      allFolderPaths.forEach(path => {
        if (!newSet.has(path)) {
          newSet.add(path);
          changed = true;
        }
      });
      return changed ? newSet : prev;
    });
  }, [tree]);

  const handleToggle = useCallback((path: string) => {
    setExpandedPaths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  }, []);

  if (tree.length === 0) {
    return (
      <div className="file-tree file-tree--empty">
        No changes to review
      </div>
    );
  }

  return (
    <div className="file-tree" role="tree">
      {tree.map((node) => (
        <FileTreeItem
          key={node.path}
          node={node}
          depth={0}
          currentIndex={currentIndex}
          hasUnsavedChanges={hasUnsavedChanges}
          expandedPaths={expandedPaths}
          onToggle={handleToggle}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
};

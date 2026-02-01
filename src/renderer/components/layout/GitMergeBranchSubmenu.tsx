import React, { useState, useRef, useEffect } from 'react';

export interface BranchInfo {
  name: string;
  isCurrent: boolean;
  isMain: boolean;
}

interface GitMergeBranchSubmenuProps {
  branches: BranchInfo[];
  onMerge: (branchName: string) => void;
  parentPosition: { x: number; y: number };
}

export const GitMergeBranchSubmenu: React.FC<GitMergeBranchSubmenuProps> = ({
  branches,
  onMerge,
  parentPosition,
}) => {
  const submenuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState({ x: 0, y: 0 });

  // Adjust position after rendering to keep on screen
  useEffect(() => {
    if (submenuRef.current) {
      const rect = submenuRef.current.getBoundingClientRect();
      let x = parentPosition.x;
      let y = parentPosition.y;

      // Adjust horizontal: if submenu would go off right edge, position to the left
      if (x + rect.width > window.innerWidth) {
        x = parentPosition.x - rect.width - 160; // Position to left of parent menu
      }

      // Adjust vertical: if submenu would go off bottom edge
      if (y + rect.height > window.innerHeight) {
        y = window.innerHeight - rect.height - 5;
      }

      setAdjustedPosition({ x, y });
    }
  }, [parentPosition]);

  // Sort branches: main branch first, then alphabetically
  const sortedBranches = [...branches].sort((a, b) => {
    if (a.isMain && !b.isMain) return -1;
    if (!a.isMain && b.isMain) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div
      className="quick-commands-submenu"
      ref={submenuRef}
      style={{
        left: adjustedPosition.x || parentPosition.x,
        top: adjustedPosition.y || parentPosition.y,
      }}
    >
      {sortedBranches.map((branch) => (
        <button
          key={branch.name}
          className={`submenu-item ${branch.isCurrent ? 'disabled' : ''}`}
          onClick={() => !branch.isCurrent && onMerge(branch.name)}
          disabled={branch.isCurrent}
          style={branch.isCurrent ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
        >
          <span className="submenu-item-name">
            {branch.name}
            {branch.isMain && ' (main)'}
            {branch.isCurrent && ' (current)'}
          </span>
        </button>
      ))}
    </div>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import type { QuickCommand } from '../../../shared/types/settings';

interface QuickCommandsSubmenuProps {
  commands: QuickCommand[];
  onExecute: (command: QuickCommand) => void;
  parentPosition: { x: number; y: number };
}

export const QuickCommandsSubmenu: React.FC<QuickCommandsSubmenuProps> = ({
  commands,
  onExecute,
  parentPosition,
}) => {
  const submenuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState({ x: 0, y: 0 });

  // Group commands by category
  const groupedCommands = commands.reduce((acc, cmd) => {
    const category = cmd.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(cmd);
    return acc;
  }, {} as Record<string, QuickCommand[]>);

  const categories = Object.keys(groupedCommands);

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

  return (
    <div
      className="quick-commands-submenu"
      ref={submenuRef}
      style={{
        left: adjustedPosition.x || parentPosition.x,
        top: adjustedPosition.y || parentPosition.y,
      }}
    >
      {categories.map((category, catIndex) => (
        <div key={category} className="submenu-category">
          <div className="submenu-category-label">{category}</div>
          {groupedCommands[category].map((cmd) => (
            <button
              key={cmd.id}
              className="submenu-item"
              onClick={() => onExecute(cmd)}
            >
              <span className="submenu-item-name">{cmd.name}</span>
            </button>
          ))}
          {catIndex < categories.length - 1 && (
            <div className="submenu-separator" />
          )}
        </div>
      ))}
    </div>
  );
};

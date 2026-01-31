import React, { useEffect, useRef, useCallback } from 'react';
import './PanelContextMenu.css';

interface ContextMenuPosition {
  x: number;
  y: number;
}

interface PanelContextMenuProps {
  position: ContextMenuPosition;
  onCloseSession: () => void;
  onDismiss: () => void;
}

export const PanelContextMenu: React.FC<PanelContextMenuProps> = ({
  position,
  onCloseSession,
  onDismiss,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    },
    [onDismiss]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss();
      }
    },
    [onDismiss]
  );

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleClickOutside, handleKeyDown]);

  // Adjust position to keep menu on screen
  const adjustedPosition = { ...position };
  if (menuRef.current) {
    const rect = menuRef.current.getBoundingClientRect();
    if (position.x + rect.width > window.innerWidth) {
      adjustedPosition.x = window.innerWidth - rect.width - 5;
    }
    if (position.y + rect.height > window.innerHeight) {
      adjustedPosition.y = window.innerHeight - rect.height - 5;
    }
  }

  const handleItemClick = (action: () => void) => {
    action();
    onDismiss();
  };

  return (
    <div
      className="panel-context-menu"
      ref={menuRef}
      style={{ left: adjustedPosition.x, top: adjustedPosition.y }}
    >
      <button
        className="context-menu-item danger"
        onClick={() => handleItemClick(onCloseSession)}
      >
        <span className="context-menu-icon">&#10005;</span>
        Close Session
      </button>
    </div>
  );
};

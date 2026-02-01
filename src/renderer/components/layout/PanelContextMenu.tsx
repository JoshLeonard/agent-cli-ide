import React, { useEffect, useRef, useCallback, useState } from 'react';
import { QuickCommandsSubmenu } from './QuickCommandsSubmenu';
import type { QuickCommand } from '../../../shared/types/settings';
import './PanelContextMenu.css';

interface ContextMenuPosition {
  x: number;
  y: number;
}

interface PanelContextMenuProps {
  position: ContextMenuPosition;
  sessionId?: string;
  quickCommands?: QuickCommand[];
  onCloseSession: () => void;
  onCopyToClipboard?: () => void;
  onSendToSession?: () => void;
  onPasteSharedClipboard?: () => void;
  onPasteOSClipboard?: () => void;
  onQuickCommand?: (command: QuickCommand) => void;
  onDismiss: () => void;
}

export const PanelContextMenu: React.FC<PanelContextMenuProps> = ({
  position,
  sessionId,
  quickCommands,
  onCloseSession,
  onCopyToClipboard,
  onSendToSession,
  onPasteSharedClipboard,
  onPasteOSClipboard,
  onQuickCommand,
  onDismiss,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showQuickCommands, setShowQuickCommands] = useState(false);
  const [quickCommandsPosition, setQuickCommandsPosition] = useState({ x: 0, y: 0 });
  const quickCommandsItemRef = useRef<HTMLButtonElement>(null);

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

  const handleQuickCommandsHover = useCallback(() => {
    if (quickCommandsItemRef.current) {
      const rect = quickCommandsItemRef.current.getBoundingClientRect();
      setQuickCommandsPosition({
        x: rect.right,
        y: rect.top,
      });
      setShowQuickCommands(true);
    }
  }, []);

  const handleQuickCommandsLeave = useCallback(() => {
    setShowQuickCommands(false);
  }, []);

  const handleQuickCommandExecute = useCallback((command: QuickCommand) => {
    if (onQuickCommand) {
      onQuickCommand(command);
    }
    onDismiss();
  }, [onQuickCommand, onDismiss]);

  return (
    <div
      className="panel-context-menu"
      ref={menuRef}
      style={{ left: adjustedPosition.x, top: adjustedPosition.y }}
    >
      {/* Messaging options */}
      {sessionId && onCopyToClipboard && (
        <button
          className="context-menu-item"
          onClick={() => handleItemClick(onCopyToClipboard)}
        >
          <span className="context-menu-icon">{'\u2398'}</span>
          Copy to Shared Clipboard
        </button>
      )}
      {sessionId && onSendToSession && (
        <button
          className="context-menu-item"
          onClick={() => handleItemClick(onSendToSession)}
        >
          <span className="context-menu-icon">{'\u2192'}</span>
          Send to Session...
        </button>
      )}
      {sessionId && onPasteSharedClipboard && (
        <button
          className="context-menu-item"
          onClick={() => handleItemClick(onPasteSharedClipboard)}
        >
          <span className="context-menu-icon">{'\u2193'}</span>
          Paste Shared Clipboard
        </button>
      )}
      {sessionId && onPasteOSClipboard && (
        <button
          className="context-menu-item"
          onClick={() => handleItemClick(onPasteOSClipboard)}
        >
          <span className="context-menu-icon">{'\u{1F4CB}'}</span>
          Paste from Clipboard
        </button>
      )}

      {/* Separator if we have messaging options */}
      {sessionId && (onCopyToClipboard || onSendToSession || onPasteSharedClipboard || onPasteOSClipboard) && (
        <div className="context-menu-separator" />
      )}

      {/* Quick Commands submenu */}
      {sessionId && quickCommands && quickCommands.length > 0 && onQuickCommand && (
        <div
          className="context-menu-item-wrapper"
          onMouseEnter={handleQuickCommandsHover}
          onMouseLeave={handleQuickCommandsLeave}
        >
          <button
            ref={quickCommandsItemRef}
            className="context-menu-item has-submenu"
          >
            <span className="context-menu-icon">{'\u26A1'}</span>
            Quick Commands
            <span className="submenu-arrow">{'\u25B6'}</span>
          </button>
          {showQuickCommands && (
            <QuickCommandsSubmenu
              commands={quickCommands}
              onExecute={handleQuickCommandExecute}
              parentPosition={quickCommandsPosition}
            />
          )}
        </div>
      )}

      {/* Separator before danger zone */}
      {sessionId && quickCommands && quickCommands.length > 0 && (
        <div className="context-menu-separator" />
      )}

      {/* Session management */}
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

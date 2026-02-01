import React, { useEffect, useRef, useCallback, useState } from 'react';
import { QuickCommandsSubmenu } from './QuickCommandsSubmenu';
import { GitMergeBranchSubmenu, type BranchInfo } from './GitMergeBranchSubmenu';
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
  mergeBranches?: BranchInfo[];
  onCloseSession: () => void;
  onCopyToClipboard?: () => void;
  onSendToSession?: () => void;
  onPasteSharedClipboard?: () => void;
  onPasteOSClipboard?: () => void;
  onQuickCommand?: (command: QuickCommand) => void;
  onGitMerge?: (branchName: string) => void;
  onDismiss: () => void;
}

export const PanelContextMenu: React.FC<PanelContextMenuProps> = ({
  position,
  sessionId,
  quickCommands,
  mergeBranches,
  onCloseSession,
  onCopyToClipboard,
  onSendToSession,
  onPasteSharedClipboard,
  onPasteOSClipboard,
  onQuickCommand,
  onGitMerge,
  onDismiss,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showQuickCommands, setShowQuickCommands] = useState(false);
  const [quickCommandsPosition, setQuickCommandsPosition] = useState({ x: 0, y: 0 });
  const quickCommandsItemRef = useRef<HTMLButtonElement>(null);
  const [showMergeBranches, setShowMergeBranches] = useState(false);
  const [mergeBranchesPosition, setMergeBranchesPosition] = useState({ x: 0, y: 0 });
  const mergeBranchesItemRef = useRef<HTMLButtonElement>(null);

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

  const handleMergeBranchesHover = useCallback(() => {
    if (mergeBranchesItemRef.current) {
      const rect = mergeBranchesItemRef.current.getBoundingClientRect();
      setMergeBranchesPosition({
        x: rect.right,
        y: rect.top,
      });
      setShowMergeBranches(true);
    }
  }, []);

  const handleMergeBranchesLeave = useCallback(() => {
    setShowMergeBranches(false);
  }, []);

  const handleGitMergeExecute = useCallback((branchName: string) => {
    if (onGitMerge) {
      onGitMerge(branchName);
    }
    onDismiss();
  }, [onGitMerge, onDismiss]);

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

      {/* Git Merge Branch submenu */}
      {sessionId && mergeBranches && mergeBranches.length > 0 && onGitMerge && (
        <div
          className="context-menu-item-wrapper"
          onMouseEnter={handleMergeBranchesHover}
          onMouseLeave={handleMergeBranchesLeave}
        >
          <button
            ref={mergeBranchesItemRef}
            className="context-menu-item has-submenu"
          >
            <span className="context-menu-icon">{'\u{1F500}'}</span>
            Git Merge Branch
            <span className="submenu-arrow">{'\u25B6'}</span>
          </button>
          {showMergeBranches && (
            <GitMergeBranchSubmenu
              branches={mergeBranches}
              onMerge={handleGitMergeExecute}
              parentPosition={mergeBranchesPosition}
            />
          )}
        </div>
      )}

      {/* Separator before danger zone */}
      {sessionId && ((quickCommands && quickCommands.length > 0) || (mergeBranches && mergeBranches.length > 0)) && (
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

import React, { useState, useCallback } from 'react';
import type { TerminalPanel as TerminalPanelType } from '../../../shared/types/layout';
import { PanelContextMenu } from './PanelContextMenu';
import { TerminalContainer } from '../terminal/TerminalContainer';
import { useLayoutStore } from '../../stores/layoutStore';
import './TerminalPanel.css';

interface WorktreeDropData {
  path: string;
  branch: string;
}

interface TerminalPanelProps {
  panel: TerminalPanelType;
  isActive: boolean;
  onCreateSession: (panelId: string) => void;
  onWorktreeDrop?: (worktreeData: WorktreeDropData) => void;
}

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  panel,
  isActive,
  onCreateSession,
  onWorktreeDrop,
}) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
  });
  const [isDragOver, setDragOver] = useState(false);

  const { setActivePanel, clearPanelSession } = useLayoutStore();

  const handlePanelClick = useCallback(() => {
    setActivePanel(panel.id);
  }, [panel.id, setActivePanel]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    // Only show context menu if panel has a session
    if (panel.sessionId) {
      setContextMenu({
        isOpen: true,
        x: e.clientX,
        y: e.clientY,
      });
    }
  }, [panel.sessionId]);

  const handleDismissContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleCloseSession = useCallback(() => {
    clearPanelSession(panel.id);
  }, [panel.id, clearPanelSession]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    // Only accept drops on empty panels
    if (!panel.sessionId) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setDragOver(true);
    }
  }, [panel.sessionId]);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    // Only accept drops on empty panels
    if (panel.sessionId) return;

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.type === 'worktree' && onWorktreeDrop) {
        onWorktreeDrop({ path: data.path, branch: data.branch });
      }
    } catch {
      // Ignore invalid JSON
    }
  }, [panel.sessionId, onWorktreeDrop]);

  return (
    <div
      className={`terminal-panel ${isActive ? 'active' : ''} ${isDragOver ? 'drag-over' : ''} ${panel.sessionId ? 'occupied' : ''}`}
      onClick={handlePanelClick}
      onContextMenu={handleContextMenu}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="terminal-panel-content">
        {panel.sessionId ? (
          <TerminalContainer
            key={`terminal-${panel.sessionId}`}
            sessionId={panel.sessionId}
            isActive={isActive}
            onFocus={handlePanelClick}
          />
        ) : (
          <div className="terminal-panel-empty">
            <button onClick={() => onCreateSession(panel.id)}>Create Session</button>
          </div>
        )}
      </div>

      {contextMenu.isOpen && panel.sessionId && (
        <PanelContextMenu
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onCloseSession={handleCloseSession}
          onDismiss={handleDismissContextMenu}
        />
      )}
    </div>
  );
};

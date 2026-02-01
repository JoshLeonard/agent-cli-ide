import React, { useState, useCallback } from 'react';
import type { TerminalPanel as TerminalPanelType } from '../../../shared/types/layout';
import { PanelContextMenu } from './PanelContextMenu';
import { TerminalContainer } from '../terminal/TerminalContainer';
import { MessageFeedback } from '../terminal/MessageFeedback';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useLayoutStore } from '../../stores/layoutStore';
import { useMessagingStore } from '../../stores/messagingStore';
import { useToastStore } from '../../stores/toastStore';
import './TerminalPanel.css';
import '../terminal/MessageFeedback.css';

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
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const { setActivePanel, clearPanelSession } = useLayoutStore();
  const { openQuickSend } = useMessagingStore();
  const { showToast } = useToastStore();

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
    setShowCloseConfirm(true);
  }, []);

  const handleConfirmClose = useCallback(() => {
    clearPanelSession(panel.id);
    setShowCloseConfirm(false);
  }, [panel.id, clearPanelSession]);

  const handleCancelClose = useCallback(() => {
    setShowCloseConfirm(false);
  }, []);

  const handleCopyToClipboard = useCallback(async () => {
    if (!panel.sessionId) return;
    // Get selected text from terminal if available, otherwise just note it
    // For now, we'll prompt user to select text first
    const selection = window.getSelection()?.toString();
    if (selection) {
      await window.terminalIDE.messaging.setClipboard(selection, panel.sessionId);
    } else {
      showToast('Select text in the terminal first', 'info');
    }
  }, [panel.sessionId, showToast]);

  const handleSendToSession = useCallback(() => {
    if (!panel.sessionId) return;
    openQuickSend();
  }, [panel.sessionId, openQuickSend]);

  const handlePasteSharedClipboard = useCallback(async () => {
    if (!panel.sessionId) return;
    const clipboard = await window.terminalIDE.messaging.getClipboard();
    if (clipboard) {
      await window.terminalIDE.session.write(panel.sessionId, clipboard.content);
    } else {
      showToast('Shared clipboard is empty', 'info');
    }
  }, [panel.sessionId, showToast]);

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

      {/* Message feedback overlay */}
      {panel.sessionId && (
        <MessageFeedback sessionId={panel.sessionId} />
      )}

      {contextMenu.isOpen && panel.sessionId && (
        <PanelContextMenu
          position={{ x: contextMenu.x, y: contextMenu.y }}
          sessionId={panel.sessionId}
          onCloseSession={handleCloseSession}
          onCopyToClipboard={handleCopyToClipboard}
          onSendToSession={handleSendToSession}
          onPasteSharedClipboard={handlePasteSharedClipboard}
          onDismiss={handleDismissContextMenu}
        />
      )}

      <ConfirmDialog
        isOpen={showCloseConfirm}
        title="Close Session"
        message="This will terminate the session. Continue?"
        confirmLabel="Close"
        variant="danger"
        onConfirm={handleConfirmClose}
        onCancel={handleCancelClose}
      />
    </div>
  );
};

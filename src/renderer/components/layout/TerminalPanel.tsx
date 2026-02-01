import React, { useState, useCallback } from 'react';
import type { TerminalPanel as TerminalPanelType } from '../../../shared/types/layout';
import type { QuickCommand } from '../../../shared/types/settings';
import type { BranchInfo } from './GitMergeBranchSubmenu';
import { PanelContextMenu } from './PanelContextMenu';
import { PanelHeader } from './PanelHeader';
import { TerminalContainer } from '../terminal/TerminalContainer';
import { MessageFeedback } from '../terminal/MessageFeedback';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useLayoutStore } from '../../stores/layoutStore';
import { useMessagingStore } from '../../stores/messagingStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useProjectStore } from '../../stores/projectStore';
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
  const [mergeBranches, setMergeBranches] = useState<BranchInfo[]>([]);

  const { setActivePanel, clearPanelSession, sessions } = useLayoutStore();
  const { openQuickSend } = useMessagingStore();
  const { settings } = useSettingsStore();
  const { showToast } = useToastStore();

  const session = panel.sessionId ? sessions.get(panel.sessionId) : null;

  const handlePanelClick = useCallback(() => {
    setActivePanel(panel.id);
  }, [panel.id, setActivePanel]);

  const handleContextMenu = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    // Only show context menu if panel has a session
    if (panel.sessionId) {
      setContextMenu({
        isOpen: true,
        x: e.clientX,
        y: e.clientY,
      });

      // Fetch branches for merge submenu
      const project = useProjectStore.getState().currentProject;
      if (project?.isGitRepo) {
        try {
          const worktrees = await window.terminalIDE.worktree.list(project.path);
          const currentBranch = session?.branch || project.gitBranch;

          const branches: BranchInfo[] = [];
          const seenBranches = new Set<string>();

          // Add main branch first
          if (project.gitBranch) {
            branches.push({
              name: project.gitBranch,
              isMain: true,
              isCurrent: project.gitBranch === currentBranch,
            });
            seenBranches.add(project.gitBranch);
          }

          // Add worktree branches (deduplicated)
          for (const wt of worktrees) {
            if (wt.branch && !seenBranches.has(wt.branch)) {
              branches.push({
                name: wt.branch,
                isMain: false,
                isCurrent: wt.branch === currentBranch,
              });
              seenBranches.add(wt.branch);
            }
          }

          setMergeBranches(branches);
        } catch {
          // If worktree list fails, just show empty branches
          setMergeBranches([]);
        }
      } else {
        setMergeBranches([]);
      }
    }
  }, [panel.sessionId, session?.branch]);

  const handleDismissContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleCloseSession = useCallback(() => {
    setShowCloseConfirm(true);
  }, []);

  const handleConfirmClose = useCallback(async () => {
    if (panel.sessionId) {
      await window.terminalIDE.session.terminate(panel.sessionId);
    }
    clearPanelSession(panel.id);
    setShowCloseConfirm(false);
  }, [panel.id, panel.sessionId, clearPanelSession]);

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

  const handlePasteOSClipboard = useCallback(async () => {
    if (!panel.sessionId) return;
    const content = await window.terminalIDE.clipboard.readOS();
    if (content) {
      await window.terminalIDE.session.write(panel.sessionId, content);
    } else {
      showToast('Clipboard is empty', 'info');
    }
  }, [panel.sessionId, showToast]);

  const handleQuickCommand = useCallback(async (command: QuickCommand) => {
    if (!panel.sessionId) return;
    const addNewline = command.addNewline !== false; // Default to true
    const content = addNewline ? command.command + '\n' : command.command;
    await window.terminalIDE.session.write(panel.sessionId, content);
  }, [panel.sessionId]);

  const handleGitMerge = useCallback(async (branchName: string) => {
    if (!panel.sessionId) return;
    await window.terminalIDE.session.write(panel.sessionId, `git merge ${branchName}\n`);
  }, [panel.sessionId]);

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
      {session && (
        <PanelHeader session={session} onClose={handleCloseSession} />
      )}
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
          quickCommands={settings.quickCommands}
          mergeBranches={mergeBranches}
          onCloseSession={handleCloseSession}
          onCopyToClipboard={handleCopyToClipboard}
          onSendToSession={handleSendToSession}
          onPasteSharedClipboard={handlePasteSharedClipboard}
          onPasteOSClipboard={handlePasteOSClipboard}
          onQuickCommand={handleQuickCommand}
          onGitMerge={handleGitMerge}
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

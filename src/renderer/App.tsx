import React, { useState } from 'react';
import { GridLayout } from './components/layout/GridLayout';
import { SessionSidebar } from './components/sidebar/SessionSidebar';
import { NewSessionDialog } from './components/NewSessionDialog';
import { WelcomeScreen } from './components/WelcomeScreen';
import { StatusBar } from './components/StatusBar';
import { QuickSendDialog } from './components/messaging/QuickSendDialog';
import { ToastContainer } from './components/ui/Toast';
import { TitleBar } from './components/titlebar/TitleBar';
import { SettingsDialog } from './components/settings/SettingsDialog';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { useLayoutStore } from './stores/layoutStore';
import { useProjectStore } from './stores/projectStore';
import { useMessagingStore } from './stores/messagingStore';
import {
  useSessionSync,
  useIpcSubscriptions,
  useKeyboardShortcuts,
  useLayoutPersistence,
  useProjectLoader,
  useFileReview,
} from './hooks';
import { FileReviewModal } from './components/review/FileReviewModal';
import type { SessionType } from '../shared/types/session';
import './components/messaging/QuickSendDialog.css';

const App: React.FC = () => {
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [pendingPanelId, setPendingPanelId] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [moveConfirmData, setMoveConfirmData] = useState<{
    worktreePath: string;
    sessionId: string;
    targetPanelId: string;
  } | null>(null);

  const currentProject = useProjectStore((state) => state.currentProject);

  const { openQuickSend } = useMessagingStore();

  const {
    gridConfig,
    panels,
    activePanel,
    setSessionForPanel,
    setActivePanel,
    setGridDimensions,
    updateSession,
    removeSession,
    findPanelBySessionId,
    getActiveSessionCount,
    findFirstEmptyPanel,
    getWorktreeAgent,
    setWorktreeAgent,
    findPanelByWorktreePath,
    moveSessionToPanel,
  } = useLayoutStore();

  // Initialize hooks for session sync, IPC subscriptions, and layout persistence
  useProjectLoader();
  useSessionSync();
  useIpcSubscriptions();
  useLayoutPersistence();
  useFileReview();
  const { handlePasteSharedClipboard } = useKeyboardShortcuts({
    onOpenSettings: () => setSettingsOpen(true),
  });

  const handleCreateSession = async (config: { type: SessionType; cwd: string; branch?: string; agentId?: string }) => {
    const sessionConfig = {
      ...config,
      cwd: config.cwd || currentProject?.path || process.cwd(),
    };
    const result = await window.terminalIDE.session.create(sessionConfig);

    if (result.success && result.session) {
      let targetPanelId: string | null = null;

      // If a specific panel was requested (clicking "Create Session" button in empty panel)
      if (pendingPanelId) {
        const pendingPanel = panels.find(p => p.id === pendingPanelId);
        if (pendingPanel && !pendingPanel.sessionId) {
          targetPanelId = pendingPanelId;
        }
      }

      // If no target yet, find any empty panel
      if (!targetPanelId) {
        const emptyPanel = findFirstEmptyPanel();
        if (emptyPanel) {
          targetPanelId = emptyPanel.id;
        }
      }

      // If still no target (all panels have sessions), show message
      if (!targetPanelId) {
        console.warn('Grid is full. Increase grid size to add more sessions.');
        // Terminate the session we just created since we can't display it
        await window.terminalIDE.session.terminate(result.session.id);
      } else {
        setSessionForPanel(targetPanelId, result.session.id);
        updateSession(result.session);
      }

      setPendingPanelId(null);
    } else {
      console.error('Failed to create session:', result.error);
    }
  };

  const handleCreateSessionForPanel = (panelId: string) => {
    setPendingPanelId(panelId);
    setDialogOpen(true);
  };

  const handleTerminateSession = async (sessionId?: string) => {
    const targetSessionId = sessionId || (() => {
      // Find active session from active panel
      const panel = panels.find((p) => p.id === activePanel);
      return panel?.sessionId || null;
    })();

    if (!targetSessionId) return;

    const result = await window.terminalIDE.session.terminate(targetSessionId);
    if (result.success) {
      removeSession(targetSessionId);
    }
  };

  const handleSelectSession = (sessionId: string) => {
    const panelId = findPanelBySessionId(sessionId);
    if (panelId) {
      setActivePanel(panelId);
    }
  };

  const handleGridPresetChange = (rows: number, cols: number) => {
    setGridDimensions(rows, cols);
  };

  const handleWorktreeDrop = async (panelId: string, worktreeData: { path: string; branch: string }) => {
    // Check if this worktree is already open in another panel
    const existingPanelId = findPanelByWorktreePath(worktreeData.path);

    if (existingPanelId && existingPanelId !== panelId) {
      const existingPanel = panels.find(p => p.id === existingPanelId);
      if (existingPanel?.sessionId) {
        // Prompt to move existing session
        setMoveConfirmData({
          worktreePath: worktreeData.path,
          sessionId: existingPanel.sessionId,
          targetPanelId: panelId,
        });
        return;
      }
    }

    // Create new session (original logic)
    const savedAgentId = getWorktreeAgent(worktreeData.path);
    let agentId = savedAgentId;

    // Fallback to default agent if no preference saved
    if (!agentId) {
      const defaultAgent = await window.terminalIDE.agent.getDefault();
      agentId = defaultAgent?.id;
    }

    const config = {
      type: 'attached' as const,
      cwd: worktreeData.path,
      agentId,
    };

    const result = await window.terminalIDE.session.create(config);
    if (result.success && result.session) {
      // Save agent preference for this worktree
      if (agentId) {
        setWorktreeAgent(worktreeData.path, agentId);
      }
      setSessionForPanel(panelId, result.session.id);
      updateSession(result.session);
    } else {
      console.error('Failed to create session from worktree drop:', result.error);
    }
  };

  const handleConfirmMoveSession = () => {
    if (moveConfirmData) {
      moveSessionToPanel(moveConfirmData.sessionId, moveConfirmData.targetPanelId);
    }
    setMoveConfirmData(null);
  };

  const handleCancelMoveSession = () => {
    setMoveConfirmData(null);
  };

  const activeSessionCount = getActiveSessionCount();

  // Handler for opening project
  const handleOpenProject = async () => {
    const path = await window.terminalIDE.dialog.selectDirectory();
    if (path) {
      await window.terminalIDE.project.open(path);
    }
  };

  // Handler for opening new session dialog
  const handleNewSession = () => {
    setDialogOpen(true);
  };

  // Handler for copy to shared clipboard
  const handleCopyShared = async () => {
    // Get selected text from terminal - this would need terminal selection API
    console.log('Copy to shared clipboard');
  };

  // Handler for toggle sidebar
  const handleToggleSidebar = () => {
    setSidebarVisible(!sidebarVisible);
  };

  // Handler for opening settings
  const handleOpenSettings = () => {
    setSettingsOpen(true);
  };

  // Check if active session exists
  const hasActiveSession = !!(activePanel && panels.find(p => p.id === activePanel)?.sessionId);

  // Show welcome screen if no project is open
  if (!currentProject) {
    return (
      <div className="app">
        <WelcomeScreen />
      </div>
    );
  }

  return (
    <div className="app">
      <TitleBar
        gridConfig={gridConfig}
        onGridChange={handleGridPresetChange}
        activeSessionCount={activeSessionCount}
        onNewSession={handleNewSession}
        onOpenProject={handleOpenProject}
        onTerminateSession={() => handleTerminateSession()}
        onSendMessage={openQuickSend}
        onBroadcast={openQuickSend}
        onCopyShared={handleCopyShared}
        onPasteShared={handlePasteSharedClipboard}
        onToggleSidebar={handleToggleSidebar}
        onOpenSettings={handleOpenSettings}
        hasActiveSession={hasActiveSession}
      />

      <div className="main-container">
        {sidebarVisible && (
          <SessionSidebar
            onSelectSession={handleSelectSession}
            onTerminateSession={handleTerminateSession}
          />
        )}
        <div className="main-content">
          <GridLayout
            panels={panels}
            config={gridConfig}
            activePanel={activePanel}
            onCreateSession={handleCreateSessionForPanel}
            onWorktreeDrop={handleWorktreeDrop}
          />
        </div>
      </div>

      <StatusBar />

      <NewSessionDialog
        isOpen={isDialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleCreateSession}
      />

      <QuickSendDialog />
      <ToastContainer />
      <SettingsDialog isOpen={isSettingsOpen} onClose={() => setSettingsOpen(false)} />
      <ConfirmDialog
        isOpen={moveConfirmData !== null}
        title="Move Session"
        message="This worktree is already open in another panel. Move the session to this panel?"
        confirmLabel="Move"
        cancelLabel="Cancel"
        onConfirm={handleConfirmMoveSession}
        onCancel={handleCancelMoveSession}
      />
      <FileReviewModal />
    </div>
  );
};

export default App;

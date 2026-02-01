import React, { useState, useEffect } from 'react';
import { GridLayout } from './components/layout/GridLayout';
import { SessionSidebar } from './components/sidebar/SessionSidebar';
import { NewSessionDialog } from './components/NewSessionDialog';
import { WelcomeScreen } from './components/WelcomeScreen';
import { StatusBar } from './components/StatusBar';
import { QuickSendDialog } from './components/messaging/QuickSendDialog';
import { ToastContainer } from './components/ui/Toast';
import { TitleBar } from './components/titlebar/TitleBar';
import { SettingsDialog } from './components/settings/SettingsDialog';
import { useLayoutStore } from './stores/layoutStore';
import { useProjectStore } from './stores/projectStore';
import { useMessagingStore } from './stores/messagingStore';
import { useSettingsStore } from './stores/settingsStore';
import type { SessionType } from '../shared/types/session';
import './components/messaging/QuickSendDialog.css';

const App: React.FC = () => {
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [pendingPanelId, setPendingPanelId] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);

  const currentProject = useProjectStore((state) => state.currentProject);
  const setProject = useProjectStore((state) => state.setProject);

  const { openQuickSend, setLastReceivedMessage, addRecentMessage } = useMessagingStore();

  const { settings, loadSettings, setSettings } = useSettingsStore();

  const {
    gridConfig,
    panels,
    activePanel,
    setSessionForPanel,
    setActivePanel,
    setGridDimensions,
    updateSession,
    removeSession,
    clearSessions,
    setLayout,
    getLayout,
    getAllPanels,
    findPanelBySessionId,
    getActiveSessionCount,
    findFirstEmptyPanel,
    getWorktreeAgent,
    setWorktreeAgent,
    loadWorktreeAgentPrefsFromBackend,
  } = useLayoutStore();

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Subscribe to settings updates
  useEffect(() => {
    const unsubscribe = window.terminalIDE.settings.onUpdated(({ settings }) => {
      setSettings(settings);
    });

    return () => {
      unsubscribe();
    };
  }, [setSettings]);

  // Load project state on mount
  useEffect(() => {
    let mounted = true;

    const loadProject = async () => {
      const project = await window.terminalIDE.project.getCurrent();
      if (mounted && project) {
        setProject(project);
      }
    };

    loadProject();

    return () => {
      mounted = false;
    };
  }, [setProject]);

  // Subscribe to project updates
  useEffect(() => {
    const unsubscribe = window.terminalIDE.project.onUpdated(({ project }) => {
      setProject(project);
    });

    return () => {
      unsubscribe();
    };
  }, [setProject]);

  // Sync sessions from backend on mount
  useEffect(() => {
    let mounted = true;

    const syncSessions = async () => {
      // Load worktree agent preferences from backend
      await loadWorktreeAgentPrefsFromBackend();

      // Get actual sessions from backend
      const backendSessions = await window.terminalIDE.session.list();

      if (!mounted) return;

      // Get settings for default grid config
      const currentSettings = await window.terminalIDE.settings.get();
      const defaultConfig = {
        rows: currentSettings.grid.defaultRows,
        cols: currentSettings.grid.defaultCols,
      };

      // Clear frontend state (resets to default grid from settings)
      clearSessions(defaultConfig);

      // Only restore layout if there are actual sessions
      if (backendSessions.length > 0) {
        for (const session of backendSessions) {
          updateSession(session);
        }

        // Restore layout structure
        const state = await window.terminalIDE.persistence.restore();
        if (mounted && state?.layout) {
          setLayout(state.layout);
        }
      }
      // If no sessions, we keep the empty grid from clearSessions()
    };

    syncSessions();

    return () => {
      mounted = false;
    };
  }, []);

  // Subscribe to session events
  useEffect(() => {
    const unsubscribeTerminated = window.terminalIDE.session.onTerminated(({ sessionId }) => {
      removeSession(sessionId);
    });

    const unsubscribeUpdated = window.terminalIDE.session.onUpdated(({ session }) => {
      updateSession(session);
    });

    return () => {
      unsubscribeTerminated();
      unsubscribeUpdated();
    };
  }, []);

  // Save layout when panels change (debounced) and periodically
  useEffect(() => {
    const saveLayout = () => {
      const layout = getLayout();
      window.terminalIDE.layout.save(layout);
    };

    // Debounced save for immediate changes
    let debounceTimer: NodeJS.Timeout | null = null;
    const debouncedSave = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(saveLayout, 500);
    };

    // Save when panels change
    debouncedSave();

    // Also save periodically as a fallback
    const interval = setInterval(saveLayout, 30000);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      clearInterval(interval);
    };
  }, [panels, gridConfig]);

  // Keyboard shortcuts for messaging and settings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+S: Open Quick Send Dialog
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        openQuickSend();
      }
      // Ctrl+Shift+B: Broadcast to all sessions
      if (e.ctrlKey && e.shiftKey && e.key === 'B') {
        e.preventDefault();
        openQuickSend();
        // The dialog will handle broadcast mode
      }
      // Ctrl+Shift+V: Paste from shared clipboard
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        handlePasteSharedClipboard();
      }
      // Ctrl+,: Open Settings
      if (e.ctrlKey && !e.shiftKey && e.key === ',') {
        e.preventDefault();
        setSettingsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openQuickSend, activePanel, panels]);

  // Subscribe to messaging events
  useEffect(() => {
    const unsubscribeSent = window.terminalIDE.messaging.onSent(({ message }) => {
      addRecentMessage(message);
    });

    const unsubscribeReceived = window.terminalIDE.messaging.onReceived(({ message, targetSessionId }) => {
      setLastReceivedMessage(targetSessionId);
    });

    return () => {
      unsubscribeSent();
      unsubscribeReceived();
    };
  }, [addRecentMessage, setLastReceivedMessage]);

  // Paste from shared clipboard
  const handlePasteSharedClipboard = async () => {
    const clipboard = await window.terminalIDE.messaging.getClipboard();
    if (!clipboard) {
      console.log('Shared clipboard is empty');
      return;
    }

    // Get the active session
    const activePanel_data = panels.find(p => p.id === activePanel);
    const activeSessionId = activePanel_data?.sessionId;

    if (!activeSessionId) {
      console.log('No active session to paste into');
      return;
    }

    // Write clipboard content to active session
    await window.terminalIDE.session.write(activeSessionId, clipboard.content);
  };

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
    // Check for saved agent preference for this worktree
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
    </div>
  );
};

export default App;

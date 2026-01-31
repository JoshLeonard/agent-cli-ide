import React, { useState, useEffect, useRef } from 'react';
import { PaneGrid } from './components/layout/PaneGrid';
import { SessionSidebar } from './components/sidebar/SessionSidebar';
import { NewSessionDialog } from './components/NewSessionDialog';
import { WelcomeScreen } from './components/WelcomeScreen';
import { StatusBar } from './components/StatusBar';
import { useLayoutStore } from './stores/layoutStore';
import { useProjectStore } from './stores/projectStore';
import type { SessionType } from '../shared/types/session';

const App: React.FC = () => {
  const [isDialogOpen, setDialogOpen] = useState(false);
  const pendingPaneIdRef = useRef<string | null>(null);

  const currentProject = useProjectStore((state) => state.currentProject);
  const setProject = useProjectStore((state) => state.setProject);

  const {
    panes,
    addPane,
    removePane,
    setSessionForPane,
    setActivePane,
    updateSession,
    removeSession,
    clearSessions,
    setLayout,
    getLayout,
    activePane,
  } = useLayoutStore();

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
      // Get actual sessions from backend
      const backendSessions = await window.terminalIDE.session.list();

      if (!mounted) return;

      // Clear frontend state and populate with actual backend sessions
      clearSessions();
      for (const session of backendSessions) {
        updateSession(session);
      }

      // Now restore layout
      const state = await window.terminalIDE.persistence.restore();
      if (!mounted || !state) return;

      // Only restore layout structure, not sessions
      // Sessions will be recreated fresh
      setLayout({
        panes: state.layout.panes.map(p => ({ ...p, sessionId: undefined })),
        rows: state.layout.rows,
        cols: state.layout.cols,
      });
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

  // Save layout periodically
  useEffect(() => {
    const saveLayout = () => {
      const layout = getLayout();
      window.terminalIDE.layout.save(layout);
    };

    const interval = setInterval(saveLayout, 30000);
    window.addEventListener('beforeunload', saveLayout);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', saveLayout);
    };
  }, []);

  const handleCreateSession = async (config: { type: SessionType; cwd: string; branch?: string }) => {
    // Default cwd to project path if not specified or empty
    const sessionConfig = {
      ...config,
      cwd: config.cwd || currentProject?.path || process.cwd(),
    };
    const result = await window.terminalIDE.session.create(sessionConfig);

    if (result.success && result.session) {
      let paneId = pendingPaneIdRef.current;

      if (!paneId) {
        paneId = addPane();
      }

      setSessionForPane(paneId, result.session.id);
      updateSession(result.session);
      pendingPaneIdRef.current = null;
    } else {
      console.error('Failed to create session:', result.error);
    }
  };

  const handleNewSession = () => {
    pendingPaneIdRef.current = null;
    setDialogOpen(true);
  };

  const handleCreateSessionForPane = (paneId: string) => {
    pendingPaneIdRef.current = paneId;
    setDialogOpen(true);
  };

  const handleTerminateSession = async (sessionId?: string) => {
    const targetSessionId = sessionId || (() => {
      if (!activePane) return null;
      const pane = panes.find((p) => p.id === activePane);
      return pane?.sessionId || null;
    })();

    if (!targetSessionId) return;

    const result = await window.terminalIDE.session.terminate(targetSessionId);
    if (result.success) {
      removeSession(targetSessionId);
    }
  };

  const handleSelectSession = (sessionId: string) => {
    // Find the pane that has this session and make it active
    const pane = panes.find(p => p.sessionId === sessionId);
    if (pane) {
      setActivePane(pane.id);
    }
  };

  const handleClosePane = () => {
    if (!activePane) return;

    const pane = panes.find((p) => p.id === activePane);
    if (pane?.sessionId) {
      // Terminate the session when closing the pane
      window.terminalIDE.session.terminate(pane.sessionId);
      removeSession(pane.sessionId);
    }
    removePane(activePane);
  };

  const handleSplitHorizontal = () => {
    useLayoutStore.setState((state) => ({
      cols: Math.min(state.cols + 1, 4),
    }));
    addPane();
  };

  const handleSplitVertical = () => {
    useLayoutStore.setState((state) => ({
      rows: Math.min(state.rows + 1, 4),
    }));
    addPane();
  };

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
      <div className="toolbar">
        <span className="toolbar-title">Terminal IDE</span>
        <button onClick={handleNewSession}>New Session</button>
        <button onClick={handleSplitHorizontal}>Split H</button>
        <button onClick={handleSplitVertical}>Split V</button>
        {activePane && (
          <>
            <button onClick={() => handleTerminateSession()}>Terminate</button>
            <button onClick={handleClosePane}>Close Pane</button>
          </>
        )}
      </div>

      <div className="main-container">
        <SessionSidebar
          onSelectSession={handleSelectSession}
          onTerminateSession={handleTerminateSession}
        />
        <div className="main-content">
          <PaneGrid onCreateSession={handleCreateSessionForPane} />
        </div>
      </div>

      <StatusBar />

      <NewSessionDialog
        isOpen={isDialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleCreateSession}
      />
    </div>
  );
};

export default App;

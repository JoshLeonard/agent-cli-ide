import React, { useState, useEffect } from 'react';
import { GridLayout } from './components/layout/GridLayout';
import { SessionSidebar } from './components/sidebar/SessionSidebar';
import { NewSessionDialog } from './components/NewSessionDialog';
import { WelcomeScreen } from './components/WelcomeScreen';
import { StatusBar } from './components/StatusBar';
import { QuickSendDialog } from './components/messaging/QuickSendDialog';
import { useLayoutStore } from './stores/layoutStore';
import { useProjectStore } from './stores/projectStore';
import { useMessagingStore } from './stores/messagingStore';
import './components/messaging/QuickSendDialog.css';
// Grid preset options
const GRID_PRESETS = [
    { label: '1×1', rows: 1, cols: 1 },
    { label: '1×2', rows: 1, cols: 2 },
    { label: '2×2', rows: 2, cols: 2 },
    { label: '2×3', rows: 2, cols: 3 },
    { label: '2×4', rows: 2, cols: 4 },
    { label: '2×5', rows: 2, cols: 5 },
    { label: '3×3', rows: 3, cols: 3 },
];
const App = () => {
    const [isDialogOpen, setDialogOpen] = useState(false);
    const [pendingPanelId, setPendingPanelId] = useState(null);
    const [isGridDropdownOpen, setGridDropdownOpen] = useState(false);
    const currentProject = useProjectStore((state) => state.currentProject);
    const setProject = useProjectStore((state) => state.setProject);
    const { openQuickSend, setLastReceivedMessage, addRecentMessage } = useMessagingStore();
    const { gridConfig, panels, activePanel, setSessionForPanel, setActivePanel, setGridDimensions, updateSession, removeSession, clearSessions, setLayout, getLayout, getAllPanels, findPanelBySessionId, getActiveSessionCount, findFirstEmptyPanel, getWorktreeAgent, setWorktreeAgent, } = useLayoutStore();
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
            if (!mounted)
                return;
            // Clear frontend state (resets to default grid)
            clearSessions();
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
    // Close dropdown when clicking outside
    useEffect(() => {
        if (!isGridDropdownOpen)
            return;
        const handleClick = () => setGridDropdownOpen(false);
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, [isGridDropdownOpen]);
    // Keyboard shortcuts for messaging
    useEffect(() => {
        const handleKeyDown = (e) => {
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
    const handleCreateSession = async (config) => {
        const sessionConfig = {
            ...config,
            cwd: config.cwd || currentProject?.path || process.cwd(),
        };
        const result = await window.terminalIDE.session.create(sessionConfig);
        if (result.success && result.session) {
            let targetPanelId = null;
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
            }
            else {
                setSessionForPanel(targetPanelId, result.session.id);
                updateSession(result.session);
            }
            setPendingPanelId(null);
        }
        else {
            console.error('Failed to create session:', result.error);
        }
    };
    const handleCreateSessionForPanel = (panelId) => {
        setPendingPanelId(panelId);
        setDialogOpen(true);
    };
    const handleTerminateSession = async (sessionId) => {
        const targetSessionId = sessionId || (() => {
            // Find active session from active panel
            const panel = panels.find((p) => p.id === activePanel);
            return panel?.sessionId || null;
        })();
        if (!targetSessionId)
            return;
        const result = await window.terminalIDE.session.terminate(targetSessionId);
        if (result.success) {
            removeSession(targetSessionId);
        }
    };
    const handleSelectSession = (sessionId) => {
        const panelId = findPanelBySessionId(sessionId);
        if (panelId) {
            setActivePanel(panelId);
        }
    };
    const handleGridPresetChange = (rows, cols) => {
        setGridDimensions(rows, cols);
    };
    const handleWorktreeDrop = async (panelId, worktreeData) => {
        // Check for saved agent preference for this worktree
        const savedAgentId = getWorktreeAgent(worktreeData.path);
        let agentId = savedAgentId;
        // Fallback to default agent if no preference saved
        if (!agentId) {
            const defaultAgent = await window.terminalIDE.agent.getDefault();
            agentId = defaultAgent?.id;
        }
        const config = {
            type: 'attached',
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
        }
        else {
            console.error('Failed to create session from worktree drop:', result.error);
        }
    };
    const activeSessionCount = getActiveSessionCount();
    // Show welcome screen if no project is open
    if (!currentProject) {
        return (<div className="app">
        <WelcomeScreen />
      </div>);
    }
    return (<div className="app">
      <div className="toolbar">
        <span className="toolbar-title">Terminal IDE</span>

        <div className="grid-selector" onClick={(e) => e.stopPropagation()}>
          <button className="grid-selector-button" onClick={() => setGridDropdownOpen(!isGridDropdownOpen)}>
            Grid: {gridConfig.rows}×{gridConfig.cols} ▼
          </button>
          {isGridDropdownOpen && (<div className="grid-selector-dropdown">
              {GRID_PRESETS.map((preset) => {
                const totalCells = preset.rows * preset.cols;
                const isDisabled = totalCells < activeSessionCount;
                const isSelected = preset.rows === gridConfig.rows && preset.cols === gridConfig.cols;
                return (<button key={preset.label} className={`grid-selector-option ${isSelected ? 'selected' : ''}`} disabled={isDisabled} onClick={() => {
                        handleGridPresetChange(preset.rows, preset.cols);
                        setGridDropdownOpen(false);
                    }} title={isDisabled ? `Cannot shrink: ${activeSessionCount} active sessions` : ''}>
                    {preset.label}
                    {isSelected && ' ✓'}
                  </button>);
            })}
            </div>)}
        </div>

        {activePanel && panels.find(p => p.id === activePanel)?.sessionId && (<button onClick={() => handleTerminateSession()}>Terminate</button>)}
      </div>

      <div className="main-container">
        <SessionSidebar onSelectSession={handleSelectSession} onTerminateSession={handleTerminateSession}/>
        <div className="main-content">
          <GridLayout panels={panels} config={gridConfig} activePanel={activePanel} onCreateSession={handleCreateSessionForPanel} onWorktreeDrop={handleWorktreeDrop}/>
        </div>
      </div>

      <StatusBar />

      <NewSessionDialog isOpen={isDialogOpen} onClose={() => setDialogOpen(false)} onSubmit={handleCreateSession}/>

      <QuickSendDialog />
    </div>);
};
export default App;
//# sourceMappingURL=App.js.map
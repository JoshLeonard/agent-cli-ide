import { create } from 'zustand';
import { isGridLayoutState, isTreeLayoutState, isTerminalPanel } from '../../shared/types/layout';
// Default grid configuration
const DEFAULT_GRID_CONFIG = {
    rows: 2,
    cols: 5,
};
// Helper to generate unique IDs
let idCounter = 0;
const generateId = (prefix) => `${prefix}-${++idCounter}-${Date.now()}`;
// Create a default empty panel
const createEmptyPanel = () => ({
    type: 'panel',
    id: generateId('panel'),
    sessionId: null,
});
// Create initial grid panels
const createGridPanels = (config) => {
    const panels = [];
    const count = config.rows * config.cols;
    for (let i = 0; i < count; i++) {
        panels.push(createEmptyPanel());
    }
    return panels;
};
// Helper to collect panels from legacy tree structure
function collectPanelsFromTree(node) {
    if (isTerminalPanel(node)) {
        return [node];
    }
    return node.children.flatMap(collectPanelsFromTree);
}
// Load worktree agent preferences from localStorage
const loadWorktreeAgentPrefs = () => {
    try {
        const stored = localStorage.getItem('worktreeAgentPrefs');
        if (stored) {
            return new Map(JSON.parse(stored));
        }
    }
    catch {
        // Ignore parse errors
    }
    return new Map();
};
// Save worktree agent preferences to localStorage
const saveWorktreeAgentPrefs = (prefs) => {
    try {
        localStorage.setItem('worktreeAgentPrefs', JSON.stringify(Array.from(prefs.entries())));
    }
    catch {
        // Ignore storage errors
    }
};
export const useLayoutStore = create((set, get) => ({
    gridConfig: DEFAULT_GRID_CONFIG,
    panels: createGridPanels(DEFAULT_GRID_CONFIG),
    activePanel: null,
    sessions: new Map(),
    agentStatuses: new Map(),
    worktreeAgentPrefs: loadWorktreeAgentPrefs(),
    setGridDimensions: (rows, cols) => {
        const state = get();
        const newCount = rows * cols;
        const activeCount = state.panels.filter(p => p.sessionId !== null).length;
        // Prevent shrinking below active session count
        if (newCount < activeCount) {
            return false;
        }
        const newConfig = { rows, cols };
        let newPanels;
        if (newCount > state.panels.length) {
            // Growing: keep existing panels and add new empty ones
            newPanels = [...state.panels];
            while (newPanels.length < newCount) {
                newPanels.push(createEmptyPanel());
            }
        }
        else if (newCount < state.panels.length) {
            // Shrinking: collect active sessions and redistribute
            const activePanels = state.panels.filter(p => p.sessionId !== null);
            const emptyNeeded = newCount - activePanels.length;
            newPanels = [...activePanels];
            for (let i = 0; i < emptyNeeded; i++) {
                newPanels.push(createEmptyPanel());
            }
        }
        else {
            // Same count, just update config
            newPanels = state.panels;
        }
        set({ gridConfig: newConfig, panels: newPanels });
        return true;
    },
    initializeGrid: (config) => {
        set({
            gridConfig: config,
            panels: createGridPanels(config),
            activePanel: null,
        });
    },
    clearPanelSession: (panelId) => {
        set((state) => {
            const panel = state.panels.find(p => p.id === panelId);
            if (panel?.sessionId) {
                window.terminalIDE.session.terminate(panel.sessionId);
            }
            const newPanels = state.panels.map(p => p.id === panelId ? { ...p, sessionId: null } : p);
            return { panels: newPanels };
        });
    },
    setSessionForPanel: (panelId, sessionId) => {
        set((state) => {
            const newPanels = state.panels.map(p => p.id === panelId ? { ...p, sessionId } : p);
            return { panels: newPanels, activePanel: panelId };
        });
    },
    setActivePanel: (panelId) => {
        set({ activePanel: panelId });
    },
    updateSession: (session) => {
        set((state) => {
            const newSessions = new Map(state.sessions);
            newSessions.set(session.id, session);
            return { sessions: newSessions };
        });
    },
    removeSession: (sessionId) => {
        set((state) => {
            const newSessions = new Map(state.sessions);
            newSessions.delete(sessionId);
            // Also remove agent status
            const newStatuses = new Map(state.agentStatuses);
            newStatuses.delete(sessionId);
            // Find panel with this session and clear its sessionId
            const newPanels = state.panels.map(p => p.sessionId === sessionId ? { ...p, sessionId: null } : p);
            return { sessions: newSessions, agentStatuses: newStatuses, panels: newPanels };
        });
    },
    clearSessions: () => {
        set((state) => ({
            sessions: new Map(),
            panels: createGridPanels(state.gridConfig),
            activePanel: null,
        }));
    },
    setSessions: (sessions) => {
        const sessionMap = new Map();
        sessions.forEach((s) => sessionMap.set(s.id, s));
        set({ sessions: sessionMap });
    },
    updateAgentStatus: (status) => {
        set((state) => {
            const newStatuses = new Map(state.agentStatuses);
            newStatuses.set(status.sessionId, status);
            return { agentStatuses: newStatuses };
        });
    },
    removeAgentStatus: (sessionId) => {
        set((state) => {
            const newStatuses = new Map(state.agentStatuses);
            newStatuses.delete(sessionId);
            return { agentStatuses: newStatuses };
        });
    },
    getAgentStatus: (sessionId) => {
        return get().agentStatuses.get(sessionId);
    },
    findPanelBySessionId: (sessionId) => {
        const panel = get().panels.find(p => p.sessionId === sessionId);
        return panel?.id || null;
    },
    findPanelById: (panelId) => {
        return get().panels.find(p => p.id === panelId) || null;
    },
    getLayout: () => {
        const state = get();
        return {
            version: 3,
            config: state.gridConfig,
            panels: state.panels,
        };
    },
    setLayout: (layout) => {
        if (isGridLayoutState(layout)) {
            // New grid format
            set({
                gridConfig: layout.config,
                panels: layout.panels,
            });
        }
        else if (isTreeLayoutState(layout)) {
            // Migrate from tree layout (version 2)
            const treePanels = collectPanelsFromTree(layout.root);
            const activePanels = treePanels.filter(p => p.sessionId !== null);
            // Create a grid that fits all active sessions
            const config = { ...DEFAULT_GRID_CONFIG };
            const totalCells = config.rows * config.cols;
            // Create new panels array
            const newPanels = [];
            // First, add panels with active sessions
            for (const panel of activePanels) {
                newPanels.push({ ...panel, id: generateId('panel') });
            }
            // Fill remaining cells with empty panels
            while (newPanels.length < totalCells) {
                newPanels.push(createEmptyPanel());
            }
            set({ gridConfig: config, panels: newPanels });
        }
        else {
            // Migrate from legacy grid layout (version 1)
            const sessionsWithPanes = layout.panes.filter(p => p.sessionId);
            const config = { ...DEFAULT_GRID_CONFIG };
            const totalCells = config.rows * config.cols;
            const newPanels = [];
            for (const pane of sessionsWithPanes) {
                newPanels.push({
                    type: 'panel',
                    id: generateId('panel'),
                    sessionId: pane.sessionId || null,
                });
            }
            while (newPanels.length < totalCells) {
                newPanels.push(createEmptyPanel());
            }
            set({ gridConfig: config, panels: newPanels });
        }
    },
    getAllPanels: () => {
        return get().panels;
    },
    getActiveSessionCount: () => {
        return get().panels.filter(p => p.sessionId !== null).length;
    },
    findFirstEmptyPanel: () => {
        return get().panels.find(p => p.sessionId === null) || null;
    },
    getWorktreeAgent: (worktreePath) => {
        return get().worktreeAgentPrefs.get(worktreePath);
    },
    setWorktreeAgent: (worktreePath, agentId) => {
        set((state) => {
            const newPrefs = new Map(state.worktreeAgentPrefs);
            newPrefs.set(worktreePath, agentId);
            saveWorktreeAgentPrefs(newPrefs);
            return { worktreeAgentPrefs: newPrefs };
        });
    },
}));
//# sourceMappingURL=layoutStore.js.map
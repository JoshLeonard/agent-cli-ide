import { create } from 'zustand';
import type { SessionInfo } from '../../shared/types/session';
import type {
  GridConfig,
  TerminalPanel,
  GridLayoutState,
  PersistedLayoutState,
  LayoutNode,
} from '../../shared/types/layout';
import { isGridLayoutState, isTreeLayoutState, isTerminalPanel } from '../../shared/types/layout';
import type { AgentStatus } from '../../shared/types/agentStatus';

// Default grid configuration
const DEFAULT_GRID_CONFIG: GridConfig = {
  rows: 2,
  cols: 5,
};

// Helper to generate unique IDs
let idCounter = 0;
const generateId = (prefix: string) => `${prefix}-${++idCounter}-${Date.now()}`;

// Create a default empty panel
const createEmptyPanel = (): TerminalPanel => ({
  type: 'panel',
  id: generateId('panel'),
  sessionId: null,
});

// Create initial grid panels
const createGridPanels = (config: GridConfig): TerminalPanel[] => {
  const panels: TerminalPanel[] = [];
  const count = config.rows * config.cols;
  for (let i = 0; i < count; i++) {
    panels.push(createEmptyPanel());
  }
  return panels;
};

interface LayoutStore {
  gridConfig: GridConfig;
  panels: TerminalPanel[];
  activePanel: string | null;
  sessions: Map<string, SessionInfo>;
  agentStatuses: Map<string, AgentStatus>;
  worktreeAgentPrefs: Map<string, string>; // worktreePath → agentId

  // Grid operations
  setGridDimensions: (rows: number, cols: number) => boolean;
  initializeGrid: (config: GridConfig) => void;

  // Panel operations
  clearPanelSession: (panelId: string) => void;

  // Session-to-panel assignment
  setSessionForPanel: (panelId: string, sessionId: string) => void;

  // Panel activation
  setActivePanel: (panelId: string | null) => void;

  // Session management
  updateSession: (session: SessionInfo) => void;
  removeSession: (sessionId: string) => void;
  clearSessions: () => void;
  setSessions: (sessions: SessionInfo[]) => void;

  // Agent status management
  updateAgentStatus: (status: AgentStatus) => void;
  removeAgentStatus: (sessionId: string) => void;
  getAgentStatus: (sessionId: string) => AgentStatus | undefined;

  // Utilities
  findPanelBySessionId: (sessionId: string) => string | null;
  findPanelById: (panelId: string) => TerminalPanel | null;
  getLayout: () => GridLayoutState;
  setLayout: (layout: PersistedLayoutState) => void;
  getAllPanels: () => TerminalPanel[];
  getActiveSessionCount: () => number;
  findFirstEmptyPanel: () => TerminalPanel | null;

  // Worktree agent preferences
  getWorktreeAgent: (worktreePath: string) => string | undefined;
  setWorktreeAgent: (worktreePath: string, agentId: string) => void;
}

// Helper to collect panels from legacy tree structure
function collectPanelsFromTree(node: LayoutNode): TerminalPanel[] {
  if (isTerminalPanel(node)) {
    return [node];
  }
  return node.children.flatMap(collectPanelsFromTree);
}

// Load worktree agent preferences from localStorage
const loadWorktreeAgentPrefs = (): Map<string, string> => {
  try {
    const stored = localStorage.getItem('worktreeAgentPrefs');
    if (stored) {
      return new Map(JSON.parse(stored));
    }
  } catch {
    // Ignore parse errors
  }
  return new Map();
};

// Save worktree agent preferences to localStorage
const saveWorktreeAgentPrefs = (prefs: Map<string, string>) => {
  try {
    localStorage.setItem('worktreeAgentPrefs', JSON.stringify(Array.from(prefs.entries())));
  } catch {
    // Ignore storage errors
  }
};

export const useLayoutStore = create<LayoutStore>((set, get) => ({
  gridConfig: DEFAULT_GRID_CONFIG,
  panels: createGridPanels(DEFAULT_GRID_CONFIG),
  activePanel: null,
  sessions: new Map(),
  agentStatuses: new Map(),
  worktreeAgentPrefs: loadWorktreeAgentPrefs(),

  setGridDimensions: (rows: number, cols: number) => {
    const state = get();
    const newCount = rows * cols;
    const activeCount = state.panels.filter(p => p.sessionId !== null).length;

    // Prevent shrinking below active session count
    if (newCount < activeCount) {
      return false;
    }

    const newConfig: GridConfig = { rows, cols };
    let newPanels: TerminalPanel[];

    if (newCount > state.panels.length) {
      // Growing: keep existing panels and add new empty ones
      newPanels = [...state.panels];
      while (newPanels.length < newCount) {
        newPanels.push(createEmptyPanel());
      }
    } else if (newCount < state.panels.length) {
      // Shrinking: collect active sessions and redistribute
      const activePanels = state.panels.filter(p => p.sessionId !== null);
      const emptyNeeded = newCount - activePanels.length;
      newPanels = [...activePanels];
      for (let i = 0; i < emptyNeeded; i++) {
        newPanels.push(createEmptyPanel());
      }
    } else {
      // Same count, just update config
      newPanels = state.panels;
    }

    set({ gridConfig: newConfig, panels: newPanels });
    return true;
  },

  initializeGrid: (config: GridConfig) => {
    set({
      gridConfig: config,
      panels: createGridPanels(config),
      activePanel: null,
    });
  },

  clearPanelSession: (panelId: string) => {
    set((state) => {
      const panel = state.panels.find(p => p.id === panelId);
      if (panel?.sessionId) {
        window.terminalIDE.session.terminate(panel.sessionId);
      }

      const newPanels = state.panels.map(p =>
        p.id === panelId ? { ...p, sessionId: null } : p
      );

      return { panels: newPanels };
    });
  },

  setSessionForPanel: (panelId: string, sessionId: string) => {
    set((state) => {
      const newPanels = state.panels.map(p =>
        p.id === panelId ? { ...p, sessionId } : p
      );

      return { panels: newPanels, activePanel: panelId };
    });
  },

  setActivePanel: (panelId: string | null) => {
    set({ activePanel: panelId });
  },

  updateSession: (session: SessionInfo) => {
    set((state) => {
      const newSessions = new Map(state.sessions);
      newSessions.set(session.id, session);
      return { sessions: newSessions };
    });
  },

  removeSession: (sessionId: string) => {
    set((state) => {
      const newSessions = new Map(state.sessions);
      newSessions.delete(sessionId);

      // Also remove agent status
      const newStatuses = new Map(state.agentStatuses);
      newStatuses.delete(sessionId);

      // Find panel with this session and clear its sessionId
      const newPanels = state.panels.map(p =>
        p.sessionId === sessionId ? { ...p, sessionId: null } : p
      );

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

  setSessions: (sessions: SessionInfo[]) => {
    const sessionMap = new Map<string, SessionInfo>();
    sessions.forEach((s) => sessionMap.set(s.id, s));
    set({ sessions: sessionMap });
  },

  updateAgentStatus: (status: AgentStatus) => {
    set((state) => {
      const newStatuses = new Map(state.agentStatuses);
      newStatuses.set(status.sessionId, status);
      return { agentStatuses: newStatuses };
    });
  },

  removeAgentStatus: (sessionId: string) => {
    set((state) => {
      const newStatuses = new Map(state.agentStatuses);
      newStatuses.delete(sessionId);
      return { agentStatuses: newStatuses };
    });
  },

  getAgentStatus: (sessionId: string) => {
    return get().agentStatuses.get(sessionId);
  },

  findPanelBySessionId: (sessionId: string) => {
    const panel = get().panels.find(p => p.sessionId === sessionId);
    return panel?.id || null;
  },

  findPanelById: (panelId: string) => {
    return get().panels.find(p => p.id === panelId) || null;
  },

  getLayout: (): GridLayoutState => {
    const state = get();
    return {
      version: 3,
      config: state.gridConfig,
      panels: state.panels,
    };
  },

  setLayout: (layout: PersistedLayoutState) => {
    if (isGridLayoutState(layout)) {
      // New grid format
      set({
        gridConfig: layout.config,
        panels: layout.panels,
      });
    } else if (isTreeLayoutState(layout)) {
      // Migrate from tree layout (version 2)
      const treePanels = collectPanelsFromTree(layout.root);
      const activePanels = treePanels.filter(p => p.sessionId !== null);

      // Create a grid that fits all active sessions
      const config = { ...DEFAULT_GRID_CONFIG };
      const totalCells = config.rows * config.cols;

      // Create new panels array
      const newPanels: TerminalPanel[] = [];

      // First, add panels with active sessions
      for (const panel of activePanels) {
        newPanels.push({ ...panel, id: generateId('panel') });
      }

      // Fill remaining cells with empty panels
      while (newPanels.length < totalCells) {
        newPanels.push(createEmptyPanel());
      }

      set({ gridConfig: config, panels: newPanels });
    } else {
      // Migrate from legacy grid layout (version 1)
      const sessionsWithPanes = layout.panes.filter(p => p.sessionId);
      const config = { ...DEFAULT_GRID_CONFIG };
      const totalCells = config.rows * config.cols;

      const newPanels: TerminalPanel[] = [];

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

  getWorktreeAgent: (worktreePath: string) => {
    return get().worktreeAgentPrefs.get(worktreePath);
  },

  setWorktreeAgent: (worktreePath: string, agentId: string) => {
    set((state) => {
      const newPrefs = new Map(state.worktreeAgentPrefs);
      newPrefs.set(worktreePath, agentId);
      saveWorktreeAgentPrefs(newPrefs);
      return { worktreeAgentPrefs: newPrefs };
    });
  },
}));

import { create } from 'zustand';
import type { LayoutPane, LayoutState, SessionInfo } from '../../shared/types/session';

interface LayoutStore {
  panes: LayoutPane[];
  rows: number;
  cols: number;
  rowSizes: number[];
  colSizes: number[];
  sessions: Map<string, SessionInfo>;
  activePane: string | null;
  paneIdCounter: number;

  // Actions
  addPane: (sessionId?: string) => string;
  removePane: (paneId: string) => void;
  setSessionForPane: (paneId: string, sessionId: string) => void;
  setActivePane: (paneId: string | null) => void;
  updateSession: (session: SessionInfo) => void;
  removeSession: (sessionId: string) => void;
  clearSessions: () => void;
  setLayout: (layout: LayoutState) => void;
  getLayout: () => LayoutState;
  setSessions: (sessions: SessionInfo[]) => void;
  setRowSizes: (sizes: number[]) => void;
  setColSizes: (sizes: number[]) => void;
}

export const useLayoutStore = create<LayoutStore>((set, get) => ({
  panes: [],
  rows: 1,
  cols: 1,
  rowSizes: [1],
  colSizes: [1],
  sessions: new Map(),
  activePane: null,
  paneIdCounter: 0,

  addPane: (sessionId?: string) => {
    const state = get();
    const newCounter = state.paneIdCounter + 1;
    const id = `pane-${newCounter}-${Date.now()}`;
    const { panes, cols, rows, rowSizes, colSizes } = state;

    // Calculate position for new pane
    let row = 0;
    let col = 0;

    if (panes.length > 0) {
      // Simple layout: fill row by row
      const panesPerRow = cols;
      const index = panes.length;
      row = Math.floor(index / panesPerRow);
      col = index % panesPerRow;
    }

    const newPane: LayoutPane = {
      id,
      sessionId,
      row,
      col,
    };

    // Update rows if needed
    const newRows = row >= rows ? row + 1 : rows;

    // Extend row sizes if new row added
    let newRowSizes = rowSizes;
    if (newRows > rows) {
      // Redistribute sizes equally when adding a new row
      const equalSize = 1 / newRows;
      newRowSizes = Array(newRows).fill(equalSize);
    }

    set({
      panes: [...panes, newPane],
      activePane: id,
      paneIdCounter: newCounter,
      rows: newRows,
      rowSizes: newRowSizes,
    });

    return id;
  },

  removePane: (paneId: string) => {
    set((state) => {
      const newPanes = state.panes.filter((p) => p.id !== paneId);
      return {
        panes: newPanes,
        activePane: state.activePane === paneId
          ? (newPanes[0]?.id || null)
          : state.activePane,
      };
    });
  },

  setSessionForPane: (paneId: string, sessionId: string) => {
    set((state) => {
      // Check if pane exists
      const paneExists = state.panes.some(p => p.id === paneId);
      if (!paneExists) {
        console.warn(`setSessionForPane: pane ${paneId} not found`);
        return state;
      }

      return {
        panes: state.panes.map((p) =>
          p.id === paneId ? { ...p, sessionId } : p
        ),
      };
    });
  },

  setActivePane: (paneId: string | null) => {
    set({ activePane: paneId });
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
      return {
        sessions: newSessions,
        panes: state.panes.map((p) =>
          p.sessionId === sessionId ? { ...p, sessionId: undefined } : p
        ),
      };
    });
  },

  clearSessions: () => {
    set((state) => ({
      sessions: new Map(),
      panes: state.panes.map((p) => ({ ...p, sessionId: undefined })),
    }));
  },

  setLayout: (layout: LayoutState) => {
    // Backward compatibility: default to equal sizing if sizes missing
    const rowSizes = layout.rowSizes && layout.rowSizes.length === layout.rows
      ? layout.rowSizes
      : Array(layout.rows).fill(1 / layout.rows);
    const colSizes = layout.colSizes && layout.colSizes.length === layout.cols
      ? layout.colSizes
      : Array(layout.cols).fill(1 / layout.cols);

    set({
      panes: layout.panes,
      rows: layout.rows,
      cols: layout.cols,
      rowSizes,
      colSizes,
    });
  },

  getLayout: () => {
    const { panes, rows, cols, rowSizes, colSizes } = get();
    return { panes, rows, cols, rowSizes, colSizes };
  },

  setSessions: (sessions: SessionInfo[]) => {
    const sessionMap = new Map<string, SessionInfo>();
    sessions.forEach((s) => sessionMap.set(s.id, s));
    set({ sessions: sessionMap });
  },

  setRowSizes: (sizes: number[]) => {
    set({ rowSizes: sizes });
  },

  setColSizes: (sizes: number[]) => {
    set({ colSizes: sizes });
  },
}));

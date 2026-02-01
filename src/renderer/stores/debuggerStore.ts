import { create } from 'zustand';
import type {
  DebugSessionInfo,
  DebugSessionState,
  DebugConsoleMessage,
  DebugException,
  StackFrame,
} from '../../shared/types/debug';

interface DebuggerStore {
  sessions: Map<string, DebugSessionInfo>;
  consoleMessages: DebugConsoleMessage[];
  exceptions: DebugException[];

  // Selected session for UI
  selectedSessionId: string | null;

  // Filter state
  filterLevels: DebugConsoleMessage['level'][] | null;
  filterSessionIds: string[] | null;

  // Actions
  addSession: (session: DebugSessionInfo) => void;
  removeSession: (sessionId: string) => void;
  updateSessionState: (sessionId: string, state: DebugSessionState, pausedAt?: DebugSessionInfo['pausedAt'], callStack?: StackFrame[]) => void;
  addConsoleMessage: (message: DebugConsoleMessage) => void;
  addException: (exception: DebugException) => void;
  selectSession: (sessionId: string | null) => void;
  clearMessages: (sessionId?: string) => void;

  // Filter actions
  setFilterLevels: (levels: DebugConsoleMessage['level'][] | null) => void;
  setFilterSessionIds: (sessionIds: string[] | null) => void;
  clearFilters: () => void;

  // Computed
  getFilteredMessages: () => DebugConsoleMessage[];
  getSession: (sessionId: string) => DebugSessionInfo | undefined;

  // Initialize subscriptions
  initializeSubscriptions: () => () => void;
}

// Maximum messages/exceptions to keep in memory
const MAX_MESSAGES = 500;
const MAX_EXCEPTIONS = 100;

export const useDebuggerStore = create<DebuggerStore>((set, get) => ({
  sessions: new Map(),
  consoleMessages: [],
  exceptions: [],
  selectedSessionId: null,
  filterLevels: null,
  filterSessionIds: null,

  addSession: (session) => {
    set((state) => {
      const sessions = new Map(state.sessions);
      sessions.set(session.id, session);
      // Auto-select newly added session
      return { sessions, selectedSessionId: session.id };
    });
  },

  removeSession: (sessionId) => {
    set((state) => {
      const sessions = new Map(state.sessions);
      sessions.delete(sessionId);
      const selectedSessionId = state.selectedSessionId === sessionId ? null : state.selectedSessionId;
      return { sessions, selectedSessionId };
    });
  },

  updateSessionState: (sessionId, newState, pausedAt, callStack) => {
    set((state) => {
      const sessions = new Map(state.sessions);
      const session = sessions.get(sessionId);
      if (session) {
        sessions.set(sessionId, {
          ...session,
          state: newState,
          pausedAt,
          callStack: callStack || session.callStack,
        });
      }
      return { sessions };
    });
  },

  addConsoleMessage: (message) => {
    set((state) => {
      const messages = [...state.consoleMessages, message];
      // Keep last MAX_MESSAGES
      if (messages.length > MAX_MESSAGES) {
        messages.splice(0, messages.length - MAX_MESSAGES);
      }
      return { consoleMessages: messages };
    });
  },

  addException: (exception) => {
    set((state) => {
      const exceptions = [...state.exceptions, exception];
      if (exceptions.length > MAX_EXCEPTIONS) {
        exceptions.splice(0, exceptions.length - MAX_EXCEPTIONS);
      }
      return { exceptions };
    });
  },

  selectSession: (sessionId) => {
    set({ selectedSessionId: sessionId });
  },

  clearMessages: (sessionId) => {
    set((state) => {
      if (sessionId) {
        return {
          consoleMessages: state.consoleMessages.filter(m => m.sessionId !== sessionId),
          exceptions: state.exceptions.filter(e => e.sessionId !== sessionId),
        };
      }
      return { consoleMessages: [], exceptions: [] };
    });
  },

  setFilterLevels: (levels) => {
    set({ filterLevels: levels });
  },

  setFilterSessionIds: (sessionIds) => {
    set({ filterSessionIds: sessionIds });
  },

  clearFilters: () => {
    set({ filterLevels: null, filterSessionIds: null });
  },

  getFilteredMessages: () => {
    const state = get();
    let filtered = state.consoleMessages;

    if (state.filterLevels && state.filterLevels.length > 0) {
      filtered = filtered.filter(m => state.filterLevels!.includes(m.level));
    }

    if (state.filterSessionIds && state.filterSessionIds.length > 0) {
      filtered = filtered.filter(m => state.filterSessionIds!.includes(m.sessionId));
    }

    return filtered;
  },

  getSession: (sessionId) => {
    return get().sessions.get(sessionId);
  },

  initializeSubscriptions: () => {
    const unsubscribers: (() => void)[] = [];

    unsubscribers.push(
      window.terminalIDE.debug.onSessionCreated(({ session }) => {
        get().addSession(session);
      })
    );

    unsubscribers.push(
      window.terminalIDE.debug.onSessionStateChanged(({ sessionId, state, pausedAt, callStack }) => {
        get().updateSessionState(sessionId, state, pausedAt, callStack);
      })
    );

    unsubscribers.push(
      window.terminalIDE.debug.onConsoleMessage(({ message }) => {
        get().addConsoleMessage(message);
      })
    );

    unsubscribers.push(
      window.terminalIDE.debug.onException(({ exception }) => {
        get().addException(exception);
      })
    );

    unsubscribers.push(
      window.terminalIDE.debug.onBreakpointHit(({ sessionId, breakpoint, callStack }) => {
        const session = get().sessions.get(sessionId);
        if (session) {
          get().updateSessionState(sessionId, 'paused', {
            source: breakpoint.source,
            line: breakpoint.line,
            column: breakpoint.column,
            reason: 'breakpoint',
          }, callStack);
        }
      })
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  },
}));

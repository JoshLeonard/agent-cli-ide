import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';

// Mock window.terminalIDE
const mockTerminalIDE = {
  session: {
    terminate: vi.fn()
  },
  worktree: {
    setAgentPref: vi.fn(),
    getAgentPrefs: vi.fn().mockResolvedValue({})
  }
};

// @ts-ignore
global.window = {
  terminalIDE: mockTerminalIDE
};

// Import after mocking window
import { useLayoutStore } from '../../../src/renderer/stores/layoutStore';
import type { SessionInfo } from '../../../src/shared/types/session';
import type { GridLayoutState, TerminalPanel } from '../../../src/shared/types/layout';

describe('layoutStore', () => {
  beforeEach(() => {
    // Reset the store before each test
    const store = useLayoutStore.getState();
    store.clearSessions();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have default grid config', () => {
      const state = useLayoutStore.getState();

      expect(state.gridConfig).toEqual({ rows: 2, cols: 5 });
    });

    it('should have 10 initial panels (2x5 grid)', () => {
      const state = useLayoutStore.getState();

      expect(state.panels).toHaveLength(10);
      expect(state.panels.every(p => p.sessionId === null)).toBe(true);
    });

    it('should have no active panel initially', () => {
      const state = useLayoutStore.getState();

      expect(state.activePanel).toBeNull();
    });

    it('should have empty sessions map', () => {
      const state = useLayoutStore.getState();

      expect(state.sessions.size).toBe(0);
    });

    it('should not be restoring initially', () => {
      const state = useLayoutStore.getState();

      expect(state.isRestoring).toBe(false);
    });
  });

  describe('setIsRestoring', () => {
    it('should set isRestoring state', () => {
      const store = useLayoutStore.getState();

      store.setIsRestoring(true);
      expect(useLayoutStore.getState().isRestoring).toBe(true);

      store.setIsRestoring(false);
      expect(useLayoutStore.getState().isRestoring).toBe(false);
    });
  });

  describe('setGridDimensions', () => {
    it('should update grid dimensions', () => {
      const store = useLayoutStore.getState();

      const result = store.setGridDimensions(3, 4);

      expect(result).toBe(true);
      expect(useLayoutStore.getState().gridConfig).toEqual({ rows: 3, cols: 4 });
      expect(useLayoutStore.getState().panels).toHaveLength(12);
    });

    it('should add empty panels when growing', () => {
      const store = useLayoutStore.getState();

      store.setGridDimensions(3, 5); // 15 panels

      const state = useLayoutStore.getState();
      expect(state.panels).toHaveLength(15);
      expect(state.panels.every(p => p.sessionId === null)).toBe(true);
    });

    it('should prevent shrinking below active session count', () => {
      const store = useLayoutStore.getState();

      // Add sessions to panels
      const mockSession: SessionInfo = {
        id: 'session-1',
        type: 'attached',
        cwd: '/test',
        status: 'running',
        createdAt: Date.now()
      };

      store.updateSession(mockSession);
      const panelId = store.panels[0].id;
      store.setSessionForPanel(panelId, 'session-1');

      // Try to shrink to 0 panels
      const result = store.setGridDimensions(0, 0);

      expect(result).toBe(false);
      expect(useLayoutStore.getState().panels.length).toBeGreaterThan(0);
    });

    it('should redistribute active panels when shrinking', () => {
      const store = useLayoutStore.getState();

      // Setup: 10 panels with 2 sessions
      const session1: SessionInfo = { id: 's1', type: 'attached', cwd: '/', status: 'running', createdAt: 0 };
      const session2: SessionInfo = { id: 's2', type: 'attached', cwd: '/', status: 'running', createdAt: 0 };

      store.updateSession(session1);
      store.updateSession(session2);
      store.setSessionForPanel(store.panels[0].id, 's1');
      store.setSessionForPanel(store.panels[5].id, 's2');

      // Shrink to 2x2 = 4 panels
      const result = store.setGridDimensions(2, 2);

      expect(result).toBe(true);
      const state = useLayoutStore.getState();
      expect(state.panels).toHaveLength(4);

      // Both sessions should still be assigned
      const activePanels = state.panels.filter(p => p.sessionId !== null);
      expect(activePanels).toHaveLength(2);
    });
  });

  describe('initializeGrid', () => {
    it('should reset grid with new config', () => {
      const store = useLayoutStore.getState();

      // Add some sessions first
      store.updateSession({ id: 's1', type: 'attached', cwd: '/', status: 'running', createdAt: 0 });
      store.setSessionForPanel(store.panels[0].id, 's1');

      // Initialize with new config
      store.initializeGrid({ rows: 3, cols: 3 });

      const state = useLayoutStore.getState();
      expect(state.gridConfig).toEqual({ rows: 3, cols: 3 });
      expect(state.panels).toHaveLength(9);
      expect(state.panels.every(p => p.sessionId === null)).toBe(true);
      expect(state.activePanel).toBeNull();
    });
  });

  describe('panel operations', () => {
    describe('setSessionForPanel', () => {
      it('should assign session to panel', () => {
        const store = useLayoutStore.getState();
        const panelId = store.panels[0].id;

        store.setSessionForPanel(panelId, 'session-1');

        const state = useLayoutStore.getState();
        expect(state.panels[0].sessionId).toBe('session-1');
        expect(state.activePanel).toBe(panelId);
      });
    });

    describe('clearPanelSession', () => {
      it('should clear session from panel and terminate session', () => {
        const store = useLayoutStore.getState();
        const panelId = store.panels[0].id;

        store.setSessionForPanel(panelId, 'session-1');
        store.clearPanelSession(panelId);

        expect(useLayoutStore.getState().panels[0].sessionId).toBeNull();
        expect(mockTerminalIDE.session.terminate).toHaveBeenCalledWith('session-1');
      });
    });

    describe('setActivePanel', () => {
      it('should set active panel', () => {
        const store = useLayoutStore.getState();
        const panelId = store.panels[2].id;

        store.setActivePanel(panelId);

        expect(useLayoutStore.getState().activePanel).toBe(panelId);
      });

      it('should allow setting to null', () => {
        const store = useLayoutStore.getState();

        store.setActivePanel(store.panels[0].id);
        store.setActivePanel(null);

        expect(useLayoutStore.getState().activePanel).toBeNull();
      });
    });
  });

  describe('session management', () => {
    const mockSession: SessionInfo = {
      id: 'test-session',
      type: 'attached',
      cwd: '/project',
      status: 'running',
      createdAt: Date.now()
    };

    describe('updateSession', () => {
      it('should add new session to map', () => {
        const store = useLayoutStore.getState();

        store.updateSession(mockSession);

        expect(useLayoutStore.getState().sessions.get('test-session')).toEqual(mockSession);
      });

      it('should update existing session', () => {
        const store = useLayoutStore.getState();

        store.updateSession(mockSession);
        store.updateSession({ ...mockSession, status: 'terminated' });

        expect(useLayoutStore.getState().sessions.get('test-session')?.status).toBe('terminated');
      });
    });

    describe('removeSession', () => {
      it('should remove session from map', () => {
        const store = useLayoutStore.getState();

        store.updateSession(mockSession);
        store.removeSession('test-session');

        expect(useLayoutStore.getState().sessions.has('test-session')).toBe(false);
      });

      it('should clear panel sessionId when removing session', () => {
        const store = useLayoutStore.getState();

        store.updateSession(mockSession);
        store.setSessionForPanel(store.panels[0].id, 'test-session');
        store.removeSession('test-session');

        expect(useLayoutStore.getState().panels[0].sessionId).toBeNull();
      });

      it('should remove agent status when removing session', () => {
        const store = useLayoutStore.getState();

        store.updateSession(mockSession);
        store.updateAgentStatus({ sessionId: 'test-session', activityState: 'idle', lastUpdate: Date.now() });
        store.removeSession('test-session');

        expect(useLayoutStore.getState().agentStatuses.has('test-session')).toBe(false);
      });
    });

    describe('clearSessions', () => {
      it('should clear all sessions and reset grid', () => {
        const store = useLayoutStore.getState();

        store.updateSession(mockSession);
        store.setSessionForPanel(store.panels[0].id, 'test-session');
        store.clearSessions();

        const state = useLayoutStore.getState();
        expect(state.sessions.size).toBe(0);
        expect(state.panels.every(p => p.sessionId === null)).toBe(true);
      });

      it('should use provided config when clearing', () => {
        const store = useLayoutStore.getState();

        store.clearSessions({ rows: 3, cols: 3 });

        expect(useLayoutStore.getState().gridConfig).toEqual({ rows: 3, cols: 3 });
      });
    });

    describe('setSessions', () => {
      it('should set multiple sessions at once', () => {
        const store = useLayoutStore.getState();

        const sessions: SessionInfo[] = [
          { id: 's1', type: 'attached', cwd: '/', status: 'running', createdAt: 0 },
          { id: 's2', type: 'isolated', cwd: '/wt', branch: 'feature', status: 'running', createdAt: 0 }
        ];

        store.setSessions(sessions);

        const state = useLayoutStore.getState();
        expect(state.sessions.size).toBe(2);
        expect(state.sessions.has('s1')).toBe(true);
        expect(state.sessions.has('s2')).toBe(true);
      });
    });
  });

  describe('agent status management', () => {
    describe('updateAgentStatus', () => {
      it('should add agent status', () => {
        const store = useLayoutStore.getState();

        store.updateAgentStatus({
          sessionId: 'session-1',
          activityState: 'working',
          lastUpdate: Date.now()
        });

        expect(useLayoutStore.getState().agentStatuses.get('session-1')).toBeDefined();
      });
    });

    describe('removeAgentStatus', () => {
      it('should remove agent status', () => {
        const store = useLayoutStore.getState();

        store.updateAgentStatus({ sessionId: 's1', activityState: 'idle', lastUpdate: 0 });
        store.removeAgentStatus('s1');

        expect(useLayoutStore.getState().agentStatuses.has('s1')).toBe(false);
      });
    });

    describe('getAgentStatus', () => {
      it('should return status for session', () => {
        const store = useLayoutStore.getState();

        const status = { sessionId: 's1', activityState: 'working' as const, lastUpdate: Date.now() };
        store.updateAgentStatus(status);

        expect(store.getAgentStatus('s1')).toEqual(status);
      });

      it('should return undefined for unknown session', () => {
        const store = useLayoutStore.getState();

        expect(store.getAgentStatus('unknown')).toBeUndefined();
      });
    });
  });

  describe('utility methods', () => {
    describe('findPanelBySessionId', () => {
      it('should find panel with given session', () => {
        const store = useLayoutStore.getState();
        const panelId = store.panels[3].id;

        store.setSessionForPanel(panelId, 'session-1');

        expect(store.findPanelBySessionId('session-1')).toBe(panelId);
      });

      it('should return null for unknown session', () => {
        const store = useLayoutStore.getState();

        expect(store.findPanelBySessionId('unknown')).toBeNull();
      });
    });

    describe('findPanelById', () => {
      it('should find panel by id', () => {
        const store = useLayoutStore.getState();
        const targetPanel = store.panels[2];

        expect(store.findPanelById(targetPanel.id)).toEqual(targetPanel);
      });

      it('should return null for unknown id', () => {
        const store = useLayoutStore.getState();

        expect(store.findPanelById('unknown-panel')).toBeNull();
      });
    });

    describe('findPanelByWorktreePath', () => {
      it('should find panel by worktree path', () => {
        const store = useLayoutStore.getState();

        const session: SessionInfo = {
          id: 's1',
          type: 'isolated',
          cwd: '/tmp/worktree',
          status: 'running',
          createdAt: 0
        };

        store.updateSession(session);
        store.setSessionForPanel(store.panels[0].id, 's1');

        expect(store.findPanelByWorktreePath('/tmp/worktree')).toBe(store.panels[0].id);
      });

      it('should handle case-insensitive path matching', () => {
        const store = useLayoutStore.getState();

        const session: SessionInfo = {
          id: 's1',
          type: 'isolated',
          cwd: '/TMP/Worktree',
          status: 'running',
          createdAt: 0
        };

        store.updateSession(session);
        store.setSessionForPanel(store.panels[0].id, 's1');

        expect(store.findPanelByWorktreePath('/tmp/worktree')).toBe(store.panels[0].id);
      });
    });

    describe('moveSessionToPanel', () => {
      it('should move session from one panel to another', () => {
        const store = useLayoutStore.getState();
        const sourcePanel = store.panels[0].id;
        const targetPanel = store.panels[5].id;

        store.setSessionForPanel(sourcePanel, 'session-1');
        store.moveSessionToPanel('session-1', targetPanel);

        const state = useLayoutStore.getState();
        expect(state.panels.find(p => p.id === sourcePanel)?.sessionId).toBeNull();
        expect(state.panels.find(p => p.id === targetPanel)?.sessionId).toBe('session-1');
        expect(state.activePanel).toBe(targetPanel);
      });
    });

    describe('getAllPanels', () => {
      it('should return all panels', () => {
        const store = useLayoutStore.getState();

        expect(store.getAllPanels()).toEqual(store.panels);
      });
    });

    describe('getActiveSessionCount', () => {
      it('should count panels with sessions', () => {
        const store = useLayoutStore.getState();

        store.setSessionForPanel(store.panels[0].id, 's1');
        store.setSessionForPanel(store.panels[3].id, 's2');

        expect(store.getActiveSessionCount()).toBe(2);
      });
    });

    describe('findFirstEmptyPanel', () => {
      it('should find first panel without session', () => {
        const store = useLayoutStore.getState();

        store.setSessionForPanel(store.panels[0].id, 's1');

        const emptyPanel = store.findFirstEmptyPanel();
        expect(emptyPanel?.id).toBe(store.panels[1].id);
      });

      it('should return null when all panels are occupied', () => {
        const store = useLayoutStore.getState();

        // Fill all panels
        store.panels.forEach((p, i) => {
          store.setSessionForPanel(p.id, `session-${i}`);
        });

        // Refresh state reference
        const freshStore = useLayoutStore.getState();
        expect(freshStore.findFirstEmptyPanel()).toBeNull();
      });
    });
  });

  describe('layout persistence', () => {
    describe('getLayout', () => {
      it('should return current layout state', () => {
        const store = useLayoutStore.getState();

        store.setGridDimensions(3, 4);
        store.setSessionForPanel(store.panels[0].id, 's1');

        const layout = useLayoutStore.getState().getLayout();

        expect(layout.version).toBe(3);
        expect(layout.config).toEqual({ rows: 3, cols: 4 });
        expect(layout.panels).toHaveLength(12);
      });
    });

    describe('setLayout', () => {
      it('should restore grid layout', () => {
        const store = useLayoutStore.getState();

        // Add a session first (layout validation requires sessions to exist)
        store.updateSession({ id: 's1', type: 'attached', cwd: '/', status: 'running', createdAt: 0 });

        const layout: GridLayoutState = {
          version: 3,
          config: { rows: 2, cols: 3 },
          panels: [
            { type: 'panel', id: 'p1', sessionId: 's1' },
            { type: 'panel', id: 'p2', sessionId: null },
            { type: 'panel', id: 'p3', sessionId: null },
            { type: 'panel', id: 'p4', sessionId: null },
            { type: 'panel', id: 'p5', sessionId: null },
            { type: 'panel', id: 'p6', sessionId: null }
          ]
        };

        store.setLayout(layout);

        const state = useLayoutStore.getState();
        expect(state.gridConfig).toEqual({ rows: 2, cols: 3 });
        expect(state.panels).toHaveLength(6);
        expect(state.panels[0].sessionId).toBe('s1');
      });

      it('should validate sessionIds against existing sessions', () => {
        const store = useLayoutStore.getState();

        // Don't add session-1 to sessions map
        const layout: GridLayoutState = {
          version: 3,
          config: { rows: 1, cols: 2 },
          panels: [
            { type: 'panel', id: 'p1', sessionId: 'non-existent' },
            { type: 'panel', id: 'p2', sessionId: null }
          ]
        };

        store.setLayout(layout);

        // Session should be invalidated since it doesn't exist
        const state = useLayoutStore.getState();
        expect(state.panels[0].sessionId).toBeNull();
      });
    });
  });

  describe('worktree agent preferences', () => {
    describe('getWorktreeAgent', () => {
      it('should return agent for worktree path', () => {
        const state = useLayoutStore.getState();
        state.worktreeAgentPrefs.set('/worktree', 'claude-code');

        expect(state.getWorktreeAgent('/worktree')).toBe('claude-code');
      });
    });

    describe('setWorktreeAgent', () => {
      it('should set agent and persist to backend', () => {
        const store = useLayoutStore.getState();

        store.setWorktreeAgent('/new/worktree', 'aider');

        expect(useLayoutStore.getState().worktreeAgentPrefs.get('/new/worktree')).toBe('aider');
        expect(mockTerminalIDE.worktree.setAgentPref).toHaveBeenCalledWith('/new/worktree', 'aider');
      });
    });

    describe('loadWorktreeAgentPrefsFromBackend', () => {
      it('should load prefs from backend', async () => {
        mockTerminalIDE.worktree.getAgentPrefs.mockResolvedValue({
          '/wt1': 'claude-code',
          '/wt2': 'aider'
        });

        const store = useLayoutStore.getState();
        await store.loadWorktreeAgentPrefsFromBackend();

        const state = useLayoutStore.getState();
        expect(state.worktreeAgentPrefs.get('/wt1')).toBe('claude-code');
        expect(state.worktreeAgentPrefs.get('/wt2')).toBe('aider');
      });
    });
  });
});

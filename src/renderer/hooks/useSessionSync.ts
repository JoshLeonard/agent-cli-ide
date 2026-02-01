import { useEffect } from 'react';
import { useLayoutStore } from '../stores/layoutStore';

/**
 * Hook to synchronize sessions from backend on mount.
 * Handles loading worktree agent preferences, fetching backend sessions,
 * and restoring layout state.
 */
export function useSessionSync() {
  const {
    updateSession,
    clearSessions,
    setLayout,
    loadWorktreeAgentPrefsFromBackend,
  } = useLayoutStore();

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
}

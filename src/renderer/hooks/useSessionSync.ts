import { useEffect } from 'react';
import { useLayoutStore } from '../stores/layoutStore';
import { useProjectStore } from '../stores/projectStore';

/**
 * Hook to synchronize sessions from backend when project changes.
 * Handles loading worktree agent preferences, fetching backend sessions,
 * and restoring layout state. Re-runs when the current project changes.
 */
export function useSessionSync() {
  const { currentProject } = useProjectStore();
  const {
    updateSession,
    clearSessions,
    setLayout,
    loadWorktreeAgentPrefsFromBackend,
    setIsRestoring,
  } = useLayoutStore();

  useEffect(() => {
    // Only sync if we have a project
    if (!currentProject) return;

    let mounted = true;

    const syncSessions = async () => {
      setIsRestoring(true);

      try {
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
          // CRITICAL: Add sessions to store BEFORE calling setLayout
          // This ensures sessionIds are validated against a populated map
          for (const session of backendSessions) {
            updateSession(session);
          }

          // Restore layout structure - now sessionIds will be found in the map
          const state = await window.terminalIDE.persistence.restore();
          if (mounted && state?.layout) {
            setLayout(state.layout);
          }
        }
        // If no sessions, we keep the empty grid from clearSessions()
      } finally {
        if (mounted) {
          setIsRestoring(false);
        }
      }
    };

    syncSessions();

    return () => {
      mounted = false;
    };
  }, [currentProject?.path]); // Re-run when project changes
}

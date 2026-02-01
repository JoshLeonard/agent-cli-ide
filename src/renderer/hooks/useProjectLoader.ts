import { useEffect } from 'react';
import { useProjectStore } from '../stores/projectStore';
import { useSettingsStore } from '../stores/settingsStore';

/**
 * Hook to load project and settings on mount.
 */
export function useProjectLoader() {
  const setProject = useProjectStore((state) => state.setProject);
  const loadSettings = useSettingsStore((state) => state.loadSettings);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

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
}

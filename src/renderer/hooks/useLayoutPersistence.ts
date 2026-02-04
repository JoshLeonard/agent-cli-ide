import { useEffect } from 'react';
import { useLayoutStore } from '../stores/layoutStore';

/**
 * Hook to handle periodic layout saves.
 * Debounces saves on panel changes and also saves periodically as a fallback.
 * Skips saves while isRestoring is true to prevent overwriting persisted state.
 */
export function useLayoutPersistence() {
  const { panels, gridConfig, getLayout, isRestoring } = useLayoutStore();

  useEffect(() => {
    // Don't save during restoration - we'd overwrite the persisted state
    if (isRestoring) {
      return;
    }

    const saveLayout = () => {
      // Double-check we're not restoring (in case state changed during debounce)
      if (useLayoutStore.getState().isRestoring) {
        return;
      }
      const layout = getLayout();
      window.terminalIDE.layout.save(layout);
    };

    // Debounced save for immediate changes
    let debounceTimer: NodeJS.Timeout | null = null;
    const debouncedSave = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(saveLayout, 500);
    };

    // Save when panels change
    debouncedSave();

    // Also save periodically as a fallback
    const interval = setInterval(saveLayout, 30000);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      clearInterval(interval);
    };
  }, [panels, gridConfig, getLayout, isRestoring]);
}

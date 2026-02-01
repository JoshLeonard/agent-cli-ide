import { useEffect } from 'react';
import { useLayoutStore } from '../stores/layoutStore';

/**
 * Hook to handle periodic layout saves.
 * Debounces saves on panel changes and also saves periodically as a fallback.
 */
export function useLayoutPersistence() {
  const { panels, gridConfig, getLayout } = useLayoutStore();

  useEffect(() => {
    const saveLayout = () => {
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
  }, [panels, gridConfig, getLayout]);
}

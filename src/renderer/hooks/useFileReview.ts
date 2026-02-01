import { useEffect, useCallback } from 'react';
import { useFileReviewStore } from '../stores/fileReviewStore';
import { useLayoutStore } from '../stores/layoutStore';
import { activityTypeToFileChangeType } from '../../shared/types/fileReview';
import type { ActivityEvent } from '../../shared/types/activity';

/**
 * Hook that watches activity events and populates the file review store.
 * Also provides the keyboard shortcut (Ctrl+Shift+R) to open the review modal.
 */
export function useFileReview() {
  const addPendingChange = useFileReviewStore((state) => state.addPendingChange);
  const openReview = useFileReviewStore((state) => state.openReview);
  const isModalOpen = useFileReviewStore((state) => state.isModalOpen);
  const activePanel = useLayoutStore((state) => state.activePanel);
  const panels = useLayoutStore((state) => state.panels);

  // Get the session ID of the currently active panel
  const getActiveSessionId = useCallback((): string | null => {
    if (!activePanel) return null;
    const panel = panels.find((p) => p.id === activePanel);
    return panel?.sessionId || null;
  }, [activePanel, panels]);

  // Handle activity events
  const handleActivityEvent = useCallback(
    (event: ActivityEvent) => {
      const changeType = activityTypeToFileChangeType(event.type);
      if (changeType && event.filePath) {
        addPendingChange(event.sessionId, event.filePath, changeType);
      }
    },
    [addPendingChange]
  );

  // Subscribe to activity events
  useEffect(() => {
    const unsubscribe = window.terminalIDE.activity.onEvent(({ event }) => {
      handleActivityEvent(event);
    });

    return () => {
      unsubscribe();
    };
  }, [handleActivityEvent]);

  // Keyboard shortcut: Ctrl+Shift+R to open review for active session
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+R to open review
      if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        e.preventDefault();

        if (isModalOpen) return;

        const sessionId = getActiveSessionId();
        if (sessionId) {
          openReview(sessionId);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, getActiveSessionId, openReview]);
}

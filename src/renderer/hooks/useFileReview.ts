import { useEffect, useCallback, useRef } from 'react';
import { useFileReviewStore } from '../stores/fileReviewStore';
import { useLayoutStore } from '../stores/layoutStore';
import { activityTypeToFileChangeType } from '../../shared/types/fileReview';
import type { ActivityEvent, ActivityType } from '../../shared/types/activity';

const FILE_EVENT_TYPES: ActivityType[] = ['file_created', 'file_modified', 'file_deleted', 'git_commit'];

/**
 * Hook that watches activity events and populates the file review store.
 * Also provides the keyboard shortcut (Ctrl+Shift+R) to open the review modal.
 */
export function useFileReview() {
  const addPendingChange = useFileReviewStore((state) => state.addPendingChange);
  const clearPendingChanges = useFileReviewStore((state) => state.clearPendingChanges);
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
      // Clear pending changes when a commit is detected
      if (event.type === 'git_commit') {
        clearPendingChanges(event.sessionId);
        return;
      }

      const changeType = activityTypeToFileChangeType(event.type);
      if (changeType && event.filePath) {
        addPendingChange(event.sessionId, event.filePath, changeType);
      }
    },
    [addPendingChange, clearPendingChanges]
  );

  // Load historical file events on mount
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const loadHistoricalEvents = async () => {
      try {
        // Fetch recent file-related events
        const events = await window.terminalIDE.activity.getEvents({
          types: FILE_EVENT_TYPES,
          limit: 500,
        });

        // Process events oldest-first so newer events override older ones
        const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);
        for (const event of sortedEvents) {
          handleActivityEvent(event);
        }
      } catch (error) {
        console.error('Failed to load historical file events:', error);
      }
    };

    loadHistoricalEvents();
  }, [handleActivityEvent]);

  // Subscribe to new activity events
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

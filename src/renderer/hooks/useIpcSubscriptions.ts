import { useEffect } from 'react';
import { useLayoutStore } from '../stores/layoutStore';
import { useProjectStore } from '../stores/projectStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useMessagingStore } from '../stores/messagingStore';

/**
 * Hook to consolidate all IPC event subscriptions.
 * Handles session, project, settings, and messaging events.
 */
export function useIpcSubscriptions() {
  const { updateSession, removeSession } = useLayoutStore();
  const setProject = useProjectStore((state) => state.setProject);
  const setSettings = useSettingsStore((state) => state.setSettings);
  const { addRecentMessage, setLastReceivedMessage } = useMessagingStore();

  // Subscribe to session events
  useEffect(() => {
    const unsubscribeTerminated = window.terminalIDE.session.onTerminated(({ sessionId }) => {
      removeSession(sessionId);
    });

    const unsubscribeUpdated = window.terminalIDE.session.onUpdated(({ session }) => {
      updateSession(session);
    });

    return () => {
      unsubscribeTerminated();
      unsubscribeUpdated();
    };
  }, [updateSession, removeSession]);

  // Subscribe to project updates
  useEffect(() => {
    const unsubscribe = window.terminalIDE.project.onUpdated(({ project }) => {
      setProject(project);
    });

    return () => {
      unsubscribe();
    };
  }, [setProject]);

  // Subscribe to settings updates
  useEffect(() => {
    const unsubscribe = window.terminalIDE.settings.onUpdated(({ settings }) => {
      setSettings(settings);
    });

    return () => {
      unsubscribe();
    };
  }, [setSettings]);

  // Subscribe to messaging events
  useEffect(() => {
    const unsubscribeSent = window.terminalIDE.messaging.onSent(({ message }) => {
      addRecentMessage(message);
    });

    const unsubscribeReceived = window.terminalIDE.messaging.onReceived(({ message, targetSessionId }) => {
      setLastReceivedMessage(targetSessionId);
    });

    return () => {
      unsubscribeSent();
      unsubscribeReceived();
    };
  }, [addRecentMessage, setLastReceivedMessage]);
}

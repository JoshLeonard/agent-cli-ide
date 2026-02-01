import { useEffect, useCallback } from 'react';
import { useLayoutStore } from '../stores/layoutStore';
import { useMessagingStore } from '../stores/messagingStore';
import { useGitStore } from '../stores/gitStore';

interface KeyboardShortcutsCallbacks {
  onOpenSettings: () => void;
}

/**
 * Hook to centralize keyboard shortcut handling.
 * Handles messaging shortcuts (Ctrl+Shift+S, Ctrl+Shift+B, Ctrl+Shift+V) and settings (Ctrl+,).
 */
export function useKeyboardShortcuts({ onOpenSettings }: KeyboardShortcutsCallbacks) {
  const { panels, activePanel } = useLayoutStore();
  const { openQuickSend } = useMessagingStore();
  const { togglePanel: toggleGitPanel } = useGitStore();

  // Paste from shared clipboard
  const handlePasteSharedClipboard = useCallback(async () => {
    const clipboard = await window.terminalIDE.messaging.getClipboard();
    if (!clipboard) {
      console.log('Shared clipboard is empty');
      return;
    }

    // Get the active session
    const activePanel_data = panels.find(p => p.id === activePanel);
    const activeSessionId = activePanel_data?.sessionId;

    if (!activeSessionId) {
      console.log('No active session to paste into');
      return;
    }

    // Write clipboard content to active session
    await window.terminalIDE.session.write(activeSessionId, clipboard.content);
  }, [panels, activePanel]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+S: Open Quick Send Dialog
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        openQuickSend();
      }
      // Ctrl+Shift+B: Broadcast to all sessions
      if (e.ctrlKey && e.shiftKey && e.key === 'B') {
        e.preventDefault();
        openQuickSend();
        // The dialog will handle broadcast mode
      }
      // Ctrl+Shift+V: Paste from shared clipboard
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        handlePasteSharedClipboard();
      }
      // Ctrl+,: Open Settings
      if (e.ctrlKey && !e.shiftKey && e.key === ',') {
        e.preventDefault();
        onOpenSettings();
      }
      // Ctrl+Shift+G: Toggle Git Panel
      if (e.ctrlKey && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        toggleGitPanel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openQuickSend, handlePasteSharedClipboard, onOpenSettings, toggleGitPanel]);

  return { handlePasteSharedClipboard };
}

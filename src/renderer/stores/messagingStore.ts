import { create } from 'zustand';
import type { InterSessionMessage, SharedClipboard } from '../../shared/types/messaging';

interface MessagingStore {
  // State
  sharedClipboard: SharedClipboard | null;
  recentMessages: InterSessionMessage[];
  lastReceivedMessage: { sessionId: string; timestamp: number } | null;
  lastSentMessage: { sessionId: string; timestamp: number } | null;

  // Quick send dialog state
  quickSendOpen: boolean;
  quickSendTarget: string | null;

  // Actions
  setSharedClipboard: (clipboard: SharedClipboard | null) => void;
  addRecentMessage: (message: InterSessionMessage) => void;
  clearRecentMessages: () => void;

  // Message feedback
  setLastReceivedMessage: (sessionId: string) => void;
  setLastSentMessage: (sessionId: string) => void;
  clearMessageFeedback: (sessionId: string) => void;

  // Quick send dialog
  openQuickSend: (targetSessionId?: string) => void;
  closeQuickSend: () => void;
}

// Keep last 50 messages
const MAX_RECENT_MESSAGES = 50;

// Feedback display duration
const FEEDBACK_DURATION = 2000;

export const useMessagingStore = create<MessagingStore>((set, get) => ({
  sharedClipboard: null,
  recentMessages: [],
  lastReceivedMessage: null,
  lastSentMessage: null,
  quickSendOpen: false,
  quickSendTarget: null,

  setSharedClipboard: (clipboard: SharedClipboard | null) => {
    set({ sharedClipboard: clipboard });
  },

  addRecentMessage: (message: InterSessionMessage) => {
    set((state) => ({
      recentMessages: [message, ...state.recentMessages].slice(0, MAX_RECENT_MESSAGES),
    }));
  },

  clearRecentMessages: () => {
    set({ recentMessages: [] });
  },

  setLastReceivedMessage: (sessionId: string) => {
    const timestamp = Date.now();
    set({ lastReceivedMessage: { sessionId, timestamp } });

    // Auto-clear after duration
    setTimeout(() => {
      const state = get();
      if (state.lastReceivedMessage?.sessionId === sessionId &&
          state.lastReceivedMessage?.timestamp === timestamp) {
        set({ lastReceivedMessage: null });
      }
    }, FEEDBACK_DURATION);
  },

  setLastSentMessage: (sessionId: string) => {
    const timestamp = Date.now();
    set({ lastSentMessage: { sessionId, timestamp } });

    // Auto-clear after duration
    setTimeout(() => {
      const state = get();
      if (state.lastSentMessage?.sessionId === sessionId &&
          state.lastSentMessage?.timestamp === timestamp) {
        set({ lastSentMessage: null });
      }
    }, FEEDBACK_DURATION);
  },

  clearMessageFeedback: (sessionId: string) => {
    set((state) => {
      const updates: Partial<MessagingStore> = {};
      if (state.lastReceivedMessage?.sessionId === sessionId) {
        updates.lastReceivedMessage = null;
      }
      if (state.lastSentMessage?.sessionId === sessionId) {
        updates.lastSentMessage = null;
      }
      return updates;
    });
  },

  openQuickSend: (targetSessionId?: string) => {
    set({ quickSendOpen: true, quickSendTarget: targetSessionId || null });
  },

  closeQuickSend: () => {
    set({ quickSendOpen: false, quickSendTarget: null });
  },
}));

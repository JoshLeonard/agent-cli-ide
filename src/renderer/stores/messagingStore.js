import { create } from 'zustand';
// Keep last 50 messages
const MAX_RECENT_MESSAGES = 50;
// Feedback display duration
const FEEDBACK_DURATION = 2000;
export const useMessagingStore = create((set, get) => ({
    sharedClipboard: null,
    recentMessages: [],
    lastReceivedMessage: null,
    lastSentMessage: null,
    quickSendOpen: false,
    quickSendTarget: null,
    setSharedClipboard: (clipboard) => {
        set({ sharedClipboard: clipboard });
    },
    addRecentMessage: (message) => {
        set((state) => ({
            recentMessages: [message, ...state.recentMessages].slice(0, MAX_RECENT_MESSAGES),
        }));
    },
    clearRecentMessages: () => {
        set({ recentMessages: [] });
    },
    setLastReceivedMessage: (sessionId) => {
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
    setLastSentMessage: (sessionId) => {
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
    clearMessageFeedback: (sessionId) => {
        set((state) => {
            const updates = {};
            if (state.lastReceivedMessage?.sessionId === sessionId) {
                updates.lastReceivedMessage = null;
            }
            if (state.lastSentMessage?.sessionId === sessionId) {
                updates.lastSentMessage = null;
            }
            return updates;
        });
    },
    openQuickSend: (targetSessionId) => {
        set({ quickSendOpen: true, quickSendTarget: targetSessionId || null });
    },
    closeQuickSend: () => {
        set({ quickSendOpen: false, quickSendTarget: null });
    },
}));
//# sourceMappingURL=messagingStore.js.map
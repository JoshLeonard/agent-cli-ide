import { create } from 'zustand';
import type { PendingFileChange, FileDiff, FileChangeType } from '../../shared/types/fileReview';

interface FileReviewStore {
  // State
  pendingChanges: Map<string, PendingFileChange[]>; // sessionId -> changes
  isModalOpen: boolean;
  activeSessionId: string | null;
  currentFileIndex: number;
  currentDiff: FileDiff | null;
  editedContent: string | null;
  hasUnsavedChanges: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions - Pending changes
  addPendingChange: (
    sessionId: string,
    filePath: string,
    changeType: FileChangeType
  ) => void;
  removePendingChange: (sessionId: string, filePath: string) => void;
  clearPendingChanges: (sessionId: string) => void;
  getPendingChangesForSession: (sessionId: string) => PendingFileChange[];
  getUnreviewedCount: (sessionId: string) => number;
  getTotalUnreviewedCount: () => number;

  // Actions - Modal
  openReview: (sessionId: string, fileIndex?: number) => void;
  closeReview: () => void;

  // Actions - Navigation
  navigateFile: (index: number) => void;
  navigateNext: () => void;
  navigatePrevious: () => void;

  // Actions - Diff
  setCurrentDiff: (diff: FileDiff | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Actions - Editing
  setEditedContent: (content: string | null) => void;
  markUnsavedChanges: (hasChanges: boolean) => void;

  // Actions - Review
  markAsReviewed: (sessionId: string, filePath: string) => void;
  markCurrentAsReviewed: () => void;

  // Actions - File operations
  saveCurrentFile: () => Promise<void>;
  revertCurrentFile: () => Promise<void>;
  refreshCurrentDiff: () => Promise<void>;
}

let changeIdCounter = 0;
const generateChangeId = () => `change-${++changeIdCounter}-${Date.now()}`;

export const useFileReviewStore = create<FileReviewStore>((set, get) => ({
  // Initial state
  pendingChanges: new Map(),
  isModalOpen: false,
  activeSessionId: null,
  currentFileIndex: 0,
  currentDiff: null,
  editedContent: null,
  hasUnsavedChanges: false,
  isLoading: false,
  error: null,

  // Pending changes actions
  addPendingChange: (sessionId, filePath, changeType) => {
    set((state) => {
      const newChanges = new Map(state.pendingChanges);
      const sessionChanges = [...(newChanges.get(sessionId) || [])];

      // Check if we already have a pending change for this file
      const existingIndex = sessionChanges.findIndex(
        (c) => c.filePath === filePath
      );

      const change: PendingFileChange = {
        id: generateChangeId(),
        sessionId,
        filePath,
        changeType,
        timestamp: Date.now(),
        reviewed: false,
      };

      if (existingIndex >= 0) {
        // Update existing change
        sessionChanges[existingIndex] = change;
      } else {
        // Add new change
        sessionChanges.push(change);
      }

      newChanges.set(sessionId, sessionChanges);
      return { pendingChanges: newChanges };
    });
  },

  removePendingChange: (sessionId, filePath) => {
    set((state) => {
      const newChanges = new Map(state.pendingChanges);
      const sessionChanges = newChanges.get(sessionId) || [];
      const filtered = sessionChanges.filter((c) => c.filePath !== filePath);

      if (filtered.length > 0) {
        newChanges.set(sessionId, filtered);
      } else {
        newChanges.delete(sessionId);
      }

      return { pendingChanges: newChanges };
    });
  },

  clearPendingChanges: (sessionId) => {
    set((state) => {
      const newChanges = new Map(state.pendingChanges);
      newChanges.delete(sessionId);
      return { pendingChanges: newChanges };
    });
  },

  getPendingChangesForSession: (sessionId) => {
    return get().pendingChanges.get(sessionId) || [];
  },

  getUnreviewedCount: (sessionId) => {
    const changes = get().pendingChanges.get(sessionId) || [];
    return changes.filter((c) => !c.reviewed).length;
  },

  getTotalUnreviewedCount: () => {
    let total = 0;
    for (const changes of get().pendingChanges.values()) {
      total += changes.filter((c) => !c.reviewed).length;
    }
    return total;
  },

  // Modal actions
  openReview: (sessionId, fileIndex = 0) => {
    set({
      isModalOpen: true,
      activeSessionId: sessionId,
      currentFileIndex: fileIndex,
      currentDiff: null,
      editedContent: null,
      hasUnsavedChanges: false,
      error: null,
    });
  },

  closeReview: () => {
    set({
      isModalOpen: false,
      activeSessionId: null,
      currentFileIndex: 0,
      currentDiff: null,
      editedContent: null,
      hasUnsavedChanges: false,
      error: null,
    });
  },

  // Navigation actions
  navigateFile: (index) => {
    const state = get();
    if (!state.activeSessionId) return;

    const changes = state.pendingChanges.get(state.activeSessionId) || [];
    if (index < 0 || index >= changes.length) return;

    set({
      currentFileIndex: index,
      currentDiff: null,
      editedContent: null,
      hasUnsavedChanges: false,
      error: null,
    });
  },

  navigateNext: () => {
    const state = get();
    if (!state.activeSessionId) return;

    const changes = state.pendingChanges.get(state.activeSessionId) || [];
    const nextIndex = state.currentFileIndex + 1;
    if (nextIndex < changes.length) {
      get().navigateFile(nextIndex);
    }
  },

  navigatePrevious: () => {
    const state = get();
    const prevIndex = state.currentFileIndex - 1;
    if (prevIndex >= 0) {
      get().navigateFile(prevIndex);
    }
  },

  // Diff actions
  setCurrentDiff: (diff) => {
    set({
      currentDiff: diff,
      editedContent: diff?.modifiedContent || null,
    });
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  setError: (error) => {
    set({ error });
  },

  // Editing actions
  setEditedContent: (content) => {
    const state = get();
    const hasChanges = content !== state.currentDiff?.modifiedContent;
    set({ editedContent: content, hasUnsavedChanges: hasChanges });
  },

  markUnsavedChanges: (hasChanges) => {
    set({ hasUnsavedChanges: hasChanges });
  },

  // Review actions
  markAsReviewed: (sessionId, filePath) => {
    set((state) => {
      const newChanges = new Map(state.pendingChanges);
      const sessionChanges = newChanges.get(sessionId) || [];
      const updated = sessionChanges.map((c) =>
        c.filePath === filePath ? { ...c, reviewed: true } : c
      );
      newChanges.set(sessionId, updated);
      return { pendingChanges: newChanges };
    });
  },

  markCurrentAsReviewed: () => {
    const state = get();
    if (!state.activeSessionId || !state.currentDiff) return;

    get().markAsReviewed(state.activeSessionId, state.currentDiff.filePath);
  },

  // File operation actions
  saveCurrentFile: async () => {
    const state = get();
    if (!state.activeSessionId || !state.currentDiff || state.editedContent === null) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const result = await window.terminalIDE.fileReview.saveFile(
        state.activeSessionId,
        state.currentDiff.filePath,
        state.editedContent
      );

      if (result.success) {
        set({ hasUnsavedChanges: false });
        // Refresh the diff to show updated state
        await get().refreshCurrentDiff();
      } else {
        set({ error: result.error || 'Failed to save file' });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to save file' });
    } finally {
      set({ isLoading: false });
    }
  },

  revertCurrentFile: async () => {
    const state = get();
    if (!state.activeSessionId || !state.currentDiff) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const result = await window.terminalIDE.fileReview.revertFile(
        state.activeSessionId,
        state.currentDiff.filePath
      );

      if (result.success) {
        set({ hasUnsavedChanges: false });
        // Refresh the diff to show updated state
        await get().refreshCurrentDiff();
      } else {
        set({ error: result.error || 'Failed to revert file' });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to revert file' });
    } finally {
      set({ isLoading: false });
    }
  },

  refreshCurrentDiff: async () => {
    const state = get();
    if (!state.activeSessionId) return;

    const changes = state.pendingChanges.get(state.activeSessionId) || [];
    const currentChange = changes[state.currentFileIndex];
    if (!currentChange) return;

    set({ isLoading: true, error: null });

    try {
      const result = await window.terminalIDE.fileReview.getDiff(
        state.activeSessionId,
        currentChange.filePath
      );

      if (result.success && result.diff) {
        set({
          currentDiff: result.diff,
          editedContent: result.diff.modifiedContent,
          hasUnsavedChanges: false,
        });
      } else {
        set({ error: result.error || 'Failed to load diff' });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load diff' });
    } finally {
      set({ isLoading: false });
    }
  },
}));

import { create } from 'zustand';
import type {
  GitStatus,
  GitStatusFile,
  GitBranch,
  GitLogEntry,
  GitStash,
} from '../../shared/types/git';

type GitPanelTab = 'changes' | 'branches' | 'history' | 'stashes';

interface GitStore {
  // Panel state
  isPanelOpen: boolean;
  activeTab: GitPanelTab;

  // Git state
  status: GitStatus | null;
  branches: GitBranch[];
  currentBranch: string | null;
  commits: GitLogEntry[];
  stashes: GitStash[];

  // Selection state
  selectedFiles: Set<string>;

  // Loading states
  isLoading: boolean;
  isStatusLoading: boolean;
  isBranchesLoading: boolean;
  isCommitsLoading: boolean;
  isStashesLoading: boolean;

  // Operation states
  isCommitting: boolean;
  isPushing: boolean;
  isPulling: boolean;

  // Error state
  error: string | null;

  // Commit message
  commitMessage: string;

  // Actions - Panel
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  setActiveTab: (tab: GitPanelTab) => void;

  // Actions - Status
  setStatus: (status: GitStatus | null) => void;
  setStatusLoading: (loading: boolean) => void;
  refreshStatus: (repoPath: string) => Promise<void>;

  // Actions - Stage/Unstage
  stageFiles: (repoPath: string, paths: string[]) => Promise<boolean>;
  unstageFiles: (repoPath: string, paths: string[]) => Promise<boolean>;
  stageAll: (repoPath: string) => Promise<boolean>;
  unstageAll: (repoPath: string) => Promise<boolean>;
  discardChanges: (repoPath: string, paths: string[]) => Promise<boolean>;

  // Actions - Commit
  setCommitMessage: (message: string) => void;
  commit: (repoPath: string) => Promise<boolean>;

  // Actions - Push/Pull
  push: (repoPath: string, setUpstream?: boolean) => Promise<boolean>;
  pull: (repoPath: string, rebase?: boolean) => Promise<boolean>;
  fetch: (repoPath: string) => Promise<boolean>;

  // Actions - Branches
  setBranches: (branches: GitBranch[], current?: string) => void;
  setBranchesLoading: (loading: boolean) => void;
  refreshBranches: (repoPath: string) => Promise<void>;
  createBranch: (repoPath: string, name: string, checkout?: boolean) => Promise<boolean>;
  deleteBranch: (repoPath: string, name: string, force?: boolean) => Promise<boolean>;
  checkout: (repoPath: string, target: string) => Promise<boolean>;

  // Actions - History
  setCommits: (commits: GitLogEntry[]) => void;
  setCommitsLoading: (loading: boolean) => void;
  refreshCommits: (repoPath: string, branch?: string) => Promise<void>;
  loadMoreCommits: (repoPath: string, branch?: string) => Promise<void>;

  // Actions - Stashes
  setStashes: (stashes: GitStash[]) => void;
  setStashesLoading: (loading: boolean) => void;
  refreshStashes: (repoPath: string) => Promise<void>;
  createStash: (repoPath: string, message?: string, includeUntracked?: boolean) => Promise<boolean>;
  applyStash: (repoPath: string, index: number, pop?: boolean) => Promise<boolean>;
  dropStash: (repoPath: string, index: number) => Promise<boolean>;

  // Actions - Selection
  selectFile: (path: string) => void;
  deselectFile: (path: string) => void;
  toggleFileSelection: (path: string) => void;
  selectAllFiles: () => void;
  deselectAllFiles: () => void;

  // Actions - Error
  setError: (error: string | null) => void;
  clearError: () => void;

  // Actions - Reset
  reset: () => void;
}

const initialState = {
  isPanelOpen: false,
  activeTab: 'changes' as GitPanelTab,
  status: null,
  branches: [],
  currentBranch: null,
  commits: [],
  stashes: [],
  selectedFiles: new Set<string>(),
  isLoading: false,
  isStatusLoading: false,
  isBranchesLoading: false,
  isCommitsLoading: false,
  isStashesLoading: false,
  isCommitting: false,
  isPushing: false,
  isPulling: false,
  error: null,
  commitMessage: '',
};

export const useGitStore = create<GitStore>((set, get) => ({
  ...initialState,

  // Panel actions
  openPanel: () => set({ isPanelOpen: true }),
  closePanel: () => set({ isPanelOpen: false }),
  togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Status actions
  setStatus: (status) => set({ status }),
  setStatusLoading: (loading) => set({ isStatusLoading: loading }),

  refreshStatus: async (repoPath) => {
    set({ isStatusLoading: true, error: null });
    try {
      const result = await window.terminalIDE.git.getStatus(repoPath);
      if (result.success && result.status) {
        set({ status: result.status });
      } else {
        set({ error: result.error || 'Failed to get git status' });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to get git status' });
    } finally {
      set({ isStatusLoading: false });
    }
  },

  // Stage/Unstage actions
  stageFiles: async (repoPath, paths) => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.terminalIDE.git.stage(repoPath, paths);
      if (result.success) {
        await get().refreshStatus(repoPath);
        return true;
      } else {
        set({ error: result.error || 'Failed to stage files' });
        return false;
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to stage files' });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  unstageFiles: async (repoPath, paths) => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.terminalIDE.git.unstage(repoPath, paths);
      if (result.success) {
        await get().refreshStatus(repoPath);
        return true;
      } else {
        set({ error: result.error || 'Failed to unstage files' });
        return false;
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to unstage files' });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  stageAll: async (repoPath) => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.terminalIDE.git.stageAll(repoPath);
      if (result.success) {
        await get().refreshStatus(repoPath);
        return true;
      } else {
        set({ error: result.error || 'Failed to stage all files' });
        return false;
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to stage all files' });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  unstageAll: async (repoPath) => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.terminalIDE.git.unstageAll(repoPath);
      if (result.success) {
        await get().refreshStatus(repoPath);
        return true;
      } else {
        set({ error: result.error || 'Failed to unstage all files' });
        return false;
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to unstage all files' });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  discardChanges: async (repoPath, paths) => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.terminalIDE.git.discard(repoPath, paths);
      if (result.success) {
        await get().refreshStatus(repoPath);
        return true;
      } else {
        set({ error: result.error || 'Failed to discard changes' });
        return false;
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to discard changes' });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  // Commit actions
  setCommitMessage: (message) => set({ commitMessage: message }),

  commit: async (repoPath) => {
    const { commitMessage } = get();
    if (!commitMessage.trim()) {
      set({ error: 'Commit message is required' });
      return false;
    }

    set({ isCommitting: true, error: null });
    try {
      const result = await window.terminalIDE.git.commit(repoPath, commitMessage);
      if (result.success) {
        set({ commitMessage: '' });
        await get().refreshStatus(repoPath);
        await get().refreshCommits(repoPath);
        return true;
      } else {
        set({ error: result.error || 'Failed to commit' });
        return false;
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to commit' });
      return false;
    } finally {
      set({ isCommitting: false });
    }
  },

  // Push/Pull actions
  push: async (repoPath, setUpstream = false) => {
    set({ isPushing: true, error: null });
    try {
      const result = await window.terminalIDE.git.push(
        repoPath,
        undefined,
        undefined,
        false,
        setUpstream
      );
      if (result.success) {
        await get().refreshStatus(repoPath);
        return true;
      } else {
        set({ error: result.error || 'Failed to push' });
        return false;
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to push' });
      return false;
    } finally {
      set({ isPushing: false });
    }
  },

  pull: async (repoPath, rebase = false) => {
    set({ isPulling: true, error: null });
    try {
      const result = await window.terminalIDE.git.pull(repoPath, undefined, undefined, rebase);
      if (result.success) {
        await get().refreshStatus(repoPath);
        await get().refreshCommits(repoPath);
        return true;
      } else {
        set({ error: result.error || 'Failed to pull' });
        return false;
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to pull' });
      return false;
    } finally {
      set({ isPulling: false });
    }
  },

  fetch: async (repoPath) => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.terminalIDE.git.fetch(repoPath);
      if (result.success) {
        await get().refreshStatus(repoPath);
        await get().refreshBranches(repoPath);
        return true;
      } else {
        set({ error: result.error || 'Failed to fetch' });
        return false;
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch' });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  // Branch actions
  setBranches: (branches, current) => set({ branches, currentBranch: current || null }),
  setBranchesLoading: (loading) => set({ isBranchesLoading: loading }),

  refreshBranches: async (repoPath) => {
    set({ isBranchesLoading: true, error: null });
    try {
      const result = await window.terminalIDE.git.getBranches(repoPath, true);
      if (result.success && result.branches) {
        set({ branches: result.branches, currentBranch: result.current || null });
      } else {
        set({ error: result.error || 'Failed to get branches' });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to get branches' });
    } finally {
      set({ isBranchesLoading: false });
    }
  },

  createBranch: async (repoPath, name, checkout = true) => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.terminalIDE.git.createBranch(repoPath, name, undefined, checkout);
      if (result.success) {
        await get().refreshBranches(repoPath);
        if (checkout) {
          await get().refreshStatus(repoPath);
        }
        return true;
      } else {
        set({ error: result.error || 'Failed to create branch' });
        return false;
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create branch' });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteBranch: async (repoPath, name, force = false) => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.terminalIDE.git.deleteBranch(repoPath, name, force);
      if (result.success) {
        await get().refreshBranches(repoPath);
        return true;
      } else {
        set({ error: result.error || 'Failed to delete branch' });
        return false;
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete branch' });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  checkout: async (repoPath, target) => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.terminalIDE.git.checkout(repoPath, target);
      if (result.success) {
        await get().refreshStatus(repoPath);
        await get().refreshBranches(repoPath);
        await get().refreshCommits(repoPath);
        return true;
      } else {
        set({ error: result.error || 'Failed to checkout' });
        return false;
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to checkout' });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  // History actions
  setCommits: (commits) => set({ commits }),
  setCommitsLoading: (loading) => set({ isCommitsLoading: loading }),

  refreshCommits: async (repoPath, branch) => {
    set({ isCommitsLoading: true, error: null });
    try {
      const result = await window.terminalIDE.git.getLog(repoPath, 50, 0, branch);
      if (result.success && result.commits) {
        set({ commits: result.commits });
      } else {
        set({ error: result.error || 'Failed to get commits' });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to get commits' });
    } finally {
      set({ isCommitsLoading: false });
    }
  },

  loadMoreCommits: async (repoPath, branch) => {
    const { commits, isCommitsLoading } = get();
    if (isCommitsLoading) return;

    set({ isCommitsLoading: true, error: null });
    try {
      const result = await window.terminalIDE.git.getLog(repoPath, 50, commits.length, branch);
      if (result.success && result.commits) {
        set({ commits: [...commits, ...result.commits] });
      } else {
        set({ error: result.error || 'Failed to load more commits' });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load more commits' });
    } finally {
      set({ isCommitsLoading: false });
    }
  },

  // Stash actions
  setStashes: (stashes) => set({ stashes }),
  setStashesLoading: (loading) => set({ isStashesLoading: loading }),

  refreshStashes: async (repoPath) => {
    set({ isStashesLoading: true, error: null });
    try {
      const result = await window.terminalIDE.git.getStashes(repoPath);
      if (result.success && result.stashes) {
        set({ stashes: result.stashes });
      } else {
        set({ error: result.error || 'Failed to get stashes' });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to get stashes' });
    } finally {
      set({ isStashesLoading: false });
    }
  },

  createStash: async (repoPath, message, includeUntracked = false) => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.terminalIDE.git.stash(repoPath, message, includeUntracked);
      if (result.success) {
        await get().refreshStatus(repoPath);
        await get().refreshStashes(repoPath);
        return true;
      } else {
        set({ error: result.error || 'Failed to create stash' });
        return false;
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create stash' });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  applyStash: async (repoPath, index, pop = false) => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.terminalIDE.git.stashApply(repoPath, index, pop);
      if (result.success) {
        await get().refreshStatus(repoPath);
        if (pop) {
          await get().refreshStashes(repoPath);
        }
        return true;
      } else {
        set({ error: result.error || 'Failed to apply stash' });
        return false;
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to apply stash' });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  dropStash: async (repoPath, index) => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.terminalIDE.git.stashDrop(repoPath, index);
      if (result.success) {
        await get().refreshStashes(repoPath);
        return true;
      } else {
        set({ error: result.error || 'Failed to drop stash' });
        return false;
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to drop stash' });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  // Selection actions
  selectFile: (path) => set((state) => {
    const newSelected = new Set(state.selectedFiles);
    newSelected.add(path);
    return { selectedFiles: newSelected };
  }),

  deselectFile: (path) => set((state) => {
    const newSelected = new Set(state.selectedFiles);
    newSelected.delete(path);
    return { selectedFiles: newSelected };
  }),

  toggleFileSelection: (path) => set((state) => {
    const newSelected = new Set(state.selectedFiles);
    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }
    return { selectedFiles: newSelected };
  }),

  selectAllFiles: () => set((state) => {
    const allPaths = state.status?.files.map(f => f.path) || [];
    return { selectedFiles: new Set(allPaths) };
  }),

  deselectAllFiles: () => set({ selectedFiles: new Set() }),

  // Error actions
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  // Reset
  reset: () => set(initialState),
}));

import { create } from 'zustand';

interface QuickChatStore {
  // State
  isOpen: boolean;
  isRunning: boolean;
  selectedAgentId: string | null;
  prompt: string;
  output: string;
  error: string | null;

  // Actions
  open: () => void;
  close: () => void;
  setAgent: (agentId: string) => void;
  setPrompt: (prompt: string) => void;
  appendOutput: (data: string) => void;
  clearOutput: () => void;
  setRunning: (running: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useQuickChatStore = create<QuickChatStore>((set) => ({
  // Initial state
  isOpen: false,
  isRunning: false,
  selectedAgentId: null,
  prompt: '',
  output: '',
  error: null,

  // Actions
  open: () => set({ isOpen: true }),

  close: () => set({ isOpen: false }),

  setAgent: (agentId: string) => set({ selectedAgentId: agentId }),

  setPrompt: (prompt: string) => set({ prompt }),

  appendOutput: (data: string) => set((state) => ({ output: state.output + data })),

  clearOutput: () => set({ output: '' }),

  setRunning: (running: boolean) => set({ isRunning: running }),

  setError: (error: string | null) => set({ error }),

  reset: () => set({
    isRunning: false,
    prompt: '',
    output: '',
    error: null,
  }),
}));

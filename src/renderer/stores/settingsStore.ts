import { create } from 'zustand';
import type { Settings, PartialSettings } from '../../shared/types/settings';
import { DEFAULT_SETTINGS } from '../../shared/types/settings';

interface SettingsStore {
  settings: Settings;
  loading: boolean;

  // Load settings from main process
  loadSettings: () => Promise<void>;

  // Update settings via IPC
  updateSettings: (partial: PartialSettings) => Promise<void>;

  // Reset to defaults
  resetSettings: () => Promise<void>;

  // Sync from IPC event (internal use)
  setSettings: (settings: Settings) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: DEFAULT_SETTINGS,
  loading: true,

  loadSettings: async () => {
    try {
      const settings = await window.terminalIDE.settings.get();
      set({ settings, loading: false });
    } catch (error) {
      console.error('Failed to load settings:', error);
      set({ loading: false });
    }
  },

  updateSettings: async (partial: PartialSettings) => {
    try {
      const settings = await window.terminalIDE.settings.update(partial);
      set({ settings });
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  },

  resetSettings: async () => {
    try {
      const settings = await window.terminalIDE.settings.reset();
      set({ settings });
    } catch (error) {
      console.error('Failed to reset settings:', error);
    }
  },

  setSettings: (settings: Settings) => {
    set({ settings });
  },
}));

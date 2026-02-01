import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';
import type { Settings, PartialSettings } from '../../shared/types/settings';
import { DEFAULT_SETTINGS } from '../../shared/types/settings';
import { eventBus, Events } from './EventBus';

export class SettingsService {
  private filePath: string;
  private settings: Settings;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.filePath = path.join(userDataPath, 'terminal-ide-settings.json');
    this.settings = { ...DEFAULT_SETTINGS };
  }

  async initialize(): Promise<void> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const loaded = JSON.parse(content) as Settings;
      this.settings = this.mergeWithDefaults(loaded);
    } catch {
      // File doesn't exist or is invalid, use defaults
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  get(): Settings {
    return { ...this.settings };
  }

  async update(partial: PartialSettings): Promise<Settings> {
    // Merge partial settings
    if (partial.grid) {
      this.settings = {
        ...this.settings,
        grid: {
          ...this.settings.grid,
          ...partial.grid,
        },
      };
    }

    if (partial.restoreSessionsOnStartup !== undefined) {
      this.settings = {
        ...this.settings,
        restoreSessionsOnStartup: partial.restoreSessionsOnStartup,
      };
    }

    // Save to disk
    await this.save();

    // Emit event for listeners
    eventBus.emit(Events.SETTINGS_UPDATED, { settings: this.settings });

    return { ...this.settings };
  }

  async reset(): Promise<Settings> {
    this.settings = { ...DEFAULT_SETTINGS };
    await this.save();
    eventBus.emit(Events.SETTINGS_UPDATED, { settings: this.settings });
    return { ...this.settings };
  }

  private async save(): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.filePath, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  private mergeWithDefaults(loaded: Partial<Settings>): Settings {
    return {
      version: DEFAULT_SETTINGS.version,
      grid: {
        defaultRows: loaded.grid?.defaultRows ?? DEFAULT_SETTINGS.grid.defaultRows,
        defaultCols: loaded.grid?.defaultCols ?? DEFAULT_SETTINGS.grid.defaultCols,
      },
      restoreSessionsOnStartup: loaded.restoreSessionsOnStartup ?? DEFAULT_SETTINGS.restoreSessionsOnStartup,
    };
  }
}

// Singleton instance
export const settingsService = new SettingsService();

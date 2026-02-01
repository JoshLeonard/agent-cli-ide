import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';
import type { SessionInfo } from '../../shared/types/session';
import type { PersistedLayoutState, GridLayoutState, GridConfig, TerminalPanel } from '../../shared/types/layout';
import { isGridLayoutState } from '../../shared/types/layout';

export interface PersistedState {
  sessions: SessionInfo[];
  layout: PersistedLayoutState;
  lastSaved: number;
}

export interface ExtendedPersistedState extends PersistedState {
  projectPath?: string;
}

// Default grid configuration
const DEFAULT_GRID_CONFIG: GridConfig = {
  rows: 2,
  cols: 5,
};

export class PersistenceService {
  private filePath: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.filePath = path.join(userDataPath, 'terminal-ide-state.json');
  }

  async save(sessions: SessionInfo[], layout: PersistedLayoutState, projectPath?: string): Promise<void> {
    const state: ExtendedPersistedState = {
      sessions: sessions.filter((s) => s.status !== 'terminated'),
      layout,
      lastSaved: Date.now(),
      projectPath,
    };

    try {
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.filePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  }

  async load(): Promise<ExtendedPersistedState | null> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const state = JSON.parse(content) as ExtendedPersistedState;

      // Ensure layout has proper structure
      if (state.layout) {
        // Return as-is, migration handled by frontend
        return state;
      }

      return state;
    } catch {
      return null;
    }
  }

  async saveProjectPath(projectPath: string | undefined): Promise<void> {
    const existing = await this.load();
    const defaultLayout: GridLayoutState = {
      version: 3,
      config: DEFAULT_GRID_CONFIG,
      panels: this.createDefaultPanels(DEFAULT_GRID_CONFIG),
    };
    await this.save(existing?.sessions || [], existing?.layout || defaultLayout, projectPath);
  }

  async loadProjectPath(): Promise<string | undefined> {
    const state = await this.load();
    return state?.projectPath;
  }

  async saveLayout(layout: PersistedLayoutState): Promise<void> {
    const existing = await this.load();
    await this.save(existing?.sessions || [], layout);
  }

  async loadLayout(): Promise<PersistedLayoutState | null> {
    const state = await this.load();
    return state?.layout || null;
  }

  async clear(): Promise<void> {
    try {
      await fs.unlink(this.filePath);
    } catch {
      // File doesn't exist
    }
  }

  private createDefaultPanels(config: GridConfig): TerminalPanel[] {
    const panels: TerminalPanel[] = [];
    const count = config.rows * config.cols;
    for (let i = 0; i < count; i++) {
      panels.push({
        type: 'panel',
        id: `panel-${i}-${Date.now()}`,
        sessionId: null,
      });
    }
    return panels;
  }
}

// Singleton instance
export const persistenceService = new PersistenceService();

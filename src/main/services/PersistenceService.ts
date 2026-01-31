import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';
import type { SessionInfo, LayoutState, PersistedState } from '../../shared/types/session';

export interface ExtendedPersistedState extends PersistedState {
  projectPath?: string;
}

export class PersistenceService {
  private filePath: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.filePath = path.join(userDataPath, 'terminal-ide-state.json');
  }

  async save(sessions: SessionInfo[], layout: LayoutState, projectPath?: string): Promise<void> {
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
      return JSON.parse(content) as ExtendedPersistedState;
    } catch {
      return null;
    }
  }

  async saveProjectPath(projectPath: string | undefined): Promise<void> {
    const existing = await this.load();
    await this.save(existing?.sessions || [], existing?.layout || { panes: [], rows: 1, cols: 1 }, projectPath);
  }

  async loadProjectPath(): Promise<string | undefined> {
    const state = await this.load();
    return state?.projectPath;
  }

  async saveLayout(layout: LayoutState): Promise<void> {
    const existing = await this.load();
    await this.save(existing?.sessions || [], layout);
  }

  async loadLayout(): Promise<LayoutState | null> {
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
}

// Singleton instance
export const persistenceService = new PersistenceService();

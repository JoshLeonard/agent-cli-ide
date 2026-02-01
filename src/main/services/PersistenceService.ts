import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';
import type { SessionInfo } from '../../shared/types/session';
import type { PersistedLayoutState, GridLayoutState, GridConfig, TerminalPanel } from '../../shared/types/layout';
import { isGridLayoutState } from '../../shared/types/layout';
import type { PersistedState, RecentProject } from '../../shared/types/ipc';

const MAX_RECENT_PROJECTS = 10;

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
    const existing = await this.load();
    const state: PersistedState = {
      sessions: sessions.filter((s) => s.status === 'running' || s.status === 'initializing'),
      layout,
      lastSaved: Date.now(),
      projectPath: projectPath ?? existing?.projectPath,
      recentProjects: existing?.recentProjects,
      worktreeAgentPrefs: existing?.worktreeAgentPrefs,
    };

    try {
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.filePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  }

  async load(): Promise<PersistedState | null> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const state = JSON.parse(content) as PersistedState;

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

  async addRecentProject(project: RecentProject): Promise<void> {
    const existing = await this.load();
    let recentProjects = existing?.recentProjects || [];

    // Remove duplicate if exists (will be re-added at top)
    recentProjects = recentProjects.filter((p) => p.path !== project.path);

    // Add new project at the beginning
    recentProjects.unshift(project);

    // Limit to max recent projects
    recentProjects = recentProjects.slice(0, MAX_RECENT_PROJECTS);

    // Save updated state
    const defaultLayout: GridLayoutState = {
      version: 3,
      config: { rows: 2, cols: 5 },
      panels: this.createDefaultPanels({ rows: 2, cols: 5 }),
    };

    const state: PersistedState = {
      sessions: existing?.sessions || [],
      layout: existing?.layout || defaultLayout,
      lastSaved: Date.now(),
      projectPath: existing?.projectPath,
      recentProjects,
    };

    try {
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.filePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save recent projects:', error);
    }
  }

  async getRecentProjects(): Promise<RecentProject[]> {
    const state = await this.load();
    return state?.recentProjects || [];
  }

  async getWorktreeAgentPrefs(): Promise<Record<string, string>> {
    const state = await this.load();
    return state?.worktreeAgentPrefs || {};
  }

  async setWorktreeAgentPref(worktreePath: string, agentId: string): Promise<void> {
    const existing = await this.load();
    const defaultLayout: GridLayoutState = {
      version: 3,
      config: DEFAULT_GRID_CONFIG,
      panels: this.createDefaultPanels(DEFAULT_GRID_CONFIG),
    };

    const worktreeAgentPrefs = existing?.worktreeAgentPrefs || {};
    worktreeAgentPrefs[worktreePath] = agentId;

    const state: PersistedState = {
      sessions: existing?.sessions || [],
      layout: existing?.layout || defaultLayout,
      lastSaved: Date.now(),
      projectPath: existing?.projectPath,
      recentProjects: existing?.recentProjects,
      worktreeAgentPrefs,
    };

    try {
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.filePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save worktree agent preference:', error);
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

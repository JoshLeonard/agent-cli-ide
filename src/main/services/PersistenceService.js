import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';
const MAX_RECENT_PROJECTS = 10;
// Default grid configuration
const DEFAULT_GRID_CONFIG = {
    rows: 2,
    cols: 5,
};
export class PersistenceService {
    filePath;
    constructor() {
        const userDataPath = app.getPath('userData');
        this.filePath = path.join(userDataPath, 'terminal-ide-state.json');
    }
    async save(sessions, layout, projectPath) {
        const existing = await this.load();
        const state = {
            sessions: sessions.filter((s) => s.status !== 'terminated'),
            layout,
            lastSaved: Date.now(),
            projectPath,
            recentProjects: existing?.recentProjects,
        };
        try {
            const dir = path.dirname(this.filePath);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(this.filePath, JSON.stringify(state, null, 2), 'utf-8');
        }
        catch (error) {
            console.error('Failed to save state:', error);
        }
    }
    async load() {
        try {
            const content = await fs.readFile(this.filePath, 'utf-8');
            const state = JSON.parse(content);
            // Ensure layout has proper structure
            if (state.layout) {
                // Return as-is, migration handled by frontend
                return state;
            }
            return state;
        }
        catch {
            return null;
        }
    }
    async saveProjectPath(projectPath) {
        const existing = await this.load();
        const defaultLayout = {
            version: 3,
            config: DEFAULT_GRID_CONFIG,
            panels: this.createDefaultPanels(DEFAULT_GRID_CONFIG),
        };
        await this.save(existing?.sessions || [], existing?.layout || defaultLayout, projectPath);
    }
    async loadProjectPath() {
        const state = await this.load();
        return state?.projectPath;
    }
    async saveLayout(layout) {
        const existing = await this.load();
        await this.save(existing?.sessions || [], layout);
    }
    async loadLayout() {
        const state = await this.load();
        return state?.layout || null;
    }
    async clear() {
        try {
            await fs.unlink(this.filePath);
        }
        catch {
            // File doesn't exist
        }
    }
    async addRecentProject(project) {
        const existing = await this.load();
        let recentProjects = existing?.recentProjects || [];
        // Remove duplicate if exists (will be re-added at top)
        recentProjects = recentProjects.filter((p) => p.path !== project.path);
        // Add new project at the beginning
        recentProjects.unshift(project);
        // Limit to max recent projects
        recentProjects = recentProjects.slice(0, MAX_RECENT_PROJECTS);
        // Save updated state
        const defaultLayout = {
            version: 3,
            config: { rows: 2, cols: 5 },
            panels: this.createDefaultPanels({ rows: 2, cols: 5 }),
        };
        const state = {
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
        }
        catch (error) {
            console.error('Failed to save recent projects:', error);
        }
    }
    async getRecentProjects() {
        const state = await this.load();
        return state?.recentProjects || [];
    }
    createDefaultPanels(config) {
        const panels = [];
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
//# sourceMappingURL=PersistenceService.js.map
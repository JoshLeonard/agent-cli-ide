import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { eventBus } from './EventBus';
import { persistenceService } from './PersistenceService';
export const Events = {
    PROJECT_UPDATED: 'project:updated',
};
export class ProjectService {
    currentProject = null;
    pollInterval = null;
    POLL_INTERVAL_MS = 5000;
    async openProject(projectPath) {
        try {
            // Verify path exists and is a directory
            const stats = await fs.stat(projectPath);
            if (!stats.isDirectory()) {
                return { success: false, error: 'Path is not a directory' };
            }
            const isGitRepo = await this.isGitRepository(projectPath);
            const gitBranch = isGitRepo ? await this.getGitBranch(projectPath) : undefined;
            this.currentProject = {
                path: projectPath,
                name: path.basename(projectPath),
                isGitRepo,
                gitBranch,
            };
            // Save project path for persistence
            await persistenceService.saveProjectPath(projectPath);
            // Add to recent projects
            await persistenceService.addRecentProject({
                path: projectPath,
                name: this.currentProject.name,
                lastOpened: Date.now(),
            });
            // Start polling for branch changes
            this.startPolling();
            return { success: true, project: this.currentProject };
        }
        catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }
    async closeProject() {
        this.stopPolling();
        this.currentProject = null;
        await persistenceService.saveProjectPath(undefined);
        return { success: true };
    }
    async restoreProject() {
        const projectPath = await persistenceService.loadProjectPath();
        if (!projectPath)
            return null;
        // Verify path still exists
        try {
            const stats = await fs.stat(projectPath);
            if (!stats.isDirectory())
                return null;
        }
        catch {
            return null;
        }
        const result = await this.openProject(projectPath);
        return result.success ? result.project || null : null;
    }
    getCurrentProject() {
        return this.currentProject;
    }
    async isGitRepository(projectPath) {
        try {
            const gitDir = path.join(projectPath, '.git');
            const stats = await fs.stat(gitDir);
            return stats.isDirectory() || stats.isFile(); // .git can be a file in worktrees
        }
        catch {
            return false;
        }
    }
    getGitBranch(projectPath) {
        return new Promise((resolve) => {
            const git = spawn('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
                cwd: projectPath,
                shell: true,
            });
            let output = '';
            git.stdout.on('data', (data) => {
                output += data.toString();
            });
            git.on('close', (code) => {
                if (code === 0) {
                    resolve(output.trim());
                }
                else {
                    resolve(undefined);
                }
            });
            git.on('error', () => {
                resolve(undefined);
            });
        });
    }
    startPolling() {
        this.stopPolling();
        this.pollInterval = setInterval(async () => {
            if (!this.currentProject || !this.currentProject.isGitRepo)
                return;
            const newBranch = await this.getGitBranch(this.currentProject.path);
            if (newBranch !== this.currentProject.gitBranch) {
                this.currentProject = {
                    ...this.currentProject,
                    gitBranch: newBranch,
                };
                eventBus.emit(Events.PROJECT_UPDATED, { project: this.currentProject });
            }
        }, this.POLL_INTERVAL_MS);
    }
    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }
    dispose() {
        this.stopPolling();
    }
}
// Singleton instance
export const projectService = new ProjectService();
//# sourceMappingURL=ProjectService.js.map
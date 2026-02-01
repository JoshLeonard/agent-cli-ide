import * as fs from 'fs';
import * as path from 'path';
import { eventBus, Events } from './EventBus';

export class WorktreeWatcherService {
  private watcher: fs.FSWatcher | null = null;
  private gitWatcher: fs.FSWatcher | null = null;
  private currentProjectPath: string | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_MS = 500;

  /**
   * Start watching the .git/worktrees directory for changes
   */
  watchProject(projectPath: string): void {
    // Stop any existing watcher
    this.stopWatching();

    this.currentProjectPath = projectPath;

    const gitDir = path.join(projectPath, '.git');
    const worktreesDir = path.join(gitDir, 'worktrees');

    // Check if .git exists (is a git repo)
    if (!fs.existsSync(gitDir) || !fs.statSync(gitDir).isDirectory()) {
      // Not a git repo, skip watching
      return;
    }

    // If worktrees directory exists, watch it directly
    if (fs.existsSync(worktreesDir)) {
      this.watchWorktreesDir(worktreesDir, projectPath);
    } else {
      // Watch .git directory for creation of worktrees folder
      this.watchGitDirForWorktrees(gitDir, projectPath);
    }
  }

  /**
   * Watch the .git/worktrees directory for changes
   */
  private watchWorktreesDir(worktreesDir: string, projectPath: string): void {
    try {
      this.watcher = fs.watch(worktreesDir, { persistent: false }, (eventType, filename) => {
        this.handleChange(projectPath);
      });

      this.watcher.on('error', (error) => {
        console.error('Worktree watcher error:', error);
        this.stopWatching();
      });
    } catch (error) {
      console.error('Failed to watch worktrees directory:', error);
    }
  }

  /**
   * Watch .git directory for creation of worktrees folder
   */
  private watchGitDirForWorktrees(gitDir: string, projectPath: string): void {
    try {
      this.gitWatcher = fs.watch(gitDir, { persistent: false }, (eventType, filename) => {
        if (filename === 'worktrees') {
          const worktreesDir = path.join(gitDir, 'worktrees');
          if (fs.existsSync(worktreesDir)) {
            // Stop watching .git, start watching worktrees
            if (this.gitWatcher) {
              this.gitWatcher.close();
              this.gitWatcher = null;
            }
            this.watchWorktreesDir(worktreesDir, projectPath);
            this.handleChange(projectPath);
          }
        }
      });

      this.gitWatcher.on('error', (error) => {
        console.error('Git directory watcher error:', error);
        if (this.gitWatcher) {
          this.gitWatcher.close();
          this.gitWatcher = null;
        }
      });
    } catch (error) {
      console.error('Failed to watch git directory:', error);
    }
  }

  /**
   * Handle filesystem change with debouncing
   */
  private handleChange(projectPath: string): void {
    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Set new debounced timer
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      eventBus.emit(Events.WORKTREE_CHANGED, { projectPath });
    }, this.DEBOUNCE_MS);
  }

  /**
   * Stop watching the current project
   */
  stopWatching(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    if (this.gitWatcher) {
      this.gitWatcher.close();
      this.gitWatcher = null;
    }

    this.currentProjectPath = null;
  }

  /**
   * Shutdown the service
   */
  shutdown(): void {
    this.stopWatching();
  }
}

// Singleton instance
export const worktreeWatcherService = new WorktreeWatcherService();

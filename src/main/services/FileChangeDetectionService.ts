import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { eventBus, Events } from './EventBus';
import { activityFeedService } from './ActivityFeedService';
import { sessionRegistry } from './SessionRegistry';
import type { ActivityEvent, ActivityType } from '../../shared/types/activity';
import type { SessionInfo } from '../../shared/types/session';

// Patterns to ignore when watching files
const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  '.cache',
  '.turbo',
  '.vercel',
  '.output',
  '__pycache__',
  '.pytest_cache',
  'target',
  'out',
  '.idea',
  '.vscode',
];

// Debounce delay for file changes
const DEBOUNCE_MS = 300;

interface SessionWatcher {
  watcher: fs.FSWatcher;
  cwd: string;
  debounceTimers: Map<string, ReturnType<typeof setTimeout>>;
}

function execGit(cwd: string, args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn('git', args, { cwd, shell: true });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (exitCode) => {
      resolve({ stdout, stderr, exitCode: exitCode ?? 1 });
    });

    proc.on('error', (error) => {
      stderr = error.message;
      resolve({ stdout, stderr, exitCode: 1 });
    });
  });
}

function parseGitDiff(output: string): Array<{ path: string; type: ActivityType }> {
  if (!output.trim()) return [];

  return output
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status, ...pathParts] = line.split('\t');
      const filePath = pathParts.join('\t');
      const type: ActivityType =
        status[0] === 'A'
          ? 'file_created'
          : status[0] === 'D'
            ? 'file_deleted'
            : 'file_modified';
      return { path: filePath, type };
    });
}

function parseGitStatus(output: string): Array<{ path: string; type: ActivityType }> {
  if (!output.trim()) return [];

  const results: Array<{ path: string; type: ActivityType }> = [];

  for (const line of output.trim().split('\n')) {
    if (!line) continue;

    // git status --porcelain format: XY filename
    // X = status in staging area, Y = status in working tree
    const statusCode = line.substring(0, 2);
    const filePath = line.substring(3);

    // Skip directories (paths ending with /)
    if (filePath.endsWith('/')) {
      continue;
    }

    let type: ActivityType;
    if (statusCode.includes('?')) {
      type = 'file_created'; // Untracked file
    } else if (statusCode.includes('A')) {
      type = 'file_created';
    } else if (statusCode.includes('D')) {
      type = 'file_deleted';
    } else {
      type = 'file_modified';
    }

    results.push({ path: filePath, type });
  }

  return results;
}

function shouldIgnorePath(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return IGNORE_PATTERNS.some(
    (pattern) =>
      normalizedPath.includes(`/${pattern}/`) ||
      normalizedPath.startsWith(`${pattern}/`) ||
      normalizedPath === pattern
  );
}

export class FileChangeDetectionService {
  private sessionWatchers: Map<string, SessionWatcher> = new Map();
  private sessionCreatedSubscription: { unsubscribe: () => void } | null = null;
  private sessionTerminatedSubscription: { unsubscribe: () => void } | null = null;
  private initialized = false;

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Subscribe to session events
    this.sessionCreatedSubscription = eventBus.on<{ session: SessionInfo; hooksConfigured: boolean }>(
      Events.SESSION_CREATED,
      (data) => this.handleSessionCreated(data.session)
    );

    this.sessionTerminatedSubscription = eventBus.on<{ sessionId: string }>(
      Events.SESSION_TERMINATED,
      (data) => this.handleSessionTerminated(data.sessionId)
    );

    // Scan existing sessions after a delay to ensure renderer is ready
    // The renderer needs time to load and subscribe to events
    setTimeout(() => this.scanExistingSessions(), 2500);
  }

  private scanExistingSessions(): void {
    const sessions = sessionRegistry.listSessions();
    for (const session of sessions) {
      // Only scan running sessions that we haven't already set up a watcher for
      if (session.status === 'running' && !this.sessionWatchers.has(session.id)) {
        this.handleSessionCreated(session);
      }
    }
  }

  shutdown(): void {
    // Unsubscribe from events
    this.sessionCreatedSubscription?.unsubscribe();
    this.sessionTerminatedSubscription?.unsubscribe();

    // Close all watchers
    for (const [sessionId, watcher] of this.sessionWatchers) {
      this.cleanupWatcher(sessionId, watcher);
    }
    this.sessionWatchers.clear();

    this.initialized = false;
  }

  private async handleSessionCreated(session: SessionInfo): Promise<void> {
    const cwd = session.worktreePath || session.cwd;

    // Scan for existing changes via git
    await this.scanGitChanges(session.id, session.agentId, cwd);

    // Set up file watcher for this session
    this.setupWatcher(session.id, session.agentId, cwd);
  }

  private handleSessionTerminated(sessionId: string): void {
    const watcher = this.sessionWatchers.get(sessionId);
    if (watcher) {
      this.cleanupWatcher(sessionId, watcher);
      this.sessionWatchers.delete(sessionId);
    }
  }

  private cleanupWatcher(sessionId: string, watcher: SessionWatcher): void {
    // Clear all debounce timers
    for (const timer of watcher.debounceTimers.values()) {
      clearTimeout(timer);
    }
    watcher.debounceTimers.clear();

    // Close the file watcher
    try {
      watcher.watcher.close();
    } catch (error) {
      console.error(`Error closing watcher for session ${sessionId}:`, error);
    }
  }

  private async scanGitChanges(sessionId: string, agentId: string | undefined, cwd: string): Promise<void> {
    try {
      // Get tracked file changes
      const diffResult = await execGit(cwd, ['diff', '--name-status', 'HEAD']);
      const diffChanges = diffResult.exitCode === 0 ? parseGitDiff(diffResult.stdout) : [];

      // Get untracked files (-uall expands directories to show individual files)
      const statusResult = await execGit(cwd, ['status', '--porcelain', '-uall']);
      const statusChanges = statusResult.exitCode === 0 ? parseGitStatus(statusResult.stdout) : [];

      // Filter status changes to only include untracked files (avoid duplicates with diff)
      const untrackedChanges = statusChanges.filter(
        (change) => !diffChanges.some((d) => d.path === change.path)
      );

      // Combine all changes
      const allChanges = [...diffChanges, ...untrackedChanges];

      // Emit activity events for each changed file
      for (const change of allChanges) {
        if (shouldIgnorePath(change.path)) continue;

        const event: ActivityEvent = {
          id: uuidv4(),
          sessionId,
          agentId,
          type: change.type,
          severity: 'info',
          timestamp: Date.now(),
          title: this.getEventTitle(change.type, change.path),
          filePath: change.path,
        };

        activityFeedService.addEvent(event);
      }
    } catch (error) {
      console.error(`Error scanning git changes for session ${sessionId}:`, error);
    }
  }

  private setupWatcher(sessionId: string, agentId: string | undefined, cwd: string): void {
    try {
      const watcher = fs.watch(cwd, { recursive: true }, (eventType, filename) => {
        if (!filename) return;

        // Normalize the filename
        const normalizedFilename = filename.replace(/\\/g, '/');

        // Check if we should ignore this path
        if (shouldIgnorePath(normalizedFilename)) return;

        // Debounce per-file to prevent flooding
        this.handleFileChange(sessionId, agentId, cwd, normalizedFilename);
      });

      watcher.on('error', (error) => {
        console.error(`File watcher error for session ${sessionId}:`, error);
      });

      this.sessionWatchers.set(sessionId, {
        watcher,
        cwd,
        debounceTimers: new Map(),
      });
    } catch (error) {
      console.error(`Error setting up file watcher for session ${sessionId}:`, error);
    }
  }

  private handleFileChange(
    sessionId: string,
    agentId: string | undefined,
    cwd: string,
    filename: string
  ): void {
    const watcherInfo = this.sessionWatchers.get(sessionId);
    if (!watcherInfo) return;

    // Clear existing debounce timer for this file
    const existingTimer = watcherInfo.debounceTimers.get(filename);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounce timer
    const timer = setTimeout(async () => {
      watcherInfo.debounceTimers.delete(filename);
      await this.processFileChange(sessionId, agentId, cwd, filename);
    }, DEBOUNCE_MS);

    watcherInfo.debounceTimers.set(filename, timer);
  }

  private async processFileChange(
    sessionId: string,
    agentId: string | undefined,
    cwd: string,
    filename: string
  ): Promise<void> {
    try {
      // Check if this is actually a file (not a directory)
      // fs.watch reports directory changes when files inside them change
      const fullPath = path.join(cwd, filename);
      try {
        const stat = await fs.promises.stat(fullPath);
        if (stat.isDirectory()) {
          return; // Skip directories
        }
      } catch {
        // File might have been deleted, continue to check git status
      }

      // Use git status to determine the type of change
      const result = await execGit(cwd, ['status', '--porcelain', filename]);

      if (result.exitCode !== 0) {
        // Not a git repository or other error, skip
        return;
      }

      const statusLine = result.stdout.trim();
      if (!statusLine) {
        // No changes according to git (file might have been saved then reverted)
        return;
      }

      // Parse the status
      const statusCode = statusLine.substring(0, 2);
      let type: ActivityType;

      if (statusCode.includes('?')) {
        type = 'file_created';
      } else if (statusCode.includes('A')) {
        type = 'file_created';
      } else if (statusCode.includes('D')) {
        type = 'file_deleted';
      } else {
        type = 'file_modified';
      }

      const event: ActivityEvent = {
        id: uuidv4(),
        sessionId,
        agentId,
        type,
        severity: 'info',
        timestamp: Date.now(),
        title: this.getEventTitle(type, filename),
        filePath: filename,
      };

      activityFeedService.addEvent(event);
    } catch (error) {
      console.error(`Error processing file change for ${filename}:`, error);
    }
  }

  private getEventTitle(type: ActivityType, filePath: string): string {
    const basename = path.basename(filePath);
    switch (type) {
      case 'file_created':
        return `File created: ${basename}`;
      case 'file_deleted':
        return `File deleted: ${basename}`;
      case 'file_modified':
        return `File modified: ${basename}`;
      default:
        return `File changed: ${basename}`;
    }
  }
}

// Singleton instance
export const fileChangeDetectionService = new FileChangeDetectionService();

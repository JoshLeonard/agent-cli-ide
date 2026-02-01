import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { eventBus, Events } from './EventBus';
import type { AgentActivityState, HookStateEvent } from '../../shared/types/agentStatus';

interface WatchedSession {
  sessionId: string;
  watcher: fs.FSWatcher | null;
  pollInterval: ReturnType<typeof setInterval> | null;
  lastState: AgentActivityState | null;
  lastTimestamp: number;
}

interface StateFileData {
  state: AgentActivityState;
  timestamp: number;
}

export class HookStateWatcherService {
  private watchedSessions: Map<string, WatchedSession> = new Map();
  private stateDir: string;

  constructor() {
    this.stateDir = path.join(os.tmpdir(), 'terminal-ide-states');
  }

  initialize(): void {
    this.ensureStateDir();
  }

  shutdown(): void {
    for (const [sessionId] of this.watchedSessions) {
      this.unwatchSession(sessionId);
    }
    this.watchedSessions.clear();
  }

  private ensureStateDir(): void {
    if (!fs.existsSync(this.stateDir)) {
      fs.mkdirSync(this.stateDir, { recursive: true });
    }
  }

  private getStateFilePath(sessionId: string): string {
    return path.join(this.stateDir, `${sessionId}.json`);
  }

  watchSession(sessionId: string): void {
    if (this.watchedSessions.has(sessionId)) {
      return;
    }

    this.ensureStateDir();

    const stateFile = this.getStateFilePath(sessionId);
    const watchedSession: WatchedSession = {
      sessionId,
      watcher: null,
      pollInterval: null,
      lastState: null,
      lastTimestamp: 0,
    };

    // Create an empty state file if it doesn't exist
    if (!fs.existsSync(stateFile)) {
      try {
        fs.writeFileSync(stateFile, JSON.stringify({ state: 'idle', timestamp: Date.now() }));
      } catch {
        // File might be created by another process, that's OK
      }
    }

    try {
      // Watch the specific state file
      watchedSession.watcher = fs.watch(stateFile, { persistent: false }, (eventType) => {
        if (eventType === 'change') {
          this.handleStateFileChange(sessionId);
        }
      });

      watchedSession.watcher.on('error', () => {
        // Watcher error - file might have been deleted, stop watching
        this.unwatchSession(sessionId);
      });
    } catch {
      // Could not set up watcher - file might not exist yet
      // Polling fallback will still work
    }

    // Always set up polling as fallback (1 second interval)
    // fs.watch() can miss events on some platforms (especially Windows)
    watchedSession.pollInterval = setInterval(() => {
      this.handleStateFileChange(sessionId);
    }, 1000);

    this.watchedSessions.set(sessionId, watchedSession);
  }

  unwatchSession(sessionId: string): void {
    const session = this.watchedSessions.get(sessionId);
    if (!session) {
      return;
    }

    if (session.watcher) {
      session.watcher.close();
    }

    if (session.pollInterval) {
      clearInterval(session.pollInterval);
    }

    // Clean up state file
    const stateFile = this.getStateFilePath(sessionId);
    try {
      if (fs.existsSync(stateFile)) {
        fs.unlinkSync(stateFile);
      }
    } catch {
      // File might already be deleted, that's OK
    }

    this.watchedSessions.delete(sessionId);
  }

  isWatching(sessionId: string): boolean {
    return this.watchedSessions.has(sessionId);
  }

  private handleStateFileChange(sessionId: string): void {
    const session = this.watchedSessions.get(sessionId);
    if (!session) {
      return;
    }

    const stateFile = this.getStateFilePath(sessionId);

    try {
      const content = fs.readFileSync(stateFile, 'utf8');
      const data: StateFileData = JSON.parse(content);

      // Only emit if state changed and timestamp is newer
      if (data.timestamp > session.lastTimestamp) {
        session.lastState = data.state;
        session.lastTimestamp = data.timestamp;

        const event: HookStateEvent = {
          sessionId,
          state: data.state,
          timestamp: data.timestamp,
        };

        eventBus.emit(Events.HOOK_STATE_CHANGED, event);
      }
    } catch {
      // File read/parse error - might be mid-write, ignore
    }
  }

  // Manual check for state (useful for polling fallback)
  checkState(sessionId: string): AgentActivityState | null {
    const stateFile = this.getStateFilePath(sessionId);

    try {
      if (fs.existsSync(stateFile)) {
        const content = fs.readFileSync(stateFile, 'utf8');
        const data: StateFileData = JSON.parse(content);
        return data.state;
      }
    } catch {
      // File read/parse error
    }

    return null;
  }

  getStateDir(): string {
    return this.stateDir;
  }
}

// Singleton instance
export const hookStateWatcherService = new HookStateWatcherService();

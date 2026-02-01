import { eventBus, Events } from './EventBus';
import { ClaudeCodeAnalyzer } from './outputAnalyzers/ClaudeCodeAnalyzer';
import { ShellAnalyzer } from './outputAnalyzers/ShellAnalyzer';
import type { AgentStatus, AgentActivityState, FileChange, HookStateEvent, StateSource } from '../../shared/types/agentStatus';

// Maximum output buffer size per session (20KB - increased for better pattern matching)
const MAX_BUFFER_SIZE = 20 * 1024;

// Debounce time for status updates (300ms)
const STATUS_UPDATE_DEBOUNCE = 300;

// Inactivity timeout when hooks are available (shorter, since hooks are authoritative)
const INACTIVITY_TIMEOUT_WITH_HOOKS_MS = 1500;

// Inactivity timeout when hooks are NOT available (longer, pattern matching is less reliable)
const INACTIVITY_TIMEOUT_WITHOUT_HOOKS_MS = 3000;

interface SessionTracker {
  sessionId: string;
  agentId?: string;
  outputBuffer: string;
  analyzer: ClaudeCodeAnalyzer | ShellAnalyzer;
  status: AgentStatus;
  updateTimeout: ReturnType<typeof setTimeout> | null;
  inactivityTimer: ReturnType<typeof setTimeout> | null;
  lastOutputTime: number;
  hookActive: boolean;
  lastHookStateTime: number;
}

export class AgentStatusTracker {
  private trackers: Map<string, SessionTracker> = new Map();
  private outputSubscription: { unsubscribe: () => void } | null = null;
  private terminatedSubscription: { unsubscribe: () => void } | null = null;
  private hookStateSubscription: { unsubscribe: () => void } | null = null;

  initialize(): void {
    // Subscribe to session output events
    this.outputSubscription = eventBus.on<{ sessionId: string; data: string }>(
      Events.SESSION_OUTPUT,
      (event) => this.handleOutput(event.sessionId, event.data)
    );

    // Subscribe to session termination
    this.terminatedSubscription = eventBus.on<{ sessionId: string }>(
      Events.SESSION_TERMINATED,
      (event) => this.handleTerminated(event.sessionId)
    );

    // Subscribe to hook state changes
    this.hookStateSubscription = eventBus.on<HookStateEvent>(
      Events.HOOK_STATE_CHANGED,
      (event) => this.handleHookStateChange(event)
    );
  }

  shutdown(): void {
    this.outputSubscription?.unsubscribe();
    this.terminatedSubscription?.unsubscribe();
    this.hookStateSubscription?.unsubscribe();

    // Clear all pending timeouts
    for (const tracker of this.trackers.values()) {
      if (tracker.updateTimeout) {
        clearTimeout(tracker.updateTimeout);
      }
      if (tracker.inactivityTimer) {
        clearTimeout(tracker.inactivityTimer);
      }
    }
    this.trackers.clear();
  }

  registerSession(sessionId: string, agentId?: string, hookEnabled: boolean = false): void {
    // Determine analyzer type based on agent
    const isAiAgent = agentId && ['claude-code', 'cursor', 'aider'].includes(agentId);
    const analyzer = isAiAgent ? new ClaudeCodeAnalyzer() : new ShellAnalyzer();

    const tracker: SessionTracker = {
      sessionId,
      agentId,
      outputBuffer: '',
      analyzer,
      status: {
        sessionId,
        activityState: 'idle',
        lastActivityTimestamp: Date.now(),
        taskSummary: null,
        recentFileChanges: [],
        errorMessage: null,
        stateSource: 'pattern',
        hookAvailable: hookEnabled,
      },
      updateTimeout: null,
      inactivityTimer: null,
      lastOutputTime: Date.now(),
      hookActive: hookEnabled,
      lastHookStateTime: 0,
    };

    this.trackers.set(sessionId, tracker);
  }

  setHookActive(sessionId: string, active: boolean): void {
    const tracker = this.trackers.get(sessionId);
    if (tracker) {
      tracker.hookActive = active;
      tracker.status.hookAvailable = active;
    }
  }

  unregisterSession(sessionId: string): void {
    const tracker = this.trackers.get(sessionId);
    if (tracker) {
      if (tracker.updateTimeout) {
        clearTimeout(tracker.updateTimeout);
      }
      if (tracker.inactivityTimer) {
        clearTimeout(tracker.inactivityTimer);
      }
    }
    this.trackers.delete(sessionId);
  }

  getStatus(sessionId: string): AgentStatus | null {
    const tracker = this.trackers.get(sessionId);
    return tracker ? { ...tracker.status } : null;
  }

  getAllStatuses(): AgentStatus[] {
    return Array.from(this.trackers.values()).map(t => ({ ...t.status }));
  }

  private handleOutput(sessionId: string, data: string): void {
    const tracker = this.trackers.get(sessionId);
    if (!tracker) {
      return;
    }

    // Track output timing for inactivity detection
    tracker.lastOutputTime = Date.now();

    // Append to buffer, trimming if necessary
    tracker.outputBuffer += data;
    if (tracker.outputBuffer.length > MAX_BUFFER_SIZE) {
      tracker.outputBuffer = tracker.outputBuffer.slice(-MAX_BUFFER_SIZE);
    }

    // If hooks are active and we recently received a hook state, skip pattern analysis
    // Hooks are authoritative - don't let pattern matching override them
    const timeSinceHookState = Date.now() - tracker.lastHookStateTime;
    const hookStateIsFresh = tracker.hookActive && timeSinceHookState < 1000;

    // Analyze the output (but don't override hook state for activity)
    const result = tracker.analyzer.analyze(tracker.outputBuffer);

    // Update status if we got meaningful results
    let statusChanged = false;

    // Only update activity state from patterns if hooks haven't recently set it
    if (result.activityState !== undefined && !hookStateIsFresh) {
      if (tracker.status.activityState !== result.activityState) {
        tracker.status.activityState = result.activityState;
        tracker.status.stateSource = 'pattern';
        tracker.status.lastActivityTimestamp = Date.now();
        statusChanged = true;
      }
    }

    if (result.taskSummary !== undefined) {
      tracker.status.taskSummary = result.taskSummary;
      statusChanged = true;
    }

    if (result.fileChanges && result.fileChanges.length > 0) {
      tracker.status.recentFileChanges = [
        ...tracker.status.recentFileChanges,
        ...result.fileChanges,
      ].slice(-20);
      statusChanged = true;
    }

    if (result.errorMessage !== undefined) {
      tracker.status.errorMessage = result.errorMessage;
      statusChanged = true;
    }

    // Debounced status update emission
    if (statusChanged) {
      this.scheduleStatusUpdate(tracker);
    }

    // Reset and start inactivity timer if currently working
    this.resetInactivityTimer(tracker);
  }

  private handleHookStateChange(event: HookStateEvent): void {
    const tracker = this.trackers.get(event.sessionId);
    if (!tracker) {
      return;
    }

    // Hook state is authoritative - update immediately
    tracker.hookActive = true;
    tracker.status.hookAvailable = true;
    tracker.lastHookStateTime = event.timestamp;

    if (tracker.status.activityState !== event.state) {
      tracker.status.activityState = event.state;
      tracker.status.stateSource = 'hook';
      tracker.status.lastActivityTimestamp = event.timestamp;

      // Clear error state if transitioning to non-error state via hook
      if (event.state !== 'error') {
        tracker.status.errorMessage = null;
        tracker.analyzer.clearError();
      }

      // Clear inactivity timer - hooks are definitive
      if (tracker.inactivityTimer) {
        clearTimeout(tracker.inactivityTimer);
        tracker.inactivityTimer = null;
      }

      this.scheduleStatusUpdate(tracker);
    }
  }

  private resetInactivityTimer(tracker: SessionTracker): void {
    // Clear existing timer
    if (tracker.inactivityTimer) {
      clearTimeout(tracker.inactivityTimer);
      tracker.inactivityTimer = null;
    }

    // Use longer timeout when hooks are not available (pattern matching is less reliable)
    const timeoutMs = tracker.hookActive
      ? INACTIVITY_TIMEOUT_WITH_HOOKS_MS
      : INACTIVITY_TIMEOUT_WITHOUT_HOOKS_MS;

    // Only set inactivity timer if currently in "working" state
    if (tracker.status.activityState === 'working') {
      tracker.inactivityTimer = setTimeout(() => {
        tracker.inactivityTimer = null;
        // Only transition to idle if still in working state and no recent output
        const timeSinceLastOutput = Date.now() - tracker.lastOutputTime;
        if (
          tracker.status.activityState === 'working' &&
          timeSinceLastOutput >= timeoutMs
        ) {
          tracker.status.activityState = 'idle';
          tracker.status.stateSource = 'timeout';
          tracker.status.lastActivityTimestamp = Date.now();
          this.scheduleStatusUpdate(tracker);
        }
      }, timeoutMs);
    }
  }

  private handleTerminated(sessionId: string): void {
    this.unregisterSession(sessionId);
  }

  private scheduleStatusUpdate(tracker: SessionTracker): void {
    if (tracker.updateTimeout) {
      clearTimeout(tracker.updateTimeout);
    }

    tracker.updateTimeout = setTimeout(() => {
      tracker.updateTimeout = null;
      eventBus.emit(Events.AGENT_STATUS_UPDATED, { status: { ...tracker.status } });
    }, STATUS_UPDATE_DEBOUNCE);
  }

  // Force immediate status emission (useful for initial state)
  emitStatus(sessionId: string): void {
    const tracker = this.trackers.get(sessionId);
    if (tracker) {
      eventBus.emit(Events.AGENT_STATUS_UPDATED, { status: { ...tracker.status } });
    }
  }

  // Manual state override (e.g., when user sends input)
  setActivityState(sessionId: string, state: AgentActivityState, source: StateSource = 'pattern'): void {
    const tracker = this.trackers.get(sessionId);
    if (tracker) {
      tracker.status.activityState = state;
      tracker.status.stateSource = source;
      tracker.status.lastActivityTimestamp = Date.now();
      if (state !== 'error') {
        tracker.status.errorMessage = null;
        tracker.analyzer.clearError();
      }
      this.scheduleStatusUpdate(tracker);
    }
  }

  // Check if hooks are active for a session
  isHookActive(sessionId: string): boolean {
    const tracker = this.trackers.get(sessionId);
    return tracker?.hookActive ?? false;
  }
}

// Singleton instance
export const agentStatusTracker = new AgentStatusTracker();

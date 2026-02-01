import { eventBus, Events } from './EventBus';
import { ClaudeCodeAnalyzer } from './outputAnalyzers/ClaudeCodeAnalyzer';
import { ShellAnalyzer } from './outputAnalyzers/ShellAnalyzer';
// Maximum output buffer size per session (10KB)
const MAX_BUFFER_SIZE = 10 * 1024;
// Debounce time for status updates (300ms)
const STATUS_UPDATE_DEBOUNCE = 300;
// Inactivity timeout - if "working" and no output for this duration, transition to "idle"
const INACTIVITY_TIMEOUT_MS = 1500;
export class AgentStatusTracker {
    trackers = new Map();
    outputSubscription = null;
    terminatedSubscription = null;
    initialize() {
        // Subscribe to session output events
        this.outputSubscription = eventBus.on(Events.SESSION_OUTPUT, (event) => this.handleOutput(event.sessionId, event.data));
        // Subscribe to session termination
        this.terminatedSubscription = eventBus.on(Events.SESSION_TERMINATED, (event) => this.handleTerminated(event.sessionId));
    }
    shutdown() {
        this.outputSubscription?.unsubscribe();
        this.terminatedSubscription?.unsubscribe();
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
    registerSession(sessionId, agentId) {
        // Determine analyzer type based on agent
        const isAiAgent = agentId && ['claude-code', 'cursor', 'aider'].includes(agentId);
        const analyzer = isAiAgent ? new ClaudeCodeAnalyzer() : new ShellAnalyzer();
        const tracker = {
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
            },
            updateTimeout: null,
            inactivityTimer: null,
            lastOutputTime: Date.now(),
        };
        this.trackers.set(sessionId, tracker);
    }
    unregisterSession(sessionId) {
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
    getStatus(sessionId) {
        const tracker = this.trackers.get(sessionId);
        return tracker ? { ...tracker.status } : null;
    }
    getAllStatuses() {
        return Array.from(this.trackers.values()).map(t => ({ ...t.status }));
    }
    handleOutput(sessionId, data) {
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
        // Analyze the output
        const result = tracker.analyzer.analyze(tracker.outputBuffer);
        // Update status if we got meaningful results
        let statusChanged = false;
        if (result.activityState !== undefined) {
            if (tracker.status.activityState !== result.activityState) {
                tracker.status.activityState = result.activityState;
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
    resetInactivityTimer(tracker) {
        // Clear existing timer
        if (tracker.inactivityTimer) {
            clearTimeout(tracker.inactivityTimer);
            tracker.inactivityTimer = null;
        }
        // Only set inactivity timer if currently in "working" state
        if (tracker.status.activityState === 'working') {
            tracker.inactivityTimer = setTimeout(() => {
                tracker.inactivityTimer = null;
                // Only transition to idle if still in working state and no recent output
                const timeSinceLastOutput = Date.now() - tracker.lastOutputTime;
                if (tracker.status.activityState === 'working' &&
                    timeSinceLastOutput >= INACTIVITY_TIMEOUT_MS) {
                    tracker.status.activityState = 'idle';
                    tracker.status.lastActivityTimestamp = Date.now();
                    this.scheduleStatusUpdate(tracker);
                }
            }, INACTIVITY_TIMEOUT_MS);
        }
    }
    handleTerminated(sessionId) {
        this.unregisterSession(sessionId);
    }
    scheduleStatusUpdate(tracker) {
        if (tracker.updateTimeout) {
            clearTimeout(tracker.updateTimeout);
        }
        tracker.updateTimeout = setTimeout(() => {
            tracker.updateTimeout = null;
            eventBus.emit(Events.AGENT_STATUS_UPDATED, { status: { ...tracker.status } });
        }, STATUS_UPDATE_DEBOUNCE);
    }
    // Force immediate status emission (useful for initial state)
    emitStatus(sessionId) {
        const tracker = this.trackers.get(sessionId);
        if (tracker) {
            eventBus.emit(Events.AGENT_STATUS_UPDATED, { status: { ...tracker.status } });
        }
    }
    // Manual state override (e.g., when user sends input)
    setActivityState(sessionId, state) {
        const tracker = this.trackers.get(sessionId);
        if (tracker) {
            tracker.status.activityState = state;
            tracker.status.lastActivityTimestamp = Date.now();
            if (state !== 'error') {
                tracker.status.errorMessage = null;
                tracker.analyzer.clearError();
            }
            this.scheduleStatusUpdate(tracker);
        }
    }
}
// Singleton instance
export const agentStatusTracker = new AgentStatusTracker();
//# sourceMappingURL=AgentStatusTracker.js.map
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { eventBus, Events } from './EventBus';
import { activityParser } from './ActivityParser';
import { sessionRegistry } from './SessionRegistry';
// Configuration
const MAX_EVENTS_IN_MEMORY = 500;
const MAX_EVENTS_IN_FILE = 2000;
const BATCH_INTERVAL_MS = 100;
const MAX_BATCH_SIZE = 50;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export class ActivityFeedService {
    events = [];
    pendingEvents = [];
    batchTimeout = null;
    cleanupInterval = null;
    outputSubscription = null;
    terminatedSubscription = null;
    filePath;
    constructor() {
        this.filePath = path.join(app.getPath('userData'), 'activity-feed.json');
    }
    async initialize() {
        // Load persisted events
        await this.loadFromFile();
        // Subscribe to session output
        this.outputSubscription = eventBus.on(Events.SESSION_OUTPUT, (event) => this.handleOutput(event.sessionId, event.data));
        // Subscribe to session termination
        this.terminatedSubscription = eventBus.on(Events.SESSION_TERMINATED, (event) => this.handleTerminated(event.sessionId));
        // Start cleanup interval
        this.cleanupInterval = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
    }
    shutdown() {
        this.outputSubscription?.unsubscribe();
        this.terminatedSubscription?.unsubscribe();
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
        }
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        // Flush pending events
        this.flushBatch();
        // Save to file
        this.saveToFile();
    }
    handleOutput(sessionId, data) {
        // Get session info for context
        const session = sessionRegistry.getSessionInfo(sessionId);
        if (!session)
            return;
        // Get accumulated output for this session
        const sessionObj = sessionRegistry.getSession(sessionId);
        if (!sessionObj)
            return;
        const fullOutput = sessionObj.getBufferedOutput() + data;
        // Parse the output
        const newEvents = activityParser.parseOutput(fullOutput, {
            sessionId,
            agentId: session.agentId,
            agentName: session.agentName,
            agentIcon: session.agentIcon,
        });
        // Add to pending batch
        if (newEvents.length > 0) {
            this.pendingEvents.push(...newEvents);
            this.scheduleBatch();
        }
    }
    handleTerminated(sessionId) {
        activityParser.resetSession(sessionId);
    }
    scheduleBatch() {
        if (this.batchTimeout)
            return;
        if (this.pendingEvents.length >= MAX_BATCH_SIZE) {
            this.flushBatch();
        }
        else {
            this.batchTimeout = setTimeout(() => {
                this.batchTimeout = null;
                this.flushBatch();
            }, BATCH_INTERVAL_MS);
        }
    }
    flushBatch() {
        if (this.pendingEvents.length === 0)
            return;
        // Add events to memory
        this.events.push(...this.pendingEvents);
        // Emit events to renderer
        for (const event of this.pendingEvents) {
            eventBus.emit(Events.ACTIVITY_EVENT, { event });
        }
        // Clear pending
        this.pendingEvents = [];
        // Trim if needed
        if (this.events.length > MAX_EVENTS_IN_MEMORY) {
            this.events = this.events.slice(-MAX_EVENTS_IN_MEMORY);
        }
    }
    getEvents(filter) {
        let filtered = [...this.events];
        // Apply filters
        if (filter.sessionIds && filter.sessionIds.length > 0) {
            filtered = filtered.filter(e => filter.sessionIds.includes(e.sessionId));
        }
        if (filter.types && filter.types.length > 0) {
            filtered = filtered.filter(e => filter.types.includes(e.type));
        }
        if (filter.severities && filter.severities.length > 0) {
            filtered = filtered.filter(e => filter.severities.includes(e.severity));
        }
        if (filter.fromTimestamp) {
            filtered = filtered.filter(e => e.timestamp >= filter.fromTimestamp);
        }
        if (filter.toTimestamp) {
            filtered = filtered.filter(e => e.timestamp <= filter.toTimestamp);
        }
        // Sort by timestamp descending (newest first)
        filtered.sort((a, b) => b.timestamp - a.timestamp);
        // Apply pagination
        const offset = filter.offset || 0;
        const limit = filter.limit || 100;
        return filtered.slice(offset, offset + limit);
    }
    clearEvents(sessionId) {
        if (sessionId) {
            this.events = this.events.filter(e => e.sessionId !== sessionId);
        }
        else {
            this.events = [];
        }
        this.saveToFile();
    }
    addEvent(event) {
        this.pendingEvents.push(event);
        this.scheduleBatch();
    }
    cleanup() {
        const cutoff = Date.now() - MAX_EVENT_AGE_MS;
        const before = this.events.length;
        this.events = this.events.filter(e => e.timestamp > cutoff);
        if (this.events.length < before) {
            this.saveToFile();
        }
    }
    async loadFromFile() {
        try {
            if (fs.existsSync(this.filePath)) {
                const data = await fs.promises.readFile(this.filePath, 'utf-8');
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed)) {
                    this.events = parsed.slice(-MAX_EVENTS_IN_FILE);
                }
            }
        }
        catch (error) {
            console.error('Failed to load activity feed:', error);
            this.events = [];
        }
    }
    saveToFile() {
        try {
            const toSave = this.events.slice(-MAX_EVENTS_IN_FILE);
            fs.writeFileSync(this.filePath, JSON.stringify(toSave, null, 2));
        }
        catch (error) {
            console.error('Failed to save activity feed:', error);
        }
    }
}
// Singleton instance
export const activityFeedService = new ActivityFeedService();
//# sourceMappingURL=ActivityFeedService.js.map
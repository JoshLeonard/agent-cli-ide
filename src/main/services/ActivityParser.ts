import { v4 as uuidv4 } from 'uuid';
import type { ActivityEvent, ActivityType, ActivitySeverity } from '../../shared/types/activity';

// Parsing patterns for various output types
const PATTERNS = {
  // File operations
  fileCreated: [
    { pattern: /(?:Created|Wrote|Writing to)\s+(?:file:?\s+)?['"]?([^\s'"]+\.[a-zA-Z0-9]+)/gi, type: 'file_created' as ActivityType },
    { pattern: /(?:New file:?|Creating)\s+['"]?([^\s'"]+\.[a-zA-Z0-9]+)/gi, type: 'file_created' as ActivityType },
    { pattern: /File created successfully at:\s+['"]?([^\s'"]+\.[a-zA-Z0-9]+)/gi, type: 'file_created' as ActivityType },
  ],
  fileModified: [
    { pattern: /(?:Edited|Modified|Updated|Updating|Edit)\s+['"]?([^\s'"]+\.[a-zA-Z0-9]+)/gi, type: 'file_modified' as ActivityType },
    { pattern: /The file\s+['"]?([^\s'"]+\.[a-zA-Z0-9]+)['"]?\s+has been (?:updated|edited|modified)/gi, type: 'file_modified' as ActivityType },
  ],
  fileDeleted: [
    { pattern: /(?:Deleted|Removed|Removing)\s+(?:file:?\s+)?['"]?([^\s'"]+\.[a-zA-Z0-9]+)/gi, type: 'file_deleted' as ActivityType },
  ],

  // Errors
  errors: [
    { pattern: /error TS(\d+):\s*(.+)/gi, extract: (match: RegExpMatchArray) => ({ code: `TS${match[1]}`, message: match[2] }) },
    { pattern: /^(?:Error|TypeError|ReferenceError|SyntaxError):\s*(.+)/gim, extract: (match: RegExpMatchArray) => ({ code: undefined, message: match[1] }) },
    { pattern: /^ERROR:\s*(.+)/gim, extract: (match: RegExpMatchArray) => ({ code: undefined, message: match[1] }) },
    { pattern: /npm ERR!\s*(.+)/gi, extract: (match: RegExpMatchArray) => ({ code: undefined, message: `npm: ${match[1]}` }) },
    { pattern: /fatal:\s*(.+)/gi, extract: (match: RegExpMatchArray) => ({ code: undefined, message: `git: ${match[1]}` }) },
  ],

  // Warnings
  warnings: [
    { pattern: /(?:warning|warn):\s*(.+)/gi, extract: (match: RegExpMatchArray) => ({ message: match[1] }) },
    { pattern: /WARN\s+(.+)/gi, extract: (match: RegExpMatchArray) => ({ message: match[1] }) },
  ],

  // Task completion
  taskCompleted: [
    { pattern: /(?:Task completed|Done|Completed|Finished):\s*['"]?(.+?)['"]?$/gim },
    { pattern: /^✓\s+(.+)/gm },
    { pattern: /Successfully\s+(.+)/gi },
  ],

  // Commands
  commandExecuted: [
    { pattern: /(?:Running|Executing):\s*(.+)/gi },
    { pattern: /\$\s+(.+)/gm },
    { pattern: />\s+(.+)/gm },
  ],
};

interface SessionContext {
  sessionId: string;
  agentId?: string;
  agentName?: string;
  agentIcon?: string;
}

export class ActivityParser {
  private lastParsedPosition: Map<string, number> = new Map();
  private recentEvents: Set<string> = new Set(); // Deduplication

  parseOutput(output: string, context: SessionContext): ActivityEvent[] {
    const events: ActivityEvent[] = [];
    const sessionId = context.sessionId;

    // Get last parsed position for this session
    const lastPos = this.lastParsedPosition.get(sessionId) || 0;
    const newContent = output.slice(lastPos);

    if (!newContent.trim()) {
      return events;
    }

    // Update position
    this.lastParsedPosition.set(sessionId, output.length);

    // Parse file operations
    for (const { pattern, type } of PATTERNS.fileCreated) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(newContent)) !== null) {
        const filePath = match[1];
        if (this.isValidFilePath(filePath)) {
          events.push(this.createEvent(type, 'success', `File created: ${this.getFileName(filePath)}`, context, filePath));
        }
      }
    }

    for (const { pattern, type } of PATTERNS.fileModified) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(newContent)) !== null) {
        const filePath = match[1];
        if (this.isValidFilePath(filePath)) {
          events.push(this.createEvent(type, 'info', `File modified: ${this.getFileName(filePath)}`, context, filePath));
        }
      }
    }

    for (const { pattern, type } of PATTERNS.fileDeleted) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(newContent)) !== null) {
        const filePath = match[1];
        if (this.isValidFilePath(filePath)) {
          events.push(this.createEvent(type, 'warning', `File deleted: ${this.getFileName(filePath)}`, context, filePath));
        }
      }
    }

    // Parse errors
    for (const { pattern, extract } of PATTERNS.errors) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(newContent)) !== null) {
        const extracted = extract(match);
        const title = extracted.code ? `Error ${extracted.code}` : 'Error';
        events.push(this.createEvent('error', 'error', title, context, undefined, extracted.message));
      }
    }

    // Parse warnings
    for (const { pattern, extract } of PATTERNS.warnings) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(newContent)) !== null) {
        const extracted = extract(match);
        events.push(this.createEvent('warning', 'warning', 'Warning', context, undefined, extracted.message));
      }
    }

    // Parse task completions
    for (const { pattern } of PATTERNS.taskCompleted) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(newContent)) !== null) {
        const task = match[1] || 'Task completed';
        events.push(this.createEvent('task_completed', 'success', task.slice(0, 100), context));
      }
    }

    // Deduplicate events
    const uniqueEvents = events.filter(event => {
      const key = `${event.sessionId}-${event.type}-${event.title}-${event.filePath || ''}`;
      if (this.recentEvents.has(key)) {
        return false;
      }
      this.recentEvents.add(key);
      // Clean up old entries after a while
      if (this.recentEvents.size > 1000) {
        const entries = Array.from(this.recentEvents);
        entries.slice(0, 500).forEach(e => this.recentEvents.delete(e));
      }
      return true;
    });

    return uniqueEvents;
  }

  private createEvent(
    type: ActivityType,
    severity: ActivitySeverity,
    title: string,
    context: SessionContext,
    filePath?: string,
    details?: string
  ): ActivityEvent {
    return {
      id: uuidv4(),
      sessionId: context.sessionId,
      agentId: context.agentId,
      agentName: context.agentName,
      agentIcon: context.agentIcon,
      type,
      severity,
      timestamp: Date.now(),
      title,
      filePath,
      details,
    };
  }

  private isValidFilePath(path: string): boolean {
    if (!path || path.length < 3) return false;
    if (path.startsWith('http://') || path.startsWith('https://')) return false;
    if (/^[a-z]+:\/\//i.test(path)) return false;
    if (/^\d+\.\d+\.\d+/.test(path)) return false;
    if (path.startsWith('-')) return false;
    return true;
  }

  private getFileName(filePath: string): string {
    const parts = filePath.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || filePath;
  }

  resetSession(sessionId: string): void {
    this.lastParsedPosition.delete(sessionId);
  }

  reset(): void {
    this.lastParsedPosition.clear();
    this.recentEvents.clear();
  }
}

// Singleton instance
export const activityParser = new ActivityParser();

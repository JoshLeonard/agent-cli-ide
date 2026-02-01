// Pattern definitions for Claude Code output
const PATTERNS = {
    // Working indicators
    working: [
        /^(Thinking|Processing|Reading|Writing|Running|Searching|Analyzing|Fetching)/i,
        /^(Glob|Grep|Read|Edit|Write|Bash|WebFetch|WebSearch|Task)\s/,
        /Tool use:/i,
        /\[\d+\/\d+\]/, // Progress indicators like [1/5]
    ],
    // Waiting for input
    waitingForInput: [
        /\(y\)es\s*\/\s*\(n\)o/i,
        /Continue\?/i,
        /\[Y\/n\]/i,
        /\[y\/N\]/i,
        /waiting for (?:your )?(?:input|response)/i,
        /Press Enter to continue/i,
        /Do you want to/i,
        /Would you like to/i,
    ],
    // Task completion
    complete: [
        /^Done\.?$/im,
        /^Completed\.?$/im,
        /^Task completed/i,
        /^Finished/i,
        /successfully completed/i,
    ],
    // Error patterns
    error: [
        /^Error:/im,
        /^Failed:/im,
        /^Exception:/im,
        /Error occurred/i,
        /Command failed/i,
        /Permission denied/i,
        /ENOENT/i,
        /EACCES/i,
    ],
    // Idle indicators (prompt visible)
    idle: [
        /^>\s*$/m,
        /^\$\s*$/m,
        /^claude>\s*$/m,
        /^❯\s*$/m,
        /^\?\s*$/m, // Claude Code prompt
    ],
    // File operation patterns
    fileCreated: [
        /(?:Created|Wrote|Writing)\s+(?:file:?\s+)?['"]?([^\s'"]+\.[a-zA-Z0-9]+)/gi,
        /(?:Creating|New file:?)\s+['"]?([^\s'"]+\.[a-zA-Z0-9]+)/gi,
    ],
    fileModified: [
        /(?:Edited|Modified|Updated|Updating)\s+['"]?([^\s'"]+\.[a-zA-Z0-9]+)/gi,
        /(?:Edit|Write)\s+['"]?([^\s'"]+\.[a-zA-Z0-9]+)/gi,
    ],
    fileDeleted: [
        /(?:Deleted|Removed|Removing)\s+(?:file:?\s+)?['"]?([^\s'"]+\.[a-zA-Z0-9]+)/gi,
    ],
    // Task summary extraction
    taskSummary: [
        /^(?:I'll|I will|Let me|I'm going to)\s+(.+?)(?:\.|$)/im,
        /^(?:Working on|Starting|Beginning)\s+(.+?)(?:\.|$)/im,
        /^(?:Task|Goal):\s*(.+?)(?:\.|$)/im,
    ],
};
export class ClaudeCodeAnalyzer {
    lastAnalyzedOutput = '';
    currentTaskSummary = null;
    recentFileChanges = [];
    lastErrorMessage = null;
    lastActivityState = 'idle';
    /**
     * Strip ANSI escape sequences from output for cleaner pattern matching.
     * Handles color codes, cursor movement, and other terminal control sequences.
     */
    stripAnsi(str) {
        // eslint-disable-next-line no-control-regex
        return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
    }
    analyze(output) {
        const result = {};
        // Only analyze new content
        const newContent = output.slice(this.lastAnalyzedOutput.length);
        if (!newContent.trim()) {
            return result;
        }
        this.lastAnalyzedOutput = output;
        // Strip ANSI codes for cleaner pattern matching
        const cleanContent = this.stripAnsi(newContent);
        // Check for errors first (highest priority)
        for (const pattern of PATTERNS.error) {
            const match = cleanContent.match(pattern);
            if (match) {
                result.activityState = 'error';
                // Extract error message
                const errorLine = cleanContent.split('\n').find(line => pattern.test(line));
                if (errorLine) {
                    this.lastErrorMessage = errorLine.slice(0, 200);
                    result.errorMessage = this.lastErrorMessage;
                }
                this.lastActivityState = 'error';
                break;
            }
        }
        // Check for waiting for input
        if (!result.activityState) {
            for (const pattern of PATTERNS.waitingForInput) {
                if (pattern.test(cleanContent)) {
                    result.activityState = 'waiting_for_input';
                    this.lastActivityState = 'waiting_for_input';
                    break;
                }
            }
        }
        // Check for working state
        if (!result.activityState) {
            for (const pattern of PATTERNS.working) {
                if (pattern.test(cleanContent)) {
                    result.activityState = 'working';
                    this.lastActivityState = 'working';
                    break;
                }
            }
        }
        // Check for completion
        if (!result.activityState) {
            for (const pattern of PATTERNS.complete) {
                if (pattern.test(cleanContent)) {
                    result.activityState = 'idle';
                    this.lastActivityState = 'idle';
                    break;
                }
            }
        }
        // Check for idle (prompt visible)
        if (!result.activityState) {
            for (const pattern of PATTERNS.idle) {
                if (pattern.test(cleanContent)) {
                    result.activityState = 'idle';
                    this.lastActivityState = 'idle';
                    break;
                }
            }
        }
        // Extract task summary
        for (const pattern of PATTERNS.taskSummary) {
            const match = cleanContent.match(pattern);
            if (match && match[1]) {
                const summary = match[1].trim().slice(0, 100);
                if (summary.length > 10) {
                    this.currentTaskSummary = summary;
                    result.taskSummary = summary;
                    break;
                }
            }
        }
        // Extract file changes (use cleanContent for better matching)
        const fileChanges = this.extractFileChanges(cleanContent);
        if (fileChanges.length > 0) {
            this.recentFileChanges = [...this.recentFileChanges, ...fileChanges].slice(-20);
            result.fileChanges = fileChanges;
        }
        return result;
    }
    extractFileChanges(content) {
        const changes = [];
        const now = Date.now();
        // Created files
        for (const pattern of PATTERNS.fileCreated) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const path = match[1];
                if (this.isValidFilePath(path)) {
                    changes.push({ path, type: 'created', timestamp: now });
                }
            }
        }
        // Modified files
        for (const pattern of PATTERNS.fileModified) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const path = match[1];
                if (this.isValidFilePath(path) && !changes.some(c => c.path === path)) {
                    changes.push({ path, type: 'modified', timestamp: now });
                }
            }
        }
        // Deleted files
        for (const pattern of PATTERNS.fileDeleted) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const path = match[1];
                if (this.isValidFilePath(path) && !changes.some(c => c.path === path)) {
                    changes.push({ path, type: 'deleted', timestamp: now });
                }
            }
        }
        return changes;
    }
    isValidFilePath(path) {
        // Filter out common false positives
        if (!path || path.length < 3)
            return false;
        if (path.startsWith('http://') || path.startsWith('https://'))
            return false;
        if (/^[a-z]+:\/\//i.test(path))
            return false;
        if (/^\d+\.\d+\.\d+/.test(path))
            return false; // Version numbers
        return true;
    }
    getCurrentState() {
        return this.lastActivityState;
    }
    getTaskSummary() {
        return this.currentTaskSummary;
    }
    getRecentFileChanges() {
        return [...this.recentFileChanges];
    }
    getErrorMessage() {
        return this.lastErrorMessage;
    }
    clearError() {
        this.lastErrorMessage = null;
        if (this.lastActivityState === 'error') {
            this.lastActivityState = 'idle';
        }
    }
    reset() {
        this.lastAnalyzedOutput = '';
        this.currentTaskSummary = null;
        this.recentFileChanges = [];
        this.lastErrorMessage = null;
        this.lastActivityState = 'idle';
    }
}
//# sourceMappingURL=ClaudeCodeAnalyzer.js.map
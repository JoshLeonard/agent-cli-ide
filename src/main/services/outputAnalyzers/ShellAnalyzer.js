// Shell-specific patterns
const PATTERNS = {
    // PowerShell prompt patterns
    powershellPrompt: [
        /PS\s+[A-Z]:\\[^>]*>\s*$/m,
        /PS>\s*$/m,
        />>>\s*$/m, // Continuation prompt
    ],
    // Bash/Unix prompt patterns
    bashPrompt: [
        /\$\s*$/m,
        /❯\s*$/m,
        /➜\s*$/m,
        /#\s*$/m, // Root prompt
        /\]\$\s*$/m, // Common bash prompt ending
        /\]#\s*$/m, // Root with brackets
    ],
    // CMD prompt
    cmdPrompt: [
        /[A-Z]:\\[^>]*>\s*$/m,
        />\s*$/m,
    ],
    // Working indicators (command running)
    working: [
        /^\s*Running/im,
        /^\s*Installing/im,
        /^\s*Building/im,
        /^\s*Compiling/im,
        /^\s*Downloading/im,
        /^\s*Uploading/im,
        /^\s*Processing/im,
        /^\.\.\./m, // Progress dots
        /\[\s*\d+%\s*\]/, // Percentage progress
        /[|\\/-]\s*$/, // Spinner characters
    ],
    // Error patterns
    error: [
        /^error:/im,
        /^Error:/im,
        /^ERROR:/im,
        /FAILED/i,
        /^Exception:/im,
        /CommandNotFoundException/i,
        /command not found/i,
        /'[^']+' is not recognized/i,
        /Access is denied/i,
        /Permission denied/i,
        /ENOENT/i,
        /EACCES/i,
        /npm ERR!/i,
        /fatal:/i,
    ],
    // Command completion patterns
    complete: [
        /Done\.?$/im,
        /Completed\.?$/im,
        /Successfully/i,
        /Build succeeded/i,
        /All tests passed/i,
        /up to date/i,
    ],
    // File operation commands
    fileOps: {
        created: [
            /(?:New-Item|touch|mkdir|echo\s+.*>)\s+['"]?([^\s'"]+)/i,
            /(?:created|wrote to)\s+['"]?([^\s'"]+)/i,
        ],
        modified: [
            /(?:Set-Content|Add-Content)\s+['"]?([^\s'"]+)/i,
        ],
        deleted: [
            /(?:Remove-Item|rm|del)\s+(?:-[a-z]+\s+)*['"]?([^\s'"]+)/i,
            /(?:deleted|removed)\s+['"]?([^\s'"]+)/i,
        ],
    },
    // Waiting for input
    waitingForInput: [
        /\(Y\/N\)/i,
        /\[Y\/n\]/i,
        /\[y\/N\]/i,
        /Press any key/i,
        /Enter password/i,
        /Password:/i,
        /username:/i,
        /Confirm:/i,
    ],
};
export class ShellAnalyzer {
    lastAnalyzedOutput = '';
    lastActivityState = 'idle';
    lastErrorMessage = null;
    recentFileChanges = [];
    currentCommand = null;
    analyze(output) {
        const result = {};
        // Only analyze new content
        const newContent = output.slice(this.lastAnalyzedOutput.length);
        if (!newContent.trim()) {
            return result;
        }
        this.lastAnalyzedOutput = output;
        // Check for errors first
        for (const pattern of PATTERNS.error) {
            const match = newContent.match(pattern);
            if (match) {
                result.activityState = 'error';
                const errorLine = newContent.split('\n').find(line => pattern.test(line));
                if (errorLine) {
                    this.lastErrorMessage = errorLine.trim().slice(0, 200);
                    result.errorMessage = this.lastErrorMessage;
                }
                this.lastActivityState = 'error';
                break;
            }
        }
        // Check for waiting for input
        if (!result.activityState) {
            for (const pattern of PATTERNS.waitingForInput) {
                if (pattern.test(newContent)) {
                    result.activityState = 'waiting_for_input';
                    this.lastActivityState = 'waiting_for_input';
                    break;
                }
            }
        }
        // Check for working state
        if (!result.activityState) {
            for (const pattern of PATTERNS.working) {
                if (pattern.test(newContent)) {
                    result.activityState = 'working';
                    this.lastActivityState = 'working';
                    break;
                }
            }
        }
        // Check for completion
        if (!result.activityState) {
            for (const pattern of PATTERNS.complete) {
                if (pattern.test(newContent)) {
                    result.activityState = 'idle';
                    this.lastActivityState = 'idle';
                    break;
                }
            }
        }
        // Check for shell prompt (indicates idle/ready state)
        if (!result.activityState) {
            const allPromptPatterns = [
                ...PATTERNS.powershellPrompt,
                ...PATTERNS.bashPrompt,
                ...PATTERNS.cmdPrompt,
            ];
            for (const pattern of allPromptPatterns) {
                if (pattern.test(newContent)) {
                    result.activityState = 'idle';
                    this.lastActivityState = 'idle';
                    // Clear error when prompt returns
                    if (this.lastErrorMessage) {
                        this.lastErrorMessage = null;
                    }
                    break;
                }
            }
        }
        // Extract command as task summary
        const commandMatch = newContent.match(/(?:PS\s+[^>]*>|[A-Z]:\\[^>]*>|\$|❯|➜|#)\s*(.+)/);
        if (commandMatch && commandMatch[1]) {
            const command = commandMatch[1].trim();
            if (command.length > 0 && command.length < 100) {
                this.currentCommand = command;
                result.taskSummary = command;
            }
        }
        // Extract file changes
        const fileChanges = this.extractFileChanges(newContent);
        if (fileChanges.length > 0) {
            this.recentFileChanges = [...this.recentFileChanges, ...fileChanges].slice(-20);
            result.fileChanges = fileChanges;
        }
        return result;
    }
    extractFileChanges(content) {
        const changes = [];
        const now = Date.now();
        for (const pattern of PATTERNS.fileOps.created) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const path = match[1];
                if (this.isValidFilePath(path)) {
                    changes.push({ path, type: 'created', timestamp: now });
                }
            }
        }
        for (const pattern of PATTERNS.fileOps.modified) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const path = match[1];
                if (this.isValidFilePath(path) && !changes.some(c => c.path === path)) {
                    changes.push({ path, type: 'modified', timestamp: now });
                }
            }
        }
        for (const pattern of PATTERNS.fileOps.deleted) {
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
        if (!path || path.length < 2)
            return false;
        if (path.startsWith('http://') || path.startsWith('https://'))
            return false;
        if (/^-/.test(path))
            return false; // Flags
        return true;
    }
    getCurrentState() {
        return this.lastActivityState;
    }
    getTaskSummary() {
        return this.currentCommand;
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
        this.lastActivityState = 'idle';
        this.lastErrorMessage = null;
        this.recentFileChanges = [];
        this.currentCommand = null;
    }
}
//# sourceMappingURL=ShellAnalyzer.js.map
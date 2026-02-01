import type { AgentActivityState, FileChange } from '../../../shared/types/agentStatus';

interface AnalysisResult {
  activityState?: AgentActivityState;
  taskSummary?: string;
  fileChanges?: FileChange[];
  errorMessage?: string;
  confidence?: number;  // 0-1 confidence in the state detection
}

// Pattern definitions for Claude Code output with confidence scores
interface PatternDef {
  pattern: RegExp;
  confidence: number;  // 0-1, higher = more reliable
}

// Pattern definitions for Claude Code output
const PATTERNS = {
  // Working indicators - sorted by confidence
  working: [
    { pattern: /^╭─ .*─╮$/m, confidence: 0.9 },  // Claude Code tool box start
    { pattern: /^│ .*│$/m, confidence: 0.7 },     // Claude Code tool box content
    { pattern: /^(Thinking|Processing|Reading|Writing|Running|Searching|Analyzing|Fetching)/i, confidence: 0.8 },
    { pattern: /^(Glob|Grep|Read|Edit|Write|Bash|WebFetch|WebSearch|Task|NotebookEdit)\s/i, confidence: 0.9 },
    { pattern: /Tool use:/i, confidence: 0.8 },
    { pattern: /\[\d+\/\d+\]/, confidence: 0.7 },  // Progress indicators like [1/5]
    { pattern: /^⠋|^⠙|^⠹|^⠸|^⠼|^⠴|^⠦|^⠧|^⠇|^⠏/m, confidence: 0.9 },  // Spinner characters
    { pattern: /Executing.*\.{3}$/im, confidence: 0.8 },
    { pattern: /^Calling function/i, confidence: 0.85 },
  ] as PatternDef[],

  // Waiting for input - sorted by confidence
  waitingForInput: [
    { pattern: /\(y\)es\s*\/\s*\(n\)o/i, confidence: 0.95 },
    { pattern: /Continue\?\s*\[Y\/n\]/i, confidence: 0.95 },
    { pattern: /\[Y\/n\]/i, confidence: 0.9 },
    { pattern: /\[y\/N\]/i, confidence: 0.9 },
    { pattern: /waiting for (?:your )?(?:input|response)/i, confidence: 0.85 },
    { pattern: /Press Enter to continue/i, confidence: 0.9 },
    { pattern: /Do you want to\s+(?:continue|proceed)/i, confidence: 0.85 },
    { pattern: /Would you like to\s+(?:continue|proceed)/i, confidence: 0.85 },
    { pattern: /Approve this (?:action|change|edit)/i, confidence: 0.9 },
    { pattern: /^Allow\?/im, confidence: 0.9 },
  ] as PatternDef[],

  // Task completion
  complete: [
    { pattern: /^Done\.?$/im, confidence: 0.7 },
    { pattern: /^Completed\.?$/im, confidence: 0.75 },
    { pattern: /^Task completed/i, confidence: 0.8 },
    { pattern: /^Finished/i, confidence: 0.7 },
    { pattern: /successfully completed/i, confidence: 0.75 },
    { pattern: /^╰─.*─╯$/m, confidence: 0.6 },  // Claude Code tool box end
  ] as PatternDef[],

  // Error patterns
  error: [
    { pattern: /^Error:/im, confidence: 0.9 },
    { pattern: /^Failed:/im, confidence: 0.85 },
    { pattern: /^Exception:/im, confidence: 0.9 },
    { pattern: /Error occurred/i, confidence: 0.8 },
    { pattern: /Command failed/i, confidence: 0.85 },
    { pattern: /Permission denied/i, confidence: 0.9 },
    { pattern: /ENOENT/i, confidence: 0.8 },
    { pattern: /EACCES/i, confidence: 0.85 },
    { pattern: /FATAL:/i, confidence: 0.95 },
    { pattern: /panic:/i, confidence: 0.9 },
  ] as PatternDef[],

  // Idle indicators (prompt visible) - Claude Code specific
  idle: [
    { pattern: /^>\s*$/m, confidence: 0.6 },
    { pattern: /^\$\s*$/m, confidence: 0.5 },
    { pattern: /^claude>\s*$/m, confidence: 0.85 },
    { pattern: /^❯\s*$/m, confidence: 0.7 },
    { pattern: /^\?\s*$/m, confidence: 0.75 },  // Claude Code prompt
    { pattern: /^claude-code>\s*$/m, confidence: 0.9 },
    { pattern: /Human:\s*$/m, confidence: 0.8 },  // Conversation prompt
  ] as PatternDef[],

  // File operation patterns (no confidence needed, these are informational)
  fileCreated: [
    /(?:Created|Wrote|Writing)\s+(?:file:?\s+)?['"]?([^\s'"]+\.[a-zA-Z0-9]+)/gi,
    /(?:Creating|New file:?)\s+['"]?([^\s'"]+\.[a-zA-Z0-9]+)/gi,
  ] as RegExp[],
  fileModified: [
    /(?:Edited|Modified|Updated|Updating)\s+['"]?([^\s'"]+\.[a-zA-Z0-9]+)/gi,
    /(?:Edit|Write)\s+['"]?([^\s'"]+\.[a-zA-Z0-9]+)/gi,
  ] as RegExp[],
  fileDeleted: [
    /(?:Deleted|Removed|Removing)\s+(?:file:?\s+)?['"]?([^\s'"]+\.[a-zA-Z0-9]+)/gi,
  ] as RegExp[],

  // Task summary extraction
  taskSummary: [
    /^(?:I'll|I will|Let me|I'm going to)\s+(.+?)(?:\.|$)/im,
    /^(?:Working on|Starting|Beginning)\s+(.+?)(?:\.|$)/im,
    /^(?:Task|Goal):\s*(.+?)(?:\.|$)/im,
  ] as RegExp[],
};

// Minimum confidence threshold to accept a state detection
const MIN_CONFIDENCE_THRESHOLD = 0.5;

export class ClaudeCodeAnalyzer {
  private lastAnalyzedOutput = '';
  private currentTaskSummary: string | null = null;
  private recentFileChanges: FileChange[] = [];
  private lastErrorMessage: string | null = null;
  private lastActivityState: AgentActivityState = 'idle';
  private lastConfidence: number = 0;

  /**
   * Strip ANSI escape sequences from output for cleaner pattern matching.
   * Handles color codes, cursor movement, and other terminal control sequences.
   */
  private stripAnsi(str: string): string {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
  }

  /**
   * Match patterns with confidence scoring.
   * Returns the highest confidence match.
   */
  private matchPatternsWithConfidence(
    content: string,
    patterns: PatternDef[]
  ): { matched: boolean; confidence: number } {
    let bestConfidence = 0;
    let matched = false;

    for (const { pattern, confidence } of patterns) {
      if (pattern.test(content)) {
        matched = true;
        if (confidence > bestConfidence) {
          bestConfidence = confidence;
        }
      }
    }

    return { matched, confidence: bestConfidence };
  }

  analyze(output: string): AnalysisResult {
    const result: AnalysisResult = {};

    // Only analyze new content
    const newContent = output.slice(this.lastAnalyzedOutput.length);
    if (!newContent.trim()) {
      return result;
    }
    this.lastAnalyzedOutput = output;

    // Strip ANSI codes for cleaner pattern matching
    const cleanContent = this.stripAnsi(newContent);

    // Track best state detection with confidence
    let bestState: AgentActivityState | undefined;
    let bestConfidence = 0;

    // Check for errors first (highest priority)
    const errorMatch = this.matchPatternsWithConfidence(cleanContent, PATTERNS.error);
    if (errorMatch.matched && errorMatch.confidence >= MIN_CONFIDENCE_THRESHOLD) {
      bestState = 'error';
      bestConfidence = errorMatch.confidence;

      // Extract error message from the first matching pattern
      for (const { pattern } of PATTERNS.error) {
        const errorLine = cleanContent.split('\n').find(line => pattern.test(line));
        if (errorLine) {
          this.lastErrorMessage = errorLine.slice(0, 200);
          result.errorMessage = this.lastErrorMessage;
          break;
        }
      }
    }

    // Check for waiting for input (high priority, can override error in some cases)
    if (!bestState || bestConfidence < 0.9) {
      const waitingMatch = this.matchPatternsWithConfidence(cleanContent, PATTERNS.waitingForInput);
      if (waitingMatch.matched && waitingMatch.confidence > bestConfidence) {
        bestState = 'waiting_for_input';
        bestConfidence = waitingMatch.confidence;
      }
    }

    // Check for working state
    if (!bestState || bestConfidence < 0.8) {
      const workingMatch = this.matchPatternsWithConfidence(cleanContent, PATTERNS.working);
      if (workingMatch.matched && workingMatch.confidence > bestConfidence) {
        bestState = 'working';
        bestConfidence = workingMatch.confidence;
      }
    }

    // Check for completion (transitions to idle)
    if (!bestState || bestConfidence < 0.7) {
      const completeMatch = this.matchPatternsWithConfidence(cleanContent, PATTERNS.complete);
      if (completeMatch.matched && completeMatch.confidence > bestConfidence) {
        bestState = 'idle';
        bestConfidence = completeMatch.confidence;
      }
    }

    // Check for idle (prompt visible)
    if (!bestState || bestConfidence < 0.6) {
      const idleMatch = this.matchPatternsWithConfidence(cleanContent, PATTERNS.idle);
      if (idleMatch.matched && idleMatch.confidence > bestConfidence) {
        bestState = 'idle';
        bestConfidence = idleMatch.confidence;
      }
    }

    // Apply the best detected state if confidence is sufficient
    if (bestState && bestConfidence >= MIN_CONFIDENCE_THRESHOLD) {
      result.activityState = bestState;
      result.confidence = bestConfidence;
      this.lastActivityState = bestState;
      this.lastConfidence = bestConfidence;
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

  private extractFileChanges(content: string): FileChange[] {
    const changes: FileChange[] = [];
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

  private isValidFilePath(path: string): boolean {
    // Filter out common false positives
    if (!path || path.length < 3) return false;
    if (path.startsWith('http://') || path.startsWith('https://')) return false;
    if (/^[a-z]+:\/\//i.test(path)) return false;
    if (/^\d+\.\d+\.\d+/.test(path)) return false; // Version numbers
    return true;
  }

  getCurrentState(): AgentActivityState {
    return this.lastActivityState;
  }

  getLastConfidence(): number {
    return this.lastConfidence;
  }

  getTaskSummary(): string | null {
    return this.currentTaskSummary;
  }

  getRecentFileChanges(): FileChange[] {
    return [...this.recentFileChanges];
  }

  getErrorMessage(): string | null {
    return this.lastErrorMessage;
  }

  clearError(): void {
    this.lastErrorMessage = null;
    if (this.lastActivityState === 'error') {
      this.lastActivityState = 'idle';
      this.lastConfidence = 0;
    }
  }

  reset(): void {
    this.lastAnalyzedOutput = '';
    this.currentTaskSummary = null;
    this.recentFileChanges = [];
    this.lastErrorMessage = null;
    this.lastActivityState = 'idle';
    this.lastConfidence = 0;
  }
}

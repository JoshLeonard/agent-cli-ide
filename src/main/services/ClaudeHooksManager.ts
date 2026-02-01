import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

interface HookCommand {
  type: 'command';
  command: string;
}

interface HookMatcher {
  matcher: string;
  hooks: HookCommand[];
}

interface ClaudeSettings {
  hooks?: {
    Stop?: HookMatcher[];
    Notification?: HookMatcher[];
    PostToolUse?: HookMatcher[];
    SessionStart?: HookMatcher[];
    [key: string]: HookMatcher[] | undefined;
  };
  [key: string]: unknown;
}

// Marker to identify hooks managed by Terminal IDE
const TERMINAL_IDE_HOOK_MARKER = 'terminal-ide-state-hook';

export class ClaudeHooksManager {
  private hookScriptPath: string | null = null;

  async initialize(): Promise<void> {
    await this.ensureHookScript();
  }

  /**
   * Get or install the hook script to the user's app data directory.
   */
  private async ensureHookScript(): Promise<string> {
    if (this.hookScriptPath && fs.existsSync(this.hookScriptPath)) {
      return this.hookScriptPath;
    }

    const appDataDir = app.getPath('userData');
    const hookScriptDir = path.join(appDataDir, 'hooks');
    const hookScriptPath = path.join(hookScriptDir, 'hook-state.js');

    // Ensure directory exists
    if (!fs.existsSync(hookScriptDir)) {
      fs.mkdirSync(hookScriptDir, { recursive: true });
    }

    // Copy hook script from resources if not present or outdated
    const sourceScript = path.join(process.resourcesPath || path.join(__dirname, '../../..'), 'resources', 'hook-state.js');

    // In development, use relative path from src
    let scriptContent: string;
    if (fs.existsSync(sourceScript)) {
      scriptContent = fs.readFileSync(sourceScript, 'utf8');
    } else {
      // Fallback: check local dev path
      const devScript = path.join(__dirname, '../../../resources/hook-state.js');
      if (fs.existsSync(devScript)) {
        scriptContent = fs.readFileSync(devScript, 'utf8');
      } else {
        // Inline the script as ultimate fallback
        scriptContent = this.getInlineHookScript();
      }
    }

    fs.writeFileSync(hookScriptPath, scriptContent, 'utf8');
    this.hookScriptPath = hookScriptPath;

    return hookScriptPath;
  }

  private getInlineHookScript(): string {
    return `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

const STATE_MAP = {
  'idle': 'idle',
  'working': 'working',
  'waiting': 'waiting_for_input',
};

function getStateDir() {
  return path.join(os.tmpdir(), 'terminal-ide-states');
}

function ensureStateDir(stateDir) {
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }
}

function writeState(state, sessionId) {
  const stateDir = getStateDir();
  ensureStateDir(stateDir);
  const stateFile = path.join(stateDir, sessionId + '.json');
  const mappedState = STATE_MAP[state] || state;
  const stateData = { state: mappedState, timestamp: Date.now() };
  try {
    fs.writeFileSync(stateFile, JSON.stringify(stateData), 'utf8');
  } catch (err) {
    process.exit(1);
  }
}

const args = process.argv.slice(2);
if (args.length < 2) {
  process.exit(1);
}
writeState(args[0], args[1]);
`;
  }

  /**
   * Ensure hooks are configured in the project's .claude/settings.json.
   * Merges Terminal IDE hooks with any existing user hooks.
   */
  async ensureHooksConfigured(workdir: string, sessionId: string): Promise<boolean> {
    try {
      const hookScriptPath = await this.ensureHookScript();
      const claudeDir = path.join(workdir, '.claude');
      const settingsPath = path.join(claudeDir, 'settings.json');

      // Ensure .claude directory exists
      if (!fs.existsSync(claudeDir)) {
        fs.mkdirSync(claudeDir, { recursive: true });
      }

      // Load existing settings or create new
      let settings: ClaudeSettings = {};
      if (fs.existsSync(settingsPath)) {
        try {
          const content = fs.readFileSync(settingsPath, 'utf8');
          settings = JSON.parse(content);
        } catch {
          // Corrupted settings file, start fresh
          settings = {};
        }
      }

      // Ensure hooks object exists
      if (!settings.hooks) {
        settings.hooks = {};
      }

      // Create hook commands for this session
      // Escape the script path for command line usage
      const escapedPath = hookScriptPath.replace(/\\/g, '/');
      const createHookCommand = (state: string): HookCommand => ({
        type: 'command',
        command: `node "${escapedPath}" ${state} ${sessionId}`,
      });

      // Define Terminal IDE hooks
      const terminalIdeHooks: Record<string, HookMatcher> = {
        Stop: {
          matcher: TERMINAL_IDE_HOOK_MARKER,
          hooks: [createHookCommand('idle')],
        },
        Notification: {
          matcher: TERMINAL_IDE_HOOK_MARKER,
          hooks: [createHookCommand('waiting')],
        },
        SessionStart: {
          matcher: TERMINAL_IDE_HOOK_MARKER,
          hooks: [createHookCommand('idle')],
        },
      };

      // Merge hooks - preserve user hooks, add/update Terminal IDE hooks
      for (const [hookType, hookMatcher] of Object.entries(terminalIdeHooks)) {
        const existingHooks = settings.hooks[hookType] || [];

        // Remove any existing Terminal IDE hooks for this session
        const filteredHooks = existingHooks.filter(
          (h) => !h.matcher.includes(TERMINAL_IDE_HOOK_MARKER) || !h.hooks.some((cmd) => cmd.command.includes(sessionId))
        );

        // Add our hook
        filteredHooks.push(hookMatcher);
        settings.hooks[hookType] = filteredHooks;
      }

      // Write updated settings
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');

      return true;
    } catch (error) {
      console.error('Failed to configure Claude hooks:', error);
      return false;
    }
  }

  /**
   * Remove Terminal IDE hooks for a specific session from the project.
   */
  async cleanupHooks(workdir: string, sessionId: string): Promise<void> {
    try {
      const settingsPath = path.join(workdir, '.claude', 'settings.json');

      if (!fs.existsSync(settingsPath)) {
        return;
      }

      const content = fs.readFileSync(settingsPath, 'utf8');
      const settings: ClaudeSettings = JSON.parse(content);

      if (!settings.hooks) {
        return;
      }

      let modified = false;

      // Remove hooks that reference this session
      for (const hookType of Object.keys(settings.hooks)) {
        const hooks = settings.hooks[hookType];
        if (!hooks) continue;

        const filtered = hooks.filter(
          (h) => !h.hooks.some((cmd) => cmd.command.includes(sessionId))
        );

        if (filtered.length !== hooks.length) {
          settings.hooks[hookType] = filtered.length > 0 ? filtered : undefined;
          modified = true;
        }
      }

      // Clean up empty hooks object
      if (modified) {
        const hasHooks = Object.values(settings.hooks).some((h) => h && h.length > 0);
        if (!hasHooks) {
          delete settings.hooks;
        }

        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
      }
    } catch {
      // Cleanup failure is not critical
    }
  }

  /**
   * Check if hooks are properly configured for a session.
   */
  isHooksConfigured(workdir: string, sessionId: string): boolean {
    try {
      const settingsPath = path.join(workdir, '.claude', 'settings.json');

      if (!fs.existsSync(settingsPath)) {
        return false;
      }

      const content = fs.readFileSync(settingsPath, 'utf8');
      const settings: ClaudeSettings = JSON.parse(content);

      if (!settings.hooks || !settings.hooks.Stop) {
        return false;
      }

      // Check if our session's hooks are configured
      return settings.hooks.Stop.some(
        (h) => h.hooks.some((cmd) => cmd.command.includes(sessionId))
      );
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const claudeHooksManager = new ClaudeHooksManager();

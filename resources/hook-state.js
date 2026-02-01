#!/usr/bin/env node
/**
 * hook-state.js - Claude Code hook script for Terminal IDE state management
 *
 * Called by Claude Code hooks to report state changes to Terminal IDE.
 * Writes state JSON to a temp file that HookStateWatcherService monitors.
 *
 * Usage: node hook-state.js <state> <session-id>
 * States: idle, working, waiting
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const STATE_MAP = {
  'idle': 'idle',
  'working': 'working',
  'waiting': 'waiting_for_input',
};

function getStateDir() {
  const tmpDir = os.tmpdir();
  return path.join(tmpDir, 'terminal-ide-states');
}

function ensureStateDir(stateDir) {
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }
}

function writeState(state, sessionId) {
  const stateDir = getStateDir();
  ensureStateDir(stateDir);

  const stateFile = path.join(stateDir, `${sessionId}.json`);
  const mappedState = STATE_MAP[state] || state;

  const stateData = {
    state: mappedState,
    timestamp: Date.now(),
  };

  try {
    fs.writeFileSync(stateFile, JSON.stringify(stateData), 'utf8');
  } catch (err) {
    // Silently fail - don't interrupt Claude Code's operation
    process.exit(1);
  }
}

// Main
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node hook-state.js <state> <session-id>');
  process.exit(1);
}

const [state, sessionId] = args;
writeState(state, sessionId);

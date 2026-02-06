import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.terminalIDE API
global.window.terminalIDE = {
  // Add mock implementations of the preload API
  onSessionCreated: vi.fn(),
  onSessionOutput: vi.fn(),
  onSessionTerminated: vi.fn(),
  onSessionUpdated: vi.fn(),
  onAgentStatusUpdated: vi.fn(),
  onActivityEvent: vi.fn(),
  onMessageReceived: vi.fn(),
  onWorktreeChanged: vi.fn(),
  onLayoutUpdate: vi.fn(),
  onProjectsUpdate: vi.fn(),
  onSettingsUpdate: vi.fn(),

  // Mock IPC methods
  createSession: vi.fn(),
  terminateSession: vi.fn(),
  writeToSession: vi.fn(),
  resizeTerminal: vi.fn(),
  listAgents: vi.fn(),
  createWorktree: vi.fn(),
  removeWorktree: vi.fn(),
  sendMessage: vi.fn(),

  // Add more as needed
} as any;

// Suppress console errors during tests (optional)
const originalError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});

afterEach(() => {
  console.error = originalError;
});

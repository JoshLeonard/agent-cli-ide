import { describe, it, expect, beforeEach } from 'vitest';
import { ActivityParser } from './ActivityParser';

describe('ActivityParser', () => {
  let parser: ActivityParser;

  beforeEach(() => {
    parser = new ActivityParser();
  });

  const createContext = (sessionId = 'test-session') => ({
    sessionId,
    agentId: 'test-agent',
    agentName: 'Test Agent',
    agentIcon: '🤖'
  });

  describe('file operations', () => {
    it('should detect file creation', () => {
      const output = 'Created file: src/test.ts';
      const events = parser.parseOutput(output, createContext());

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('file_created');
      expect(events[0].severity).toBe('success');
      expect(events[0].title).toContain('test.ts');
      expect(events[0].filePath).toBe('src/test.ts');
    });

    it('should detect file modification', () => {
      const output = 'Edited src/main.ts';
      const events = parser.parseOutput(output, createContext());

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('file_modified');
      expect(events[0].severity).toBe('info');
      expect(events[0].title).toContain('main.ts');
    });

    it('should detect file deletion', () => {
      const output = 'Deleted old/deprecated.ts';
      const events = parser.parseOutput(output, createContext());

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('file_deleted');
      expect(events[0].severity).toBe('warning');
      expect(events[0].title).toContain('deprecated.ts');
    });

    it('should filter out invalid file paths', () => {
      const output = `
        Created http://example.com/file.ts
        Created 192.168.1.1.ts
        Created -help.ts
      `;
      const events = parser.parseOutput(output, createContext());

      // All should be filtered out (URL, IP-like, starts with dash)
      expect(events).toHaveLength(0);
    });
  });

  describe('error detection', () => {
    it('should detect TypeScript errors', () => {
      const output = "error TS2345: Type 'string' is not assignable to type 'number'";
      const events = parser.parseOutput(output, createContext());

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('error');
      expect(events[0].severity).toBe('error');
      expect(events[0].title).toContain('TS2345');
    });

    it('should detect generic errors', () => {
      const output = 'Error: Cannot find module "test"';
      const events = parser.parseOutput(output, createContext());

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('error');
      expect(events[0].severity).toBe('error');
    });

    it('should detect npm errors', () => {
      const output = 'npm ERR! Failed to install package';
      const events = parser.parseOutput(output, createContext());

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('error');
      expect(events[0].details).toContain('npm:');
    });

    it('should detect git fatal errors', () => {
      const output = 'fatal: Not a git repository';
      const events = parser.parseOutput(output, createContext());

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('error');
      expect(events[0].details).toContain('git:');
    });
  });

  describe('warnings', () => {
    it('should detect warning messages', () => {
      const output = 'warning: Deprecated API usage';
      const events = parser.parseOutput(output, createContext());

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('warning');
      expect(events[0].severity).toBe('warning');
    });
  });

  describe('git commits', () => {
    it('should detect git commit confirmation', () => {
      const output = '[main abc1234] Add new feature';
      const events = parser.parseOutput(output, createContext());

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('git_commit');
      expect(events[0].severity).toBe('success');
      expect(events[0].title).toBe('Changes committed');
    });
  });

  describe('ANSI escape sequences', () => {
    it('should strip ANSI codes before parsing', () => {
      const output = '\x1b[32mCreated file: test.ts\x1b[0m';
      const events = parser.parseOutput(output, createContext());

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('file_created');
    });
  });

  describe('incremental parsing', () => {
    it('should only parse new content on subsequent calls', () => {
      const context = createContext();

      const events1 = parser.parseOutput('Created file: first.ts', context);
      expect(events1).toHaveLength(1);

      const events2 = parser.parseOutput('Created file: first.ts\nCreated file: second.ts', context);
      expect(events2).toHaveLength(1);
      expect(events2[0].filePath).toBe('second.ts');
    });
  });

  describe('deduplication', () => {
    it('should deduplicate identical events within same session', () => {
      const context = createContext();

      // First parse
      const events1 = parser.parseOutput('Created file: test.ts\nCreated file: test.ts', context);

      // Should only get one event due to deduplication
      expect(events1).toHaveLength(1);
      expect(events1[0].filePath).toBe('test.ts');
    });
  });

  describe('reset', () => {
    it('should reset parser state', () => {
      const context = createContext();

      parser.parseOutput('Created file: test.ts', context);
      parser.reset();

      const events = parser.parseOutput('Created file: test.ts', context);
      expect(events).toHaveLength(1); // Should parse again after reset
    });
  });

  describe('session management', () => {
    it('should track parsing position per session', () => {
      const session1 = createContext('session-1');
      const session2 = createContext('session-2');

      parser.parseOutput('Created file: one.ts', session1);
      parser.parseOutput('Created file: two.ts', session2);

      // Both sessions should have parsed their respective files
      const events1 = parser.parseOutput('Created file: one.ts\nCreated file: three.ts', session1);
      const events2 = parser.parseOutput('Created file: two.ts\nCreated file: four.ts', session2);

      expect(events1[0].filePath).toBe('three.ts');
      expect(events2[0].filePath).toBe('four.ts');
    });

    it('should reset specific session', () => {
      const context = createContext();

      parser.parseOutput('Created file: test.ts', context);
      parser.resetSession(context.sessionId);

      const events = parser.parseOutput('Created file: test.ts', context);
      expect(events).toHaveLength(0); // Still deduplicated, but position reset
    });
  });
});

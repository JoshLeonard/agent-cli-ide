import { describe, it, expect, beforeEach } from 'vitest';
import { ActivityParser } from '../../../src/main/services/ActivityParser';

describe('ActivityParser', () => {
  let parser: ActivityParser;

  const defaultContext = {
    sessionId: 'test-session-123',
    agentId: 'claude-code',
    agentName: 'Claude Code',
    agentIcon: '🤖'
  };

  beforeEach(() => {
    parser = new ActivityParser();
  });

  describe('file operations parsing', () => {
    describe('file created', () => {
      it('should detect "Created" pattern', () => {
        const output = 'Created file: src/components/Button.tsx';
        const events = parser.parseOutput(output, defaultContext);

        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
          type: 'file_created',
          severity: 'success',
          title: 'File created: Button.tsx',
          filePath: 'src/components/Button.tsx',
          sessionId: 'test-session-123'
        });
      });

      it('should detect "Wrote" pattern', () => {
        const output = 'Wrote src/utils/helper.js';
        const events = parser.parseOutput(output, defaultContext);

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe('file_created');
        expect(events[0].filePath).toBe('src/utils/helper.js');
      });

      it('should detect "Writing to" pattern', () => {
        const output = 'Writing to index.html';
        const events = parser.parseOutput(output, defaultContext);

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe('file_created');
      });

      it('should detect "New file" pattern', () => {
        const output = 'New file: package.json';
        const events = parser.parseOutput(output, defaultContext);

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe('file_created');
      });
    });

    describe('file modified', () => {
      it('should detect "Edited" pattern', () => {
        const output = 'Edited src/App.tsx';
        const events = parser.parseOutput(output, defaultContext);

        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
          type: 'file_modified',
          severity: 'info',
          title: 'File modified: App.tsx'
        });
      });

      it('should detect "Modified" pattern', () => {
        const output = 'Modified config/settings.json';
        const events = parser.parseOutput(output, defaultContext);

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe('file_modified');
      });

      it('should detect "Updated" pattern', () => {
        const output = 'Updated test/spec.test.ts';
        const events = parser.parseOutput(output, defaultContext);

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe('file_modified');
      });
    });

    describe('file deleted', () => {
      it('should detect "Deleted" pattern', () => {
        const output = 'Deleted old_file.txt';
        const events = parser.parseOutput(output, defaultContext);

        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
          type: 'file_deleted',
          severity: 'warning',
          title: 'File deleted: old_file.txt'
        });
      });

      it('should detect "Removed" pattern', () => {
        const output = 'Removed temp/cache.json';
        const events = parser.parseOutput(output, defaultContext);

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe('file_deleted');
      });
    });
  });

  describe('error parsing', () => {
    it('should detect TypeScript errors', () => {
      const output = "error TS2304: Cannot find name 'foo'.";
      const events = parser.parseOutput(output, defaultContext);

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'error',
        severity: 'error',
        title: 'Error TS2304',
        details: "Cannot find name 'foo'."
      });
    });

    it('should detect JavaScript errors', () => {
      const output = 'TypeError: Cannot read property of undefined';
      const events = parser.parseOutput(output, defaultContext);

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'error',
        severity: 'error',
        title: 'Error'
      });
    });

    it('should detect npm errors', () => {
      const output = 'npm ERR! code ENOENT';
      const events = parser.parseOutput(output, defaultContext);

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'error',
        severity: 'error',
        details: 'npm: code ENOENT'
      });
    });

    it('should detect git fatal errors', () => {
      const output = 'fatal: not a git repository';
      const events = parser.parseOutput(output, defaultContext);

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'error',
        severity: 'error',
        details: 'git: not a git repository'
      });
    });

    it('should detect generic ERROR prefix', () => {
      const output = 'ERROR: Something went wrong';
      const events = parser.parseOutput(output, defaultContext);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('error');
    });
  });

  describe('warning parsing', () => {
    it('should detect "warning:" pattern', () => {
      const output = 'warning: deprecated API usage';
      const events = parser.parseOutput(output, defaultContext);

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'warning',
        severity: 'warning',
        title: 'Warning'
      });
    });

    it('should detect "WARN" pattern', () => {
      const output = 'WARN Package is deprecated';
      const events = parser.parseOutput(output, defaultContext);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('warning');
    });
  });

  describe('task completion parsing', () => {
    it('should detect "Task completed" pattern', () => {
      const output = 'Task completed: Build finished';
      const events = parser.parseOutput(output, defaultContext);

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'task_completed',
        severity: 'success'
      });
    });

    it('should detect checkmark pattern', () => {
      const output = '✓ Tests passed';
      const events = parser.parseOutput(output, defaultContext);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('task_completed');
    });

    it('should detect "Successfully" pattern', () => {
      const output = 'Successfully compiled';
      const events = parser.parseOutput(output, defaultContext);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('task_completed');
    });
  });

  describe('git commit parsing', () => {
    it('should detect git commit output', () => {
      const output = '[main abc1234] Add new feature\n 1 file changed, 10 insertions(+)';
      const events = parser.parseOutput(output, defaultContext);

      expect(events.some(e => e.type === 'git_commit')).toBe(true);
    });

    it('should detect commit on feature branch', () => {
      const output = '[feature/auth 1234567] Implement login';
      const events = parser.parseOutput(output, defaultContext);

      expect(events.some(e => e.type === 'git_commit')).toBe(true);
    });
  });

  describe('ANSI stripping', () => {
    it('should strip ANSI escape codes before parsing', () => {
      const output = '\x1b[32mCreated\x1b[0m file: \x1b[33mtest.ts\x1b[0m';
      const events = parser.parseOutput(output, defaultContext);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('file_created');
    });

    it('should handle complex ANSI sequences', () => {
      const output = '\x1b[1;31merror TS2304:\x1b[0m Cannot find name';
      const events = parser.parseOutput(output, defaultContext);

      expect(events.some(e => e.type === 'error')).toBe(true);
    });
  });

  describe('incremental parsing', () => {
    it('should only parse new content since last position', () => {
      const output1 = 'Created file1.ts';
      const output2 = 'Created file1.ts\nCreated file2.ts';

      // First parse
      const events1 = parser.parseOutput(output1, defaultContext);
      expect(events1).toHaveLength(1);
      expect(events1[0].filePath).toBe('file1.ts');

      // Second parse with appended content
      const events2 = parser.parseOutput(output2, defaultContext);
      expect(events2).toHaveLength(1);
      expect(events2[0].filePath).toBe('file2.ts');
    });

    it('should track position per session', () => {
      const context1 = { ...defaultContext, sessionId: 'session-1' };
      const context2 = { ...defaultContext, sessionId: 'session-2' };

      parser.parseOutput('Created file1.ts', context1);
      const events2 = parser.parseOutput('Created file2.ts', context2);

      // Should parse from beginning for new session
      expect(events2).toHaveLength(1);
      expect(events2[0].filePath).toBe('file2.ts');
    });
  });

  describe('deduplication', () => {
    it('should not emit duplicate events', () => {
      const output = 'Created file.ts';
      parser.parseOutput(output, defaultContext);

      // Reset position but keep dedup cache
      parser.resetSession(defaultContext.sessionId);

      // Parse same content again
      const events = parser.parseOutput(output, defaultContext);
      expect(events).toHaveLength(0);
    });
  });

  describe('file path validation', () => {
    it('should reject URLs', () => {
      const output = 'Created https://example.com/file.js';
      const events = parser.parseOutput(output, defaultContext);

      expect(events).toHaveLength(0);
    });

    it('should reject version numbers', () => {
      const output = 'Created 1.2.3.txt';
      const events = parser.parseOutput(output, defaultContext);

      expect(events).toHaveLength(0);
    });

    it('should reject paths starting with dash', () => {
      const output = 'Created -flag.txt';
      const events = parser.parseOutput(output, defaultContext);

      expect(events).toHaveLength(0);
    });

    it('should reject very short paths', () => {
      // Paths less than 3 characters are rejected
      const output = 'Created ab';
      const events = parser.parseOutput(output, defaultContext);

      expect(events).toHaveLength(0);
    });
  });

  describe('event properties', () => {
    it('should include agent context in events', () => {
      const output = 'Created test.ts';
      const events = parser.parseOutput(output, defaultContext);

      expect(events[0]).toMatchObject({
        agentId: 'claude-code',
        agentName: 'Claude Code',
        agentIcon: '🤖'
      });
    });

    it('should generate unique event IDs', () => {
      const output = 'Created file1.ts\nModified file2.ts';
      const events = parser.parseOutput(output, defaultContext);

      const ids = events.map(e => e.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should include timestamp in events', () => {
      const before = Date.now();
      const output = 'Created test.ts';
      const events = parser.parseOutput(output, defaultContext);
      const after = Date.now();

      expect(events[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(events[0].timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('reset methods', () => {
    it('should reset session position with resetSession', () => {
      const output = 'Created file.ts';
      parser.parseOutput(output, defaultContext);
      parser.resetSession(defaultContext.sessionId);

      // After reset, should have fresh dedup cache behavior
      // But note: dedup cache is separate from position
    });

    it('should clear all state with reset', () => {
      parser.parseOutput('Created file.ts', defaultContext);
      parser.reset();

      // After full reset, should parse from beginning
      const events = parser.parseOutput('Created file.ts', defaultContext);
      expect(events).toHaveLength(1);
    });
  });

  describe('multiple events in single output', () => {
    it('should detect multiple file operations', () => {
      const output = `Created src/index.ts
Modified package.json
Deleted temp.txt`;

      const events = parser.parseOutput(output, defaultContext);

      expect(events).toHaveLength(3);
      expect(events.map(e => e.type)).toEqual([
        'file_created',
        'file_modified',
        'file_deleted'
      ]);
    });

    it('should detect errors and warnings together', () => {
      const output = `error TS2304: Cannot find name 'foo'
warning: Using deprecated API`;

      const events = parser.parseOutput(output, defaultContext);

      expect(events).toHaveLength(2);
      expect(events.map(e => e.type)).toContain('error');
      expect(events.map(e => e.type)).toContain('warning');
    });
  });

  describe('edge cases', () => {
    it('should handle empty output', () => {
      const events = parser.parseOutput('', defaultContext);
      expect(events).toHaveLength(0);
    });

    it('should handle whitespace-only output', () => {
      const events = parser.parseOutput('   \n\t\n  ', defaultContext);
      expect(events).toHaveLength(0);
    });

    it('should handle output with no matching patterns', () => {
      const output = 'Just some regular text with no patterns';
      const events = parser.parseOutput(output, defaultContext);
      expect(events).toHaveLength(0);
    });
  });
});

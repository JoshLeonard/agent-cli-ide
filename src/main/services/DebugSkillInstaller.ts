import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';

/**
 * Service to install/uninstall the debug skill file for Claude Code agents.
 * The skill file (.claude/commands/debug.md) teaches Claude Code how to use
 * the Terminal IDE Debug HTTP API.
 */
class DebugSkillInstaller {
  /**
   * Install the debug skill to a working directory.
   * Creates .claude/commands/debug.md with API documentation.
   */
  async installSkill(workdir: string): Promise<void> {
    // Ensure .claude/commands/ directory exists
    const commandsDir = path.join(workdir, '.claude', 'commands');
    await fs.mkdir(commandsDir, { recursive: true });

    // Read skill template from resources
    const template = await this.getSkillTemplate();

    // Write to .claude/commands/debug.md
    const skillPath = path.join(commandsDir, 'debug.md');
    await fs.writeFile(skillPath, template, 'utf8');

    console.log(`[DebugSkillInstaller] Installed skill to ${skillPath}`);
  }

  /**
   * Uninstall the debug skill from a working directory.
   */
  async uninstallSkill(workdir: string): Promise<void> {
    const skillPath = path.join(workdir, '.claude', 'commands', 'debug.md');

    try {
      await fs.access(skillPath);
      await fs.unlink(skillPath);
      console.log(`[DebugSkillInstaller] Uninstalled skill from ${skillPath}`);
    } catch {
      // File doesn't exist, nothing to do
    }
  }

  /**
   * Check if skill is installed in a working directory.
   */
  async isSkillInstalled(workdir: string): Promise<boolean> {
    const skillPath = path.join(workdir, '.claude', 'commands', 'debug.md');
    try {
      await fs.access(skillPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the skill template content.
   * In production, this would read from resources/commands/debug.md.
   * For now, it's embedded as a string for simplicity.
   */
  private async getSkillTemplate(): Promise<string> {
    // Try to read from resources first
    try {
      const resourcesPath = app.isPackaged
        ? path.join(process.resourcesPath, 'commands', 'debug.md')
        : path.join(__dirname, '..', '..', '..', 'resources', 'commands', 'debug.md');

      const content = await fs.readFile(resourcesPath, 'utf8');
      return content;
    } catch {
      // Fallback to embedded template
      return this.getEmbeddedTemplate();
    }
  }

  /**
   * Embedded skill template as fallback.
   */
  private getEmbeddedTemplate(): string {
    return `# /debug - Terminal IDE Debug API

Use this command to control the debugger programmatically via the Terminal IDE Debug HTTP API.

## Environment Variables

These environment variables are set automatically when the session is created with Debug API enabled:

- \`TERMINAL_IDE_DEBUG_API\` - API base URL (e.g., http://127.0.0.1:47832)
- \`TERMINAL_IDE_DEBUG_TOKEN\` - Authentication token for this session
- \`TERMINAL_IDE_DEBUG_SESSION\` - Current debug session ID (if attached)

## Quick Commands

### Check API Status
\`\`\`bash
curl "$TERMINAL_IDE_DEBUG_API/status"
\`\`\`

### Set a Breakpoint
\`\`\`bash
curl -X POST "$TERMINAL_IDE_DEBUG_API/session/$TERMINAL_IDE_DEBUG_SESSION/breakpoint" \\
  -H "Authorization: Bearer $TERMINAL_IDE_DEBUG_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"file": "/absolute/path/to/file.py", "line": 42}'
\`\`\`

### Remove a Breakpoint
\`\`\`bash
curl -X DELETE "$TERMINAL_IDE_DEBUG_API/session/$TERMINAL_IDE_DEBUG_SESSION/breakpoint" \\
  -H "Authorization: Bearer $TERMINAL_IDE_DEBUG_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"breakpointId": "bp-123"}'
\`\`\`

### Continue Execution
\`\`\`bash
curl -X POST "$TERMINAL_IDE_DEBUG_API/session/$TERMINAL_IDE_DEBUG_SESSION/continue" \\
  -H "Authorization: Bearer $TERMINAL_IDE_DEBUG_TOKEN"
\`\`\`

### Pause Execution
\`\`\`bash
curl -X POST "$TERMINAL_IDE_DEBUG_API/session/$TERMINAL_IDE_DEBUG_SESSION/pause" \\
  -H "Authorization: Bearer $TERMINAL_IDE_DEBUG_TOKEN"
\`\`\`

### Step Over
\`\`\`bash
curl -X POST "$TERMINAL_IDE_DEBUG_API/session/$TERMINAL_IDE_DEBUG_SESSION/step-over" \\
  -H "Authorization: Bearer $TERMINAL_IDE_DEBUG_TOKEN"
\`\`\`

### Step Into
\`\`\`bash
curl -X POST "$TERMINAL_IDE_DEBUG_API/session/$TERMINAL_IDE_DEBUG_SESSION/step-into" \\
  -H "Authorization: Bearer $TERMINAL_IDE_DEBUG_TOKEN"
\`\`\`

### Step Out
\`\`\`bash
curl -X POST "$TERMINAL_IDE_DEBUG_API/session/$TERMINAL_IDE_DEBUG_SESSION/step-out" \\
  -H "Authorization: Bearer $TERMINAL_IDE_DEBUG_TOKEN"
\`\`\`

### Get Call Stack
\`\`\`bash
curl "$TERMINAL_IDE_DEBUG_API/session/$TERMINAL_IDE_DEBUG_SESSION/stack" \\
  -H "Authorization: Bearer $TERMINAL_IDE_DEBUG_TOKEN"
\`\`\`

### Get Current Debug State
\`\`\`bash
curl "$TERMINAL_IDE_DEBUG_API/session/$TERMINAL_IDE_DEBUG_SESSION/state" \\
  -H "Authorization: Bearer $TERMINAL_IDE_DEBUG_TOKEN"
\`\`\`

### Get Scopes for a Stack Frame
\`\`\`bash
# Get scopes for frame 0 (top of stack)
curl "$TERMINAL_IDE_DEBUG_API/session/$TERMINAL_IDE_DEBUG_SESSION/scopes/0" \\
  -H "Authorization: Bearer $TERMINAL_IDE_DEBUG_TOKEN"
\`\`\`

### Get Variables in a Scope
\`\`\`bash
# Use variablesReference from scopes response
curl "$TERMINAL_IDE_DEBUG_API/session/$TERMINAL_IDE_DEBUG_SESSION/variables/1" \\
  -H "Authorization: Bearer $TERMINAL_IDE_DEBUG_TOKEN"
\`\`\`

### Evaluate an Expression
\`\`\`bash
curl -X POST "$TERMINAL_IDE_DEBUG_API/session/$TERMINAL_IDE_DEBUG_SESSION/evaluate" \\
  -H "Authorization: Bearer $TERMINAL_IDE_DEBUG_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"expression": "myVariable.toString()", "frameId": 0}'
\`\`\`

### Get Console Messages
\`\`\`bash
curl "$TERMINAL_IDE_DEBUG_API/session/$TERMINAL_IDE_DEBUG_SESSION/console" \\
  -H "Authorization: Bearer $TERMINAL_IDE_DEBUG_TOKEN"

# Filter by level (error, warn, info, log, debug) and limit results
curl "$TERMINAL_IDE_DEBUG_API/session/$TERMINAL_IDE_DEBUG_SESSION/console?level=error,warn&limit=50" \\
  -H "Authorization: Bearer $TERMINAL_IDE_DEBUG_TOKEN"
\`\`\`

### Get Exceptions
\`\`\`bash
curl "$TERMINAL_IDE_DEBUG_API/session/$TERMINAL_IDE_DEBUG_SESSION/exceptions" \\
  -H "Authorization: Bearer $TERMINAL_IDE_DEBUG_TOKEN"

# Limit results
curl "$TERMINAL_IDE_DEBUG_API/session/$TERMINAL_IDE_DEBUG_SESSION/exceptions?limit=20" \\
  -H "Authorization: Bearer $TERMINAL_IDE_DEBUG_TOKEN"
\`\`\`

## Typical Debugging Workflow

1. **Set breakpoints** at suspicious lines using the breakpoint endpoint
2. **Run/continue** the program until it hits a breakpoint
3. **Check console messages and exceptions** for errors or diagnostic output
4. **Inspect the call stack** to understand the execution path
5. **Get scopes** for the current frame to see available variables
6. **Get variables** to inspect their values
7. **Evaluate expressions** to test hypotheses about the bug
8. **Step through code** (over/into/out) to trace execution
9. **Continue or set more breakpoints** as needed

## Response Formats

### Breakpoint Response
\`\`\`json
{
  "breakpoints": [
    {
      "id": "bp-123",
      "verified": true,
      "source": "/path/to/file.py",
      "line": 42
    }
  ]
}
\`\`\`

### Call Stack Response
\`\`\`json
{
  "callStack": [
    {
      "id": 0,
      "name": "myFunction",
      "source": "/path/to/file.py",
      "line": 42,
      "column": 1
    }
  ]
}
\`\`\`

### Scopes Response
\`\`\`json
{
  "scopes": [
    {
      "name": "Local",
      "variablesReference": 1
    },
    {
      "name": "Global",
      "variablesReference": 2
    }
  ]
}
\`\`\`

### Variables Response
\`\`\`json
{
  "variables": [
    {
      "name": "myVar",
      "value": "42",
      "type": "int",
      "variablesReference": 0
    }
  ]
}
\`\`\`

### Evaluate Response
\`\`\`json
{
  "result": "42",
  "type": "int"
}
\`\`\`

### Console Messages Response
\`\`\`json
{
  "messages": [
    {
      "id": "msg-123",
      "sessionId": "session-456",
      "level": "error",
      "text": "TypeError: Cannot read property 'foo' of undefined",
      "source": "/path/to/file.js",
      "line": 42,
      "timestamp": 1699999999999
    }
  ]
}
\`\`\`

### Exceptions Response
\`\`\`json
{
  "exceptions": [
    {
      "id": "exc-789",
      "sessionId": "session-456",
      "description": "TypeError: Cannot read property 'foo' of undefined",
      "breakMode": "uncaught",
      "details": {
        "stackTrace": "at myFunction (/path/to/file.js:42:10)"
      },
      "timestamp": 1699999999999
    }
  ]
}
\`\`\`

## Error Handling

All endpoints return JSON responses. Errors include an \`error\` field:

\`\`\`json
{
  "error": "Debug session not found"
}
\`\`\`

Common HTTP status codes:
- 200: Success
- 400: Bad request (missing parameters)
- 401: Unauthorized (invalid or missing token)
- 404: Not found (invalid endpoint or session)
- 500: Internal server error

## Notes

- The debug session ID is provided in the \`TERMINAL_IDE_DEBUG_SESSION\` environment variable
- All file paths must be absolute paths
- The API only accepts connections from localhost (127.0.0.1)
- Tokens are session-specific and are invalidated when the session closes
`;
  }
}

// Singleton instance
export const debugSkillInstaller = new DebugSkillInstaller();

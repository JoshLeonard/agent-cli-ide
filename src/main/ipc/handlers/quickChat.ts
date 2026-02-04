import { ipcMain, BrowserWindow } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import { agentService } from '../../services/AgentService';
import type { QuickChatRequest, QuickChatResponse } from '../../../shared/types/quickChat';

let currentProcess: ChildProcess | null = null;
let mainWindowRef: BrowserWindow | null = null;

export function registerQuickChatHandlers(mainWindow: BrowserWindow): void {
  mainWindowRef = mainWindow;

  // Cancel handler - allows killing the running process
  ipcMain.handle('quickchat:cancel', async (): Promise<{ success: boolean }> => {
    if (currentProcess) {
      try {
        // On Windows, need to kill the process tree
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', currentProcess.pid!.toString(), '/f', '/t'], { shell: true });
        } else {
          currentProcess.kill('SIGTERM');
        }
        currentProcess = null;
        // Send completion signal
        mainWindow.webContents.send('quickchat:output', {
          data: '\n[Cancelled]\n',
          isComplete: true,
        });
        return { success: true };
      } catch {
        return { success: false };
      }
    }
    return { success: true };
  });

  ipcMain.handle('quickchat:execute', async (
    _event,
    request: QuickChatRequest
  ): Promise<QuickChatResponse> => {
    const { agentId, prompt, cwd } = request;

    // Get agent config
    const agent = agentService.getAgent(agentId);
    if (!agent) {
      return {
        success: false,
        error: `Agent '${agentId}' not found`,
      };
    }

    if (!agent.quickChatCommand) {
      return {
        success: false,
        error: `Agent '${agent.name}' does not support quick chat`,
      };
    }

    // Kill any existing quick chat process
    if (currentProcess) {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', currentProcess.pid!.toString(), '/f', '/t'], { shell: true });
      } else {
        currentProcess.kill();
      }
      currentProcess = null;
    }

    return new Promise((resolve) => {
      let output = '';
      let errorOutput = '';

      // Build command args - quote the prompt to handle spaces
      const baseArgs: string[] = (agent.args || []).filter((arg): arg is string => arg !== undefined);
      const quickChatArgs: string[] = (agent.quickChatArgs || []).filter((arg): arg is string => arg !== undefined);
      // Escape any quotes in the prompt and wrap in quotes for shell
      const escapedPrompt = prompt.replace(/"/g, '\\"');
      const args: string[] = [...baseArgs, ...quickChatArgs, agent.quickChatCommand as string, `"${escapedPrompt}"`];

      try {
        // Use spawn with explicit stdio configuration
        const proc = spawn(agent.command, args, {
          cwd,
          shell: true,
          stdio: ['ignore', 'pipe', 'pipe'],  // Don't wait for stdin
          env: {
            ...process.env,
            FORCE_COLOR: '1',
          },
          windowsHide: true,
        });

        currentProcess = proc;

        proc.stdout!.on('data', (data: Buffer) => {
          const text = data.toString();
          output += text;
          // Stream output to renderer
          mainWindow.webContents.send('quickchat:output', {
            data: text,
            isComplete: false,
          });
        });

        proc.stderr!.on('data', (data: Buffer) => {
          const text = data.toString();
          errorOutput += text;
          // Also send stderr to renderer (some agents output to stderr)
          mainWindow.webContents.send('quickchat:output', {
            data: text,
            isComplete: false,
          });
        });

        proc.on('close', (exitCode: number | null) => {
          currentProcess = null;
          // Send completion signal
          mainWindow.webContents.send('quickchat:output', {
            data: '',
            isComplete: true,
          });

          resolve({
            success: exitCode === 0,
            output: output || errorOutput,
            exitCode: exitCode ?? undefined,
            error: exitCode !== 0 ? errorOutput || 'Process exited with non-zero code' : undefined,
          });
        });

        proc.on('error', (err: Error) => {
          currentProcess = null;
          mainWindow.webContents.send('quickchat:output', {
            data: '',
            isComplete: true,
          });

          resolve({
            success: false,
            error: `Failed to spawn process: ${err.message}`,
          });
        });
      } catch (err) {
        resolve({
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    });
  });
}

export function unregisterQuickChatHandlers(): void {
  // Kill any running process
  if (currentProcess) {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', currentProcess.pid!.toString(), '/f', '/t'], { shell: true });
    } else {
      currentProcess.kill();
    }
    currentProcess = null;
  }
  mainWindowRef = null;
  ipcMain.removeHandler('quickchat:execute');
  ipcMain.removeHandler('quickchat:cancel');
}

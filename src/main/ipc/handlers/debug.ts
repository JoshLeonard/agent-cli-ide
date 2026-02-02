import { ipcMain } from 'electron';
import { debuggerService } from '../../services/DebuggerService';
import { debugHttpServer } from '../../services/DebugHttpServer';
import { debugSkillInstaller } from '../../services/DebugSkillInstaller';

export function registerDebugHandlers(): void {
  // Session management
  ipcMain.handle('debug:attach', async (_, args) => {
    return debuggerService.attach(args.sessionId, args.config);
  });

  ipcMain.handle('debug:detach', async (_, args) => {
    return debuggerService.detach(args.sessionId);
  });

  ipcMain.handle('debug:getSession', async (_, args) => {
    return debuggerService.getSession(args.sessionId);
  });

  ipcMain.handle('debug:getAllSessions', async () => {
    return debuggerService.getAllSessions();
  });

  // Queries
  ipcMain.handle('debug:getConsoleMessages', async (_, args) => {
    return debuggerService.getConsoleMessages(args);
  });

  ipcMain.handle('debug:getExceptions', async (_, args) => {
    return debuggerService.getExceptions(args);
  });

  ipcMain.handle('debug:getCallStack', async (_, args) => {
    return debuggerService.getCallStack(args.sessionId);
  });

  ipcMain.handle('debug:getScopes', async (_, args) => {
    return debuggerService.getScopes(args.sessionId, args.frameId);
  });

  ipcMain.handle('debug:getVariables', async (_, args) => {
    return debuggerService.getVariables(args.sessionId, args.variablesReference);
  });

  // Breakpoints
  ipcMain.handle('debug:setBreakpoints', async (_, args) => {
    return debuggerService.setBreakpoints(args.sessionId, args.source, args.breakpoints);
  });

  ipcMain.handle('debug:removeBreakpoint', async (_, args) => {
    return debuggerService.removeBreakpoint(args.sessionId, args.breakpointId);
  });

  // Execution controls
  ipcMain.handle('debug:continue', async (_, args) => {
    return debuggerService.continue(args.sessionId);
  });

  ipcMain.handle('debug:pause', async (_, args) => {
    return debuggerService.pause(args.sessionId);
  });

  ipcMain.handle('debug:stepOver', async (_, args) => {
    return debuggerService.stepOver(args.sessionId);
  });

  ipcMain.handle('debug:stepInto', async (_, args) => {
    return debuggerService.stepInto(args.sessionId);
  });

  ipcMain.handle('debug:stepOut', async (_, args) => {
    return debuggerService.stepOut(args.sessionId);
  });

  // Evaluation
  ipcMain.handle('debug:evaluate', async (_, args) => {
    return debuggerService.evaluate(args.sessionId, args.expression, args.frameId);
  });

  // DAP presets
  ipcMain.handle('debug:getDAPPresets', async () => {
    return debuggerService.getDAPPresets();
  });

  // Debug HTTP API management
  ipcMain.handle('debug:enableApi', async (_, args) => {
    try {
      const { sessionId, workdir } = args;

      // Start HTTP server if not running
      await debugHttpServer.start();

      // Generate token for this session
      const token = debugHttpServer.generateToken(sessionId);

      // Install skill file
      await debugSkillInstaller.installSkill(workdir);

      return {
        success: true,
        apiUrl: debugHttpServer.getBaseUrl(),
        token,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to enable debug API',
      };
    }
  });

  ipcMain.handle('debug:disableApi', async (_, args) => {
    try {
      const { sessionId, workdir } = args;

      // Invalidate session tokens
      debugHttpServer.invalidateSessionTokens(sessionId);

      // Uninstall skill file
      await debugSkillInstaller.uninstallSkill(workdir);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to disable debug API',
      };
    }
  });

  ipcMain.handle('debug:getApiStatus', async () => {
    return {
      running: debugHttpServer.isServerRunning(),
      port: debugHttpServer.getPort(),
      url: debugHttpServer.getBaseUrl(),
    };
  });
}

export function unregisterDebugHandlers(): void {
  const channels = [
    'debug:attach', 'debug:detach', 'debug:getSession', 'debug:getAllSessions',
    'debug:getConsoleMessages', 'debug:getExceptions', 'debug:getCallStack',
    'debug:getScopes', 'debug:getVariables', 'debug:setBreakpoints',
    'debug:removeBreakpoint', 'debug:continue', 'debug:pause',
    'debug:stepOver', 'debug:stepInto', 'debug:stepOut', 'debug:evaluate',
    'debug:getDAPPresets', 'debug:enableApi', 'debug:disableApi', 'debug:getApiStatus',
  ];
  channels.forEach(channel => ipcMain.removeHandler(channel));
}

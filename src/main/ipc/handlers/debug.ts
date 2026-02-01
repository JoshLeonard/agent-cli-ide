import { ipcMain } from 'electron';
import { debuggerService } from '../../services/DebuggerService';

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
}

export function unregisterDebugHandlers(): void {
  const channels = [
    'debug:attach', 'debug:detach', 'debug:getSession', 'debug:getAllSessions',
    'debug:getConsoleMessages', 'debug:getExceptions', 'debug:getCallStack',
    'debug:getScopes', 'debug:getVariables', 'debug:setBreakpoints',
    'debug:removeBreakpoint', 'debug:continue', 'debug:pause',
    'debug:stepOver', 'debug:stepInto', 'debug:stepOut', 'debug:evaluate',
  ];
  channels.forEach(channel => ipcMain.removeHandler(channel));
}

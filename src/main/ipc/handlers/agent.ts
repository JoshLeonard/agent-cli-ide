import { ipcMain } from 'electron';
import { agentService } from '../../services/AgentService';
import { agentStatusTracker } from '../../services/AgentStatusTracker';

export function registerAgentHandlers(): void {
  ipcMain.handle('agent:list', () => {
    return agentService.getAgents();
  });

  ipcMain.handle('agent:listAvailable', () => {
    return agentService.getAvailableAgents();
  });

  ipcMain.handle('agent:discover', async () => {
    await agentService.discoverAgents();
    return agentService.getAgents();
  });

  ipcMain.handle('agent:getDefault', () => {
    return agentService.getDefaultAgent();
  });

  ipcMain.handle('agent:get', (_event, { agentId }: { agentId: string }) => {
    return agentService.getAgent(agentId);
  });

  // Agent status handlers
  ipcMain.handle('agentStatus:get', (_event, { sessionId }: { sessionId: string }) => {
    return agentStatusTracker.getStatus(sessionId);
  });

  ipcMain.handle('agentStatus:getAll', () => {
    return agentStatusTracker.getAllStatuses();
  });
}

export function unregisterAgentHandlers(): void {
  ipcMain.removeHandler('agent:list');
  ipcMain.removeHandler('agent:listAvailable');
  ipcMain.removeHandler('agent:discover');
  ipcMain.removeHandler('agent:getDefault');
  ipcMain.removeHandler('agent:get');
  ipcMain.removeHandler('agentStatus:get');
  ipcMain.removeHandler('agentStatus:getAll');
}

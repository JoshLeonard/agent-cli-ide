import { contextBridge, ipcRenderer } from 'electron';
const api = {
    // Session management
    session: {
        create: (config) => ipcRenderer.invoke('session:create', config),
        terminate: (sessionId) => ipcRenderer.invoke('session:terminate', { sessionId }),
        write: (sessionId, data) => ipcRenderer.invoke('session:write', { sessionId, data }),
        resize: (sessionId, cols, rows) => ipcRenderer.invoke('session:resize', { sessionId, cols, rows }),
        list: () => ipcRenderer.invoke('session:list'),
        get: (sessionId) => ipcRenderer.invoke('session:get', { sessionId }),
        onOutput: (callback) => {
            const handler = (_event, data) => callback(data);
            ipcRenderer.on('session:output', handler);
            return () => ipcRenderer.removeListener('session:output', handler);
        },
        onTerminated: (callback) => {
            const handler = (_event, data) => callback(data);
            ipcRenderer.on('session:terminated', handler);
            return () => ipcRenderer.removeListener('session:terminated', handler);
        },
        onUpdated: (callback) => {
            const handler = (_event, data) => callback(data);
            ipcRenderer.on('session:updated', handler);
            return () => ipcRenderer.removeListener('session:updated', handler);
        },
    },
    // Layout persistence
    layout: {
        save: (layout) => ipcRenderer.invoke('layout:save', layout),
        load: () => ipcRenderer.invoke('layout:load'),
    },
    // Full state persistence
    persistence: {
        restore: () => ipcRenderer.invoke('persistence:restore'),
    },
    // Dialogs
    dialog: {
        selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
    },
    // Agent management
    agent: {
        list: () => ipcRenderer.invoke('agent:list'),
        listAvailable: () => ipcRenderer.invoke('agent:listAvailable'),
        discover: () => ipcRenderer.invoke('agent:discover'),
        getDefault: () => ipcRenderer.invoke('agent:getDefault'),
        get: (agentId) => ipcRenderer.invoke('agent:get', { agentId }),
    },
    // Project management
    project: {
        open: (path) => ipcRenderer.invoke('project:open', { path }),
        close: () => ipcRenderer.invoke('project:close'),
        getCurrent: () => ipcRenderer.invoke('project:getCurrent'),
        getRecent: () => ipcRenderer.invoke('project:getRecent'),
        onUpdated: (callback) => {
            const handler = (_event, data) => callback(data);
            ipcRenderer.on('project:updated', handler);
            return () => ipcRenderer.removeListener('project:updated', handler);
        },
    },
    // Worktree management
    worktree: {
        list: (repoPath) => ipcRenderer.invoke('worktree:list', { repoPath }),
        remove: (worktreePath) => ipcRenderer.invoke('worktree:remove', { worktreePath }),
        cleanOrphaned: () => ipcRenderer.invoke('worktree:cleanOrphaned'),
        isGitRepo: (path) => ipcRenderer.invoke('worktree:isGitRepo', { path }),
    },
    // Agent status
    agentStatus: {
        get: (sessionId) => ipcRenderer.invoke('agentStatus:get', { sessionId }),
        getAll: () => ipcRenderer.invoke('agentStatus:getAll'),
        onUpdated: (callback) => {
            const handler = (_event, data) => callback(data);
            ipcRenderer.on('agentStatus:updated', handler);
            return () => ipcRenderer.removeListener('agentStatus:updated', handler);
        },
    },
    // Activity feed
    activity: {
        getEvents: (filter) => ipcRenderer.invoke('activity:getEvents', filter),
        clearEvents: (sessionId) => ipcRenderer.invoke('activity:clearEvents', { sessionId }),
        onEvent: (callback) => {
            const handler = (_event, data) => callback(data);
            ipcRenderer.on('activity:event', handler);
            return () => ipcRenderer.removeListener('activity:event', handler);
        },
    },
    // Messaging
    messaging: {
        send: (targetSessionIds, content, options) => ipcRenderer.invoke('messaging:send', { targetSessionIds, content, options }),
        broadcast: (content, options, excludeSessionId) => ipcRenderer.invoke('messaging:broadcast', { content, options, excludeSessionId }),
        setClipboard: (content, sourceSessionId) => ipcRenderer.invoke('messaging:setClipboard', { content, sourceSessionId }),
        getClipboard: () => ipcRenderer.invoke('messaging:getClipboard'),
        onSent: (callback) => {
            const handler = (_event, data) => callback(data);
            ipcRenderer.on('message:sent', handler);
            return () => ipcRenderer.removeListener('message:sent', handler);
        },
        onReceived: (callback) => {
            const handler = (_event, data) => callback(data);
            ipcRenderer.on('message:received', handler);
            return () => ipcRenderer.removeListener('message:received', handler);
        },
    },
};
contextBridge.exposeInMainWorld('terminalIDE', api);
//# sourceMappingURL=index.js.map
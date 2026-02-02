import React, { useEffect, useCallback, useState } from 'react';
import { useDebuggerStore } from '../../stores/debuggerStore';
import { useLayoutStore } from '../../stores/layoutStore';
import type { DebugConsoleMessage, DebugSessionInfo, DebugProtocol, DAPPreset } from '../../../shared/types/debug';
import './DebugPanel.css';

interface DAPPresetInfo {
  name: string;
  adapterPath: string;
  installCommand: string;
}

interface DebugPanelProps {
  onSelectSession?: (sessionId: string) => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ onSelectSession }) => {
  const {
    sessions,
    consoleMessages,
    exceptions,
    selectedSessionId,
    selectSession,
    getFilteredMessages,
    initializeSubscriptions,
    addSession,
  } = useDebuggerStore();

  const { activePanel, getAllPanels } = useLayoutStore();

  // Attach form state
  const [showAttachForm, setShowAttachForm] = useState(false);
  const [attachProtocol, setAttachProtocol] = useState<DebugProtocol>('cdp');
  const [attachPort, setAttachPort] = useState('9229');
  const [attachError, setAttachError] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);

  // DAP-specific state
  const [dapPreset, setDapPreset] = useState<DAPPreset>('python');
  const [dapPresets, setDapPresets] = useState<Record<DAPPreset, DAPPresetInfo> | null>(null);
  const [dapAdapterPath, setDapAdapterPath] = useState('');
  const [dapAdapterArgs, setDapAdapterArgs] = useState('');
  const [dapProgram, setDapProgram] = useState('');
  const [dapArgs, setDapArgs] = useState('');
  const [dapCwd, setDapCwd] = useState('');
  const [dapAttachMode, setDapAttachMode] = useState(false);

  // Initialize subscriptions on mount
  useEffect(() => {
    const unsubscribe = initializeSubscriptions();
    return unsubscribe;
  }, [initializeSubscriptions]);

  // Fetch DAP presets on mount
  useEffect(() => {
    window.terminalIDE.debug.getDAPPresets().then(setDapPresets).catch(console.error);
  }, []);

  // Update adapter path when preset changes
  useEffect(() => {
    if (dapPresets && dapPreset !== 'custom') {
      const preset = dapPresets[dapPreset];
      if (preset) {
        setDapAdapterPath(preset.adapterPath);
      }
    }
  }, [dapPreset, dapPresets]);

  const sessionList = Array.from(sessions.values());
  const filteredMessages = getFilteredMessages();
  const selectedSession = selectedSessionId ? sessions.get(selectedSessionId) : null;

  const getLevelClass = (level: DebugConsoleMessage['level']): string => {
    switch (level) {
      case 'error': return 'level-error';
      case 'warn': return 'level-warn';
      case 'info': return 'level-info';
      case 'debug': return 'level-debug';
      default: return 'level-log';
    }
  };

  const getLevelIcon = (level: DebugConsoleMessage['level']): string => {
    switch (level) {
      case 'error': return '\u2717'; // ✗
      case 'warn': return '\u26A0'; // ⚠
      case 'info': return '\u2139'; // ℹ
      case 'debug': return '\u2699'; // ⚙
      default: return '\u25CF'; // ●
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  };

  const getStateIcon = (state: DebugSessionInfo['state']): string => {
    switch (state) {
      case 'connected': return '\u25CF'; // ●
      case 'running': return '\u25B6'; // ▶
      case 'paused': return '\u23F8'; // ⏸
      case 'disconnected': return '\u25CB'; // ○
      case 'connecting': return '\u21BB'; // ↻
      case 'terminated': return '\u25A0'; // ■
      default: return '\u25CF';
    }
  };

  const getStateClass = (state: DebugSessionInfo['state']): string => {
    switch (state) {
      case 'connected':
      case 'running': return 'state-running';
      case 'paused': return 'state-paused';
      case 'disconnected':
      case 'terminated': return 'state-disconnected';
      case 'connecting': return 'state-connecting';
      default: return '';
    }
  };

  const handleContinue = useCallback(async () => {
    if (selectedSessionId) {
      await window.terminalIDE.debug.continue(selectedSessionId);
    }
  }, [selectedSessionId]);

  const handlePause = useCallback(async () => {
    if (selectedSessionId) {
      await window.terminalIDE.debug.pause(selectedSessionId);
    }
  }, [selectedSessionId]);

  const handleStepOver = useCallback(async () => {
    if (selectedSessionId) {
      await window.terminalIDE.debug.stepOver(selectedSessionId);
    }
  }, [selectedSessionId]);

  const handleStepInto = useCallback(async () => {
    if (selectedSessionId) {
      await window.terminalIDE.debug.stepInto(selectedSessionId);
    }
  }, [selectedSessionId]);

  const handleStepOut = useCallback(async () => {
    if (selectedSessionId) {
      await window.terminalIDE.debug.stepOut(selectedSessionId);
    }
  }, [selectedSessionId]);

  const handleDetach = useCallback(async () => {
    if (selectedSessionId) {
      await window.terminalIDE.debug.detach(selectedSessionId);
    }
  }, [selectedSessionId]);

  // Get current terminal session ID for attaching
  const panels = getAllPanels();
  const activePanelData = panels.find(p => p.id === activePanel);
  const currentTerminalSessionId = activePanelData?.sessionId;

  const handleAttach = useCallback(async () => {
    if (!currentTerminalSessionId) {
      setAttachError('No active terminal session');
      return;
    }

    setAttaching(true);
    setAttachError(null);

    try {
      if (attachProtocol === 'cdp') {
        const port = parseInt(attachPort);
        if (isNaN(port) || port < 1 || port > 65535) {
          setAttachError('Invalid port number');
          setAttaching(false);
          return;
        }

        const result = await window.terminalIDE.debug.attach(currentTerminalSessionId, {
          protocol: 'cdp',
          host: '127.0.0.1',
          port,
        });

        if (result.success && result.debugSessionId) {
          setShowAttachForm(false);
          setAttachPort('9229');
        } else {
          setAttachError(result.error || 'Failed to attach');
        }
      } else if (attachProtocol === 'dap') {
        // Validate DAP config
        if (!dapAdapterPath.trim()) {
          setAttachError('Adapter path is required');
          setAttaching(false);
          return;
        }

        if (!dapAttachMode && !dapProgram.trim()) {
          setAttachError('Program path is required for launch mode');
          setAttaching(false);
          return;
        }

        const result = await window.terminalIDE.debug.attach(currentTerminalSessionId, {
          protocol: 'dap',
          dap: {
            adapterPath: dapAdapterPath.trim(),
            adapterArgs: dapAdapterArgs.trim() ? dapAdapterArgs.split(/\s+/) : undefined,
            program: dapProgram.trim() || undefined,
            args: dapArgs.trim() ? dapArgs.split(/\s+/) : undefined,
            cwd: dapCwd.trim() || undefined,
            attachPort: dapAttachMode && attachPort ? parseInt(attachPort) : undefined,
          },
        });

        if (result.success && result.debugSessionId) {
          setShowAttachForm(false);
          // Reset form
          setDapProgram('');
          setDapArgs('');
          setDapCwd('');
        } else {
          setAttachError(result.error || 'Failed to attach');
        }
      }
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : 'Failed to attach');
    } finally {
      setAttaching(false);
    }
  }, [currentTerminalSessionId, attachProtocol, attachPort, dapAdapterPath, dapAdapterArgs, dapProgram, dapArgs, dapCwd, dapAttachMode]);

  return (
    <div className="debug-panel">
      {/* Debug Sessions */}
      <div className="debug-section">
        <div className="debug-section-header">
          <span className="debug-section-title">Debug Sessions</span>
          <span className="debug-section-count">{sessionList.length}</span>
          <button
            className="debug-attach-btn"
            onClick={() => setShowAttachForm(!showAttachForm)}
            title="Attach to Node.js debugger"
          >
            +
          </button>
        </div>

        {/* Attach Form */}
        {showAttachForm && (
          <div className="debug-attach-form">
            {/* Protocol Selection */}
            <div className="attach-form-row">
              <label>Protocol:</label>
              <select
                className="attach-form-select"
                value={attachProtocol}
                onChange={(e) => setAttachProtocol(e.target.value as DebugProtocol)}
                disabled={attaching}
              >
                <option value="cdp">CDP (Node.js/Chrome)</option>
                <option value="dap">DAP (Python/Go/C#/Rust)</option>
              </select>
            </div>

            {attachProtocol === 'cdp' ? (
              /* CDP Form */
              <>
                <div className="attach-form-row">
                  <label>Port:</label>
                  <input
                    type="text"
                    value={attachPort}
                    onChange={(e) => setAttachPort(e.target.value)}
                    placeholder="9229"
                    disabled={attaching}
                  />
                </div>
                <div className="attach-form-hint">
                  Run: node --inspect-brk yourscript.js
                </div>
              </>
            ) : (
              /* DAP Form */
              <>
                <div className="attach-form-row">
                  <label>Language:</label>
                  <select
                    className="attach-form-select"
                    value={dapPreset}
                    onChange={(e) => setDapPreset(e.target.value as DAPPreset)}
                    disabled={attaching}
                  >
                    {dapPresets && Object.entries(dapPresets).map(([key, preset]) => (
                      <option key={key} value={key}>{preset.name}</option>
                    ))}
                  </select>
                </div>
                <div className="attach-form-row">
                  <label>Adapter:</label>
                  <input
                    type="text"
                    value={dapAdapterPath}
                    onChange={(e) => setDapAdapterPath(e.target.value)}
                    placeholder="e.g., python, dlv, netcoredbg"
                    disabled={attaching || dapPreset !== 'custom'}
                  />
                </div>
                {dapPreset === 'custom' && (
                  <div className="attach-form-row">
                    <label>Args:</label>
                    <input
                      type="text"
                      value={dapAdapterArgs}
                      onChange={(e) => setDapAdapterArgs(e.target.value)}
                      placeholder="Adapter arguments"
                      disabled={attaching}
                    />
                  </div>
                )}
                <div className="attach-form-row">
                  <label>Mode:</label>
                  <select
                    className="attach-form-select"
                    value={dapAttachMode ? 'attach' : 'launch'}
                    onChange={(e) => setDapAttachMode(e.target.value === 'attach')}
                    disabled={attaching}
                  >
                    <option value="launch">Launch</option>
                    <option value="attach">Attach</option>
                  </select>
                </div>
                {!dapAttachMode ? (
                  <>
                    <div className="attach-form-row">
                      <label>Program:</label>
                      <input
                        type="text"
                        value={dapProgram}
                        onChange={(e) => setDapProgram(e.target.value)}
                        placeholder="Path to program"
                        disabled={attaching}
                      />
                    </div>
                    <div className="attach-form-row">
                      <label>Args:</label>
                      <input
                        type="text"
                        value={dapArgs}
                        onChange={(e) => setDapArgs(e.target.value)}
                        placeholder="Program arguments"
                        disabled={attaching}
                      />
                    </div>
                  </>
                ) : (
                  <div className="attach-form-row">
                    <label>Port:</label>
                    <input
                      type="text"
                      value={attachPort}
                      onChange={(e) => setAttachPort(e.target.value)}
                      placeholder="Debug port"
                      disabled={attaching}
                    />
                  </div>
                )}
                <div className="attach-form-row">
                  <label>CWD:</label>
                  <input
                    type="text"
                    value={dapCwd}
                    onChange={(e) => setDapCwd(e.target.value)}
                    placeholder="Working directory (optional)"
                    disabled={attaching}
                  />
                </div>
                {dapPresets && dapPreset !== 'custom' && dapPresets[dapPreset]?.installCommand && (
                  <div className="attach-form-hint">
                    Install: {dapPresets[dapPreset].installCommand}
                  </div>
                )}
              </>
            )}

            {attachError && (
              <div className="attach-form-error">{attachError}</div>
            )}

            <div className="attach-form-row" style={{ marginTop: '8px' }}>
              <button
                className="attach-form-btn"
                onClick={handleAttach}
                disabled={attaching}
                style={{ marginLeft: 'auto' }}
              >
                {attaching ? '...' : (dapAttachMode ? 'Attach' : 'Launch')}
              </button>
            </div>
          </div>
        )}

        <div className="debug-sessions-list">
          {sessionList.length === 0 && !showAttachForm ? (
            <div className="debug-empty">No active debug sessions</div>
          ) : sessionList.length === 0 ? null : (
            sessionList.map((session) => (
              <div
                key={session.id}
                className={`debug-session-item ${selectedSessionId === session.id ? 'selected' : ''}`}
                onClick={() => selectSession(session.id)}
              >
                <span className={`debug-session-state ${getStateClass(session.state)}`}>
                  {getStateIcon(session.state)}
                </span>
                <span className="debug-session-id">{session.id.slice(0, 8)}</span>
                <span className="debug-session-protocol">{session.protocol.toUpperCase()}</span>
                {session.pausedAt && (
                  <span className="debug-session-location">
                    {session.pausedAt.source.split('/').pop()}:{session.pausedAt.line}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Debug Controls */}
      {selectedSession && (
        <div className="debug-section">
          <div className="debug-section-header">
            <span className="debug-section-title">Controls</span>
          </div>
          <div className="debug-controls">
            {selectedSession.state === 'paused' ? (
              <>
                <button className="debug-btn" onClick={handleContinue} title="Continue (F5)">
                  ▶
                </button>
                <button className="debug-btn" onClick={handleStepOver} title="Step Over (F10)">
                  ⤵
                </button>
                <button className="debug-btn" onClick={handleStepInto} title="Step Into (F11)">
                  ↓
                </button>
                <button className="debug-btn" onClick={handleStepOut} title="Step Out (Shift+F11)">
                  ↑
                </button>
              </>
            ) : (
              <button className="debug-btn" onClick={handlePause} title="Pause (F6)">
                ⏸
              </button>
            )}
            <button className="debug-btn disconnect" onClick={handleDetach} title="Disconnect">
              ⏹
            </button>
          </div>
        </div>
      )}

      {/* Call Stack */}
      {selectedSession && selectedSession.callStack.length > 0 && (
        <div className="debug-section">
          <div className="debug-section-header">
            <span className="debug-section-title">Call Stack</span>
          </div>
          <div className="debug-callstack">
            {selectedSession.callStack.map((frame, index) => (
              <div key={frame.id || index} className="debug-stack-frame">
                <span className="frame-name">{frame.name}</span>
                {frame.source && frame.line && (
                  <span className="frame-location">
                    {frame.source.split('/').pop()}:{frame.line}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Console Messages */}
      <div className="debug-section debug-section-grow">
        <div className="debug-section-header">
          <span className="debug-section-title">Console</span>
          <span className="debug-section-count">{filteredMessages.length}</span>
        </div>
        <div className="debug-console">
          {filteredMessages.length === 0 ? (
            <div className="debug-empty">No console messages</div>
          ) : (
            filteredMessages.map((msg) => (
              <div key={msg.id} className={`debug-console-message ${getLevelClass(msg.level)}`}>
                <span className="console-level-icon">{getLevelIcon(msg.level)}</span>
                <span className="console-timestamp">{formatTimestamp(msg.timestamp)}</span>
                <span className="console-message">{msg.message}</span>
                {msg.source && msg.line && (
                  <span className="console-source">
                    {msg.source.split('/').pop()}:{msg.line}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Exceptions */}
      {exceptions.length > 0 && (
        <div className="debug-section">
          <div className="debug-section-header">
            <span className="debug-section-title">Exceptions</span>
            <span className="debug-section-count error">{exceptions.length}</span>
          </div>
          <div className="debug-exceptions">
            {exceptions.slice(-10).map((exc) => (
              <div key={exc.id} className="debug-exception-item">
                <div className="exception-header">
                  <span className="exception-type">{exc.exceptionType}</span>
                  <span className="exception-timestamp">{formatTimestamp(exc.timestamp)}</span>
                </div>
                <div className="exception-message">{exc.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

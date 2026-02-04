import React, { useState, useEffect, useRef } from 'react';
import { useQuickChatStore } from '../../stores/quickChatStore';
import { useProjectStore } from '../../stores/projectStore';
import type { AgentConfig } from '../../../shared/types/agent';
import './QuickChatDialog.css';

export const QuickChatDialog: React.FC = () => {
  const {
    isOpen,
    isRunning,
    selectedAgentId,
    prompt,
    output,
    error,
    close,
    setAgent,
    setPrompt,
    appendOutput,
    clearOutput,
    setRunning,
    setError,
    reset,
  } = useQuickChatStore();

  const currentProject = useProjectStore((state) => state.currentProject);
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const outputRef = useRef<HTMLPreElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Load available AI agents with quickChatCommand support
  useEffect(() => {
    const loadAgents = async () => {
      const availableAgents = await window.terminalIDE.agent.listAvailable();
      // Filter to only AI agents with quickChatCommand support
      const quickChatAgents = availableAgents.filter(
        (a) => a.category === 'ai-agent' && a.quickChatCommand
      );
      setAgents(quickChatAgents);
      // Select first available agent if none selected
      if (!selectedAgentId && quickChatAgents.length > 0) {
        setAgent(quickChatAgents[0].id);
      }
    };
    if (isOpen) {
      loadAgents();
    }
  }, [isOpen, selectedAgentId, setAgent]);

  // Subscribe to output events
  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = window.terminalIDE.quickChat.onOutput((event) => {
      if (event.data) {
        appendOutput(event.data);
      }
      if (event.isComplete) {
        setRunning(false);
      }
    });

    return () => unsubscribe();
  }, [isOpen, appendOutput, setRunning]);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen && !isRunning) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, isRunning]);

  // Handle escape key - always allow closing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dialogRef.current &&
        !dialogRef.current.contains(e.target as Node)
      ) {
        handleClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleClose = async () => {
    // If running, cancel the process first
    if (isRunning) {
      await window.terminalIDE.quickChat.cancel();
    }
    reset();
    close();
  };

  const handleSubmit = async () => {
    if (!selectedAgentId || !prompt.trim() || isRunning) return;

    const cwd = currentProject?.path || process.cwd();

    setError(null);
    clearOutput();
    setRunning(true);

    try {
      const result = await window.terminalIDE.quickChat.execute({
        agentId: selectedAgentId,
        prompt: prompt.trim(),
        cwd,
      });

      if (!result.success && result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute quick chat');
      setRunning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isOpen) return null;

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  return (
    <div className="quick-chat-overlay">
      <div className="quick-chat-dialog" ref={dialogRef}>
        <div className="quick-chat-header">
          <h3>Quick Chat</h3>
          <button
            className="close-btn"
            onClick={handleClose}
            title={isRunning ? "Cancel and Close" : "Close"}
          >
            &times;
          </button>
        </div>

        <div className="quick-chat-content">
          {/* Agent selection */}
          <div className="agent-section">
            <label>Agent:</label>
            <select
              value={selectedAgentId || ''}
              onChange={(e) => setAgent(e.target.value)}
              disabled={isRunning || agents.length === 0}
            >
              {agents.length === 0 ? (
                <option value="">No AI agents available</option>
              ) : (
                agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.icon} {agent.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Prompt input */}
          <div className="prompt-section">
            <label>Question:</label>
            <textarea
              ref={inputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              rows={3}
              disabled={isRunning}
            />
          </div>

          {/* Output area */}
          {(output || isRunning) && (
            <div className="output-section">
              <label>Response:</label>
              <pre ref={outputRef} className="output-content">
                {output || (isRunning ? 'Waiting for response...' : '')}
                {isRunning && <span className="cursor-blink">|</span>}
              </pre>
            </div>
          )}

          {/* Error display */}
          {error && <div className="error-message">{error}</div>}
        </div>

        <div className="quick-chat-footer">
          <span className="footer-hint">
            {selectedAgent ? `Using ${selectedAgent.command} ${selectedAgent.quickChatCommand}` : ''}
          </span>
          <div className="footer-actions">
            <button
              className="cancel-btn"
              onClick={handleClose}
            >
              {isRunning ? 'Cancel' : 'Close'}
            </button>
            <button
              className="submit-btn"
              onClick={handleSubmit}
              disabled={isRunning || !selectedAgentId || !prompt.trim()}
            >
              {isRunning ? 'Running...' : 'Ask'} (Ctrl+Enter)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

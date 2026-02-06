import React, { useState, useEffect } from 'react';
import type { AgentConfig } from '../../../shared/types/agent';
import { useSettingsStore } from '../../stores/settingsStore';
import './SettingsDialog.css';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onClose }) => {
  const { settings, updateSettings, resetSettings } = useSettingsStore();
  const [defaultRows, setDefaultRows] = useState(settings.grid.defaultRows);
  const [defaultCols, setDefaultCols] = useState(settings.grid.defaultCols);
  const [defaultAgentId, setDefaultAgentId] = useState<string | null>(settings.codeReview?.defaultAgentId ?? null);
  const [aiAgents, setAiAgents] = useState<AgentConfig[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  // Load available AI agents when dialog opens
  useEffect(() => {
    if (isOpen) {
      window.terminalIDE.agent.listAvailable().then((agents: AgentConfig[]) => {
        setAiAgents(agents.filter((a: AgentConfig) => a.category === 'ai-agent' && a.quickChatCommand));
      });
    }
  }, [isOpen]);

  // Sync local state when dialog opens or settings change
  useEffect(() => {
    if (isOpen) {
      setDefaultRows(settings.grid.defaultRows);
      setDefaultCols(settings.grid.defaultCols);
      setDefaultAgentId(settings.codeReview?.defaultAgentId ?? null);
      setIsDirty(false);
    }
  }, [isOpen, settings]);

  // Track changes
  useEffect(() => {
    const hasChanges =
      defaultRows !== settings.grid.defaultRows ||
      defaultCols !== settings.grid.defaultCols ||
      defaultAgentId !== (settings.codeReview?.defaultAgentId ?? null);
    setIsDirty(hasChanges);
  }, [defaultRows, defaultCols, defaultAgentId, settings]);

  const handleSave = async () => {
    await updateSettings({
      grid: { defaultRows, defaultCols },
      codeReview: { defaultAgentId },
    });
    onClose();
  };

  const handleReset = async () => {
    await resetSettings();
    // Local state will sync via settings change
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && isDirty) {
      handleSave();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="dialog settings-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>Settings</h2>
          <button className="dialog-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="dialog-content">
          <div className="settings-section">
            <h3>Default Grid Layout</h3>
            <p className="settings-description">
              Set the default grid dimensions when opening a new project or clearing sessions.
            </p>

            <div className="settings-grid-config">
              <div className="form-group">
                <label htmlFor="defaultRows">Rows</label>
                <select
                  id="defaultRows"
                  value={defaultRows}
                  onChange={(e) => setDefaultRows(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid-preview-separator">x</div>

              <div className="form-group">
                <label htmlFor="defaultCols">Columns</label>
                <select
                  id="defaultCols"
                  value={defaultCols}
                  onChange={(e) => setDefaultCols(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid-preview">
                <div
                  className="grid-preview-cells"
                  style={{
                    gridTemplateRows: `repeat(${defaultRows}, 1fr)`,
                    gridTemplateColumns: `repeat(${defaultCols}, 1fr)`,
                  }}
                >
                  {Array.from({ length: defaultRows * defaultCols }).map((_, i) => (
                    <div key={i} className="grid-preview-cell" />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3>Code Review</h3>
            <p className="settings-description">
              Choose the default AI agent for code reviews.
            </p>

            <div className="form-group">
              <label htmlFor="defaultAgent">Default AI Agent</label>
              <select
                id="defaultAgent"
                value={defaultAgentId || ''}
                onChange={(e) => setDefaultAgentId(e.target.value || null)}
              >
                <option value="">Auto (first available)</option>
                {aiAgents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.icon} {agent.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="dialog-footer">
          <button type="button" className="btn-secondary" onClick={handleReset}>
            Reset to Defaults
          </button>
          <div className="dialog-footer-spacer" />
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={!isDirty}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

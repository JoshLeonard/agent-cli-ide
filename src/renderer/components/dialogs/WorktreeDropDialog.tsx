import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import type { AgentConfig } from '../../../shared/types/agent';
import './WorktreeDropDialog.css';

interface WorktreeDropDialogProps {
  isOpen: boolean;
  worktreePath: string;
  worktreeBranch: string;
  showMoveOption: boolean;
  onSelectShell: (agentId: string) => void;
  onMoveSession: () => void;
  onCancel: () => void;
}

interface ShellOption {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export const WorktreeDropDialog: React.FC<WorktreeDropDialogProps> = ({
  isOpen,
  worktreePath,
  worktreeBranch,
  showMoveOption,
  onSelectShell,
  onMoveSession,
  onCancel,
}) => {
  const [shellOptions, setShellOptions] = useState<ShellOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      // Load shell agents from the agent service
      window.terminalIDE.agent.list().then((agents: AgentConfig[]) => {
        // Filter to only shell agents that are available
        const shells = agents
          .filter(agent => agent.category === 'shell' && agent.available)
          .map(agent => ({
            id: agent.id,
            name: agent.name,
            icon: agent.icon || '⬛',
            description: agent.description || '',
          }));
        setShellOptions(shells);
        setLoading(false);
      });
    }
  }, [isOpen]);

  // Get the display name for the worktree (branch name or folder)
  const displayName = worktreeBranch || worktreePath.split(/[/\\]/).pop() || 'worktree';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="Open Worktree"
    >
      <div className="worktree-drop-dialog">
        <div className="worktree-drop-header">
          <span className="worktree-drop-branch">{displayName}</span>
          <span className="worktree-drop-path" title={worktreePath}>
            {worktreePath}
          </span>
        </div>

        {loading ? (
          <div className="worktree-drop-loading">Loading shells...</div>
        ) : (
          <div className="worktree-drop-options">
            {showMoveOption && (
              <>
                <button
                  className="worktree-drop-option worktree-drop-option-move"
                  onClick={onMoveSession}
                >
                  <span className="worktree-drop-option-icon">↪</span>
                  <span className="worktree-drop-option-content">
                    <span className="worktree-drop-option-label">Move session here</span>
                    <span className="worktree-drop-option-description">
                      Move the existing session to this panel
                    </span>
                  </span>
                </button>
                <div className="worktree-drop-divider">
                  <span>or open new shell</span>
                </div>
              </>
            )}

            {shellOptions.map(shell => (
              <button
                key={shell.id}
                className="worktree-drop-option"
                onClick={() => onSelectShell(shell.id)}
              >
                <span className="worktree-drop-option-icon">{shell.icon}</span>
                <span className="worktree-drop-option-content">
                  <span className="worktree-drop-option-label">{shell.name}</span>
                  {shell.description && (
                    <span className="worktree-drop-option-description">
                      {shell.description}
                    </span>
                  )}
                </span>
              </button>
            ))}

            {shellOptions.length === 0 && !loading && (
              <div className="worktree-drop-empty">
                No shells available
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

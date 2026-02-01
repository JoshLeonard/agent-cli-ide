import React, { useState, useEffect, useCallback } from 'react';
import { useLayoutStore } from '../../stores/layoutStore';
import { useProjectStore } from '../../stores/projectStore';
import { useActivityFeedStore } from '../../stores/activityFeedStore';
import { SessionStatusBadge } from './SessionStatusBadge';
import { ActivityFeed } from './ActivityFeed';
import type { SessionInfo } from '../../../shared/types/session';
import type { WorktreeInfo } from '../../../shared/types/ipc';
import type { AgentStatus } from '../../../shared/types/agentStatus';
import './SessionSidebar.css';
import './SessionStatusBadge.css';
import './ActivityFeed.css';

// Focus the active terminal's xterm textarea (with delay for native dialogs)
const focusActiveTerminal = () => {
  setTimeout(() => {
    const activeTerminal = document.querySelector('.terminal-container.active .xterm-helper-textarea') as HTMLTextAreaElement;
    activeTerminal?.focus();
  }, 50);
};

interface SessionSidebarProps {
  onSelectSession: (sessionId: string) => void;
  onTerminateSession: (sessionId: string) => void;
}

export const SessionSidebar: React.FC<SessionSidebarProps> = ({
  onSelectSession,
  onTerminateSession,
}) => {
  const { sessions, activePanel, getAllPanels, agentStatuses, updateAgentStatus } = useLayoutStore();
  const { currentProject } = useProjectStore();

  const { events } = useActivityFeedStore();

  // Accordion state
  const [expandedSections, setExpandedSections] = useState({
    sessions: true,
    activity: false,
    worktrees: false,
  });

  // Worktrees state
  const [worktrees, setWorktrees] = useState<WorktreeInfo[]>([]);
  const [worktreesLoading, setWorktreesLoading] = useState(false);
  const [worktreesError, setWorktreesError] = useState<string | null>(null);
  const [isGitRepo, setIsGitRepo] = useState<boolean | null>(null);

  // Get the active session ID from the active panel
  const panels = getAllPanels();
  const activePanel_data = panels.find(p => p.id === activePanel);
  const activeSessionId = activePanel_data?.sessionId;

  // Convert sessions map to array
  const sessionList = Array.from(sessions.values());

  const toggleSection = (section: 'sessions' | 'activity' | 'worktrees') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Load worktrees when section is expanded
  const loadWorktrees = useCallback(async () => {
    if (!currentProject?.path) {
      setWorktreesError('Open a project');
      return;
    }

    setWorktreesLoading(true);
    setWorktreesError(null);

    try {
      const isRepo = await window.terminalIDE.worktree.isGitRepo(currentProject.path);
      setIsGitRepo(isRepo);

      if (!isRepo) {
        setWorktreesError('Not a git repository');
        setWorktrees([]);
        return;
      }

      const result = await window.terminalIDE.worktree.list(currentProject.path);
      setWorktrees(result);
    } catch (error) {
      setWorktreesError(error instanceof Error ? error.message : 'Failed to load worktrees');
    } finally {
      setWorktreesLoading(false);
    }
  }, [currentProject?.path]);

  // Reload worktrees when section expands or project changes
  useEffect(() => {
    if (expandedSections.worktrees) {
      loadWorktrees();
    }
  }, [expandedSections.worktrees, loadWorktrees]);

  // Subscribe to agent status updates
  useEffect(() => {
    const unsubscribe = window.terminalIDE.agentStatus.onUpdated(({ status }) => {
      updateAgentStatus(status);
    });

    // Load initial statuses
    window.terminalIDE.agentStatus.getAll().then((statuses) => {
      statuses.forEach((status) => updateAgentStatus(status));
    });

    return unsubscribe;
  }, [updateAgentStatus]);

  // Check if a worktree has an active session
  const getWorktreeSession = (worktreePath: string): SessionInfo | undefined => {
    return sessionList.find(
      session => session.worktreePath === worktreePath && session.status === 'running'
    );
  };

  // Handle worktree delete
  const handleDeleteWorktree = async (worktree: WorktreeInfo) => {
    const activeSession = getWorktreeSession(worktree.path);

    let confirmMessage = `Delete worktree for branch '${worktree.branch}'?\n\nPath: ${worktree.path}`;
    if (activeSession) {
      confirmMessage = `This worktree has an active terminal session.\nDeleting it will also close the terminal.\n\nDelete worktree for branch '${worktree.branch}'?`;
    }

    if (!confirm(confirmMessage)) {
      focusActiveTerminal();
      return;
    }

    try {
      // Terminate session first if exists (backend now waits for process exit)
      if (activeSession) {
        await onTerminateSession(activeSession.id);
        // No delay needed - terminateSession waits for process exit
      }

      const result = await window.terminalIDE.worktree.remove(worktree.path);
      if (!result.success) {
        // Show warning but don't block - cleanup will happen later
        console.warn(`Worktree deletion pending: ${result.error}`);
      }

      // Refresh worktrees list
      await loadWorktrees();
    } catch (error) {
      alert(`Error removing worktree: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    focusActiveTerminal();
  };

  // Handle clean orphaned worktrees
  const handleCleanOrphaned = async () => {
    if (!confirm('Remove all orphaned worktrees (worktrees without active sessions)?')) {
      focusActiveTerminal();
      return;
    }

    try {
      const cleaned = await window.terminalIDE.worktree.cleanOrphaned();
      if (cleaned.length > 0) {
        alert(`Cleaned ${cleaned.length} orphaned worktree(s)`);
      } else {
        alert('No orphaned worktrees found');
      }
      await loadWorktrees();
    } catch (error) {
      alert(`Error cleaning worktrees: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    focusActiveTerminal();
  };

  const getStatusColor = (status: SessionInfo['status']) => {
    switch (status) {
      case 'running': return 'var(--success-color)';
      case 'initializing': return 'var(--accent-color)';
      case 'terminated': return 'var(--text-secondary)';
      case 'error': return 'var(--error-color)';
      default: return 'var(--text-secondary)';
    }
  };

  const getTypeLabel = (session: SessionInfo) => {
    if (session.agentName) {
      return session.agentName;
    }
    return session.type === 'isolated' ? 'Isolated' : 'Attached';
  };

  const formatPath = (path: string) => {
    const segments = path.replace(/\\/g, '/').split('/').filter(Boolean);
    if (segments.length <= 2) return path;
    return '.../' + segments.slice(-2).join('/');
  };

  const formatBranchName = (branch: string) => {
    // Remove refs/heads/ prefix if present
    return branch.replace(/^refs\/heads\//, '');
  };

  // Filter out main worktree (first one is usually the main repo)
  const additionalWorktrees = worktrees.filter((wt, index) => index > 0);

  return (
    <div className="session-sidebar">
      {/* Sessions Section */}
      <div className="accordion-section">
        <button
          className="accordion-header"
          onClick={() => toggleSection('sessions')}
          aria-expanded={expandedSections.sessions}
        >
          <span className="accordion-toggle">
            {expandedSections.sessions ? '\u25BC' : '\u25B6'}
          </span>
          <span className="accordion-title">SESSIONS</span>
          <span className="accordion-count">{sessionList.length}</span>
        </button>

        <div className={`accordion-content ${expandedSections.sessions ? 'expanded' : ''}`}>
          <div className="session-list">
            {sessionList.length === 0 ? (
              <div className="no-items">
                <p>No active sessions</p>
              </div>
            ) : (
              sessionList.map((session) => {
                const status = agentStatuses.get(session.id);
                return (
                  <div
                    key={session.id}
                    className={`session-item ${activeSessionId === session.id ? 'active' : ''}`}
                    onClick={() => onSelectSession(session.id)}
                  >
                    <div className="session-item-header">
                      {status ? (
                        <SessionStatusBadge
                          activityState={status.activityState}
                          taskSummary={null}
                          recentFileChanges={[]}
                          errorMessage={null}
                          lastActivityTimestamp={status.lastActivityTimestamp}
                          compact
                        />
                      ) : (
                        <span
                          className="session-status"
                          style={{ backgroundColor: getStatusColor(session.status) }}
                          title={session.status}
                        />
                      )}
                      {session.agentIcon && (
                        <span className="session-agent-icon" title={session.agentName}>
                          {session.agentIcon}
                        </span>
                      )}
                      <span className="session-id">{session.id.slice(0, 8)}</span>
                      <span className={`session-type ${session.type}`}>
                        {getTypeLabel(session)}
                      </span>
                    </div>

                    {/* Agent status details */}
                    {status && session.status === 'running' && (
                      <SessionStatusBadge
                        activityState={status.activityState}
                        taskSummary={status.taskSummary}
                        recentFileChanges={status.recentFileChanges}
                        errorMessage={status.errorMessage}
                        lastActivityTimestamp={status.lastActivityTimestamp}
                      />
                    )}

                    <div className="session-item-details">
                      <div className="session-path" title={session.cwd}>
                        {formatPath(session.cwd)}
                      </div>
                      {session.branch && (
                        <div className="session-branch">
                          <span className="branch-icon">&#8963;</span>
                          {session.branch}
                        </div>
                      )}
                    </div>

                    <div className="session-item-actions">
                      {session.status === 'running' && (
                        <button
                          className="session-action-btn terminate"
                          onClick={(e) => {
                            e.stopPropagation();
                            onTerminateSession(session.id);
                          }}
                          title="Terminate session"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Activity Section */}
      <div className="accordion-section">
        <button
          className="accordion-header"
          onClick={() => toggleSection('activity')}
          aria-expanded={expandedSections.activity}
        >
          <span className="accordion-toggle">
            {expandedSections.activity ? '\u25BC' : '\u25B6'}
          </span>
          <span className="accordion-title">ACTIVITY</span>
          <span className="accordion-count">{events.length}</span>
        </button>

        <div className={`accordion-content ${expandedSections.activity ? 'expanded' : ''}`}>
          <ActivityFeed onSelectSession={onSelectSession} />
        </div>
      </div>

      {/* Worktrees Section */}
      <div className="accordion-section">
        <button
          className="accordion-header"
          onClick={() => toggleSection('worktrees')}
          aria-expanded={expandedSections.worktrees}
        >
          <span className="accordion-toggle">
            {expandedSections.worktrees ? '\u25BC' : '\u25B6'}
          </span>
          <span className="accordion-title">WORKTREES</span>
          <span className="accordion-count">{additionalWorktrees.length}</span>
        </button>

        <div className={`accordion-content ${expandedSections.worktrees ? 'expanded' : ''}`}>
          <div className="worktree-list">
            {worktreesLoading ? (
              <div className="no-items">
                <p>Loading...</p>
              </div>
            ) : worktreesError ? (
              <div className="no-items">
                <p>{worktreesError}</p>
              </div>
            ) : additionalWorktrees.length === 0 ? (
              <div className="no-items">
                <p>No worktrees</p>
              </div>
            ) : (
              additionalWorktrees.map((worktree) => {
                const activeSession = getWorktreeSession(worktree.path);
                return (
                  <div
                    key={worktree.path}
                    className="worktree-item"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/json', JSON.stringify({
                        type: 'worktree',
                        path: worktree.path,
                        branch: worktree.branch,
                      }));
                      e.dataTransfer.effectAllowed = 'copy';
                      // Add dragging class to the element
                      (e.target as HTMLElement).classList.add('dragging');
                    }}
                    onDragEnd={(e) => {
                      (e.target as HTMLElement).classList.remove('dragging');
                    }}
                  >
                    <div className="worktree-item-header">
                      <span
                        className="worktree-status"
                        style={{
                          backgroundColor: activeSession
                            ? 'var(--success-color)'
                            : 'var(--text-secondary)',
                        }}
                        title={activeSession ? 'Has active session' : 'No active session'}
                      />
                      <span className="worktree-branch">
                        {formatBranchName(worktree.branch)}
                      </span>
                      <button
                        className="worktree-delete-btn"
                        onClick={() => handleDeleteWorktree(worktree)}
                        title="Delete worktree"
                      >
                        &#128465;
                      </button>
                    </div>
                    <div className="worktree-path" title={worktree.path}>
                      {formatPath(worktree.path)}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Clean Orphaned button */}
          {isGitRepo && additionalWorktrees.length > 0 && (
            <div className="worktree-actions">
              <button
                className="clean-orphaned-btn"
                onClick={handleCleanOrphaned}
                title="Remove worktrees without active sessions"
              >
                &#129529; Clean Orphaned
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

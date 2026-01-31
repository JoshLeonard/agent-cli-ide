import React from 'react';
import { useLayoutStore } from '../../stores/layoutStore';
import type { SessionInfo } from '../../../shared/types/session';
import './SessionSidebar.css';

interface SessionSidebarProps {
  onSelectSession: (sessionId: string) => void;
  onTerminateSession: (sessionId: string) => void;
}

export const SessionSidebar: React.FC<SessionSidebarProps> = ({
  onSelectSession,
  onTerminateSession,
}) => {
  const { sessions, panes, activePane } = useLayoutStore();

  // Get the active session ID from the active pane
  const activePaneData = panes.find(p => p.id === activePane);
  const activeSessionId = activePaneData?.sessionId;

  // Convert sessions map to array
  const sessionList = Array.from(sessions.values());

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
    // If agent name is available, use that
    if (session.agentName) {
      return session.agentName;
    }
    // Fallback to session type
    return session.type === 'isolated' ? 'Isolated' : 'Attached';
  };

  const formatPath = (path: string) => {
    // Show last 2 segments of path
    const segments = path.replace(/\\/g, '/').split('/').filter(Boolean);
    if (segments.length <= 2) return path;
    return '.../' + segments.slice(-2).join('/');
  };

  return (
    <div className="session-sidebar">
      <div className="sidebar-header">
        <h3>Sessions</h3>
        <span className="session-count">{sessionList.length}</span>
      </div>

      <div className="session-list">
        {sessionList.length === 0 ? (
          <div className="no-sessions">
            <p>No active sessions</p>
          </div>
        ) : (
          sessionList.map((session) => (
            <div
              key={session.id}
              className={`session-item ${activeSessionId === session.id ? 'active' : ''}`}
              onClick={() => onSelectSession(session.id)}
            >
              <div className="session-item-header">
                <span
                  className="session-status"
                  style={{ backgroundColor: getStatusColor(session.status) }}
                  title={session.status}
                />
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

              <div className="session-item-details">
                <div className="session-path" title={session.cwd}>
                  {formatPath(session.cwd)}
                </div>
                {session.branch && (
                  <div className="session-branch">
                    <span className="branch-icon">⎇</span>
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
          ))
        )}
      </div>
    </div>
  );
};

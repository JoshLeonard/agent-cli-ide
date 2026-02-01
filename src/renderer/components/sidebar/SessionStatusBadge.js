import React from 'react';
import './SessionStatusBadge.css';
export const SessionStatusBadge = ({ activityState, taskSummary, recentFileChanges, errorMessage, lastActivityTimestamp, compact = false, }) => {
    const getStateInfo = () => {
        switch (activityState) {
            case 'working':
                return {
                    icon: '\u26A1', // Lightning bolt
                    label: 'Working',
                    className: 'working',
                };
            case 'waiting_for_input':
                return {
                    icon: '?',
                    label: 'Waiting',
                    className: 'waiting',
                };
            case 'error':
                return {
                    icon: '!',
                    label: 'Error',
                    className: 'error',
                };
            case 'idle':
            default:
                return {
                    icon: '\u25C7', // Diamond
                    label: 'Idle',
                    className: 'idle',
                };
        }
    };
    const formatTimeAgo = (timestamp) => {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60)
            return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60)
            return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24)
            return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };
    const getFileChangeSummary = () => {
        if (recentFileChanges.length === 0)
            return null;
        const created = recentFileChanges.filter(f => f.type === 'created').length;
        const modified = recentFileChanges.filter(f => f.type === 'modified').length;
        const deleted = recentFileChanges.filter(f => f.type === 'deleted').length;
        const parts = [];
        if (created > 0)
            parts.push(`+${created}`);
        if (modified > 0)
            parts.push(`~${modified}`);
        if (deleted > 0)
            parts.push(`-${deleted}`);
        return parts.join(' ');
    };
    const stateInfo = getStateInfo();
    const fileChangeSummary = getFileChangeSummary();
    if (compact) {
        return (<div className={`status-badge-compact ${stateInfo.className}`} title={`${stateInfo.label}${taskSummary ? `: ${taskSummary}` : ''}`}>
        <span className="status-icon">{stateInfo.icon}</span>
      </div>);
    }
    return (<div className={`status-badge ${stateInfo.className}`}>
      <div className="status-badge-header">
        <span className={`status-indicator ${stateInfo.className}`}>
          <span className="status-icon">{stateInfo.icon}</span>
          <span className="status-label">{stateInfo.label}</span>
        </span>
        {activityState === 'idle' && (<span className="status-time">{formatTimeAgo(lastActivityTimestamp)}</span>)}
      </div>

      {taskSummary && (<div className="status-task" title={taskSummary}>
          "{taskSummary}"
        </div>)}

      {errorMessage && (<div className="status-error" title={errorMessage}>
          {errorMessage}
        </div>)}

      {fileChangeSummary && (<div className="status-files" title="Recent file changes">
          {fileChangeSummary} files
        </div>)}
    </div>);
};
//# sourceMappingURL=SessionStatusBadge.js.map
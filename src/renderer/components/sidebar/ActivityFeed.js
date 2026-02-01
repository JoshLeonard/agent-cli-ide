import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useActivityFeedStore } from '../../stores/activityFeedStore';
import { useLayoutStore } from '../../stores/layoutStore';
import './ActivityFeed.css';
// Focus the active terminal's xterm textarea (with delay for native dialogs)
const focusActiveTerminal = () => {
    setTimeout(() => {
        const activeTerminal = document.querySelector('.terminal-container.active .xterm-helper-textarea');
        activeTerminal?.focus();
    }, 50);
};
export const ActivityFeed = ({ onSelectSession }) => {
    const { events, loading, error, filterTypes, filterSeverities, addEvent, setEvents, clearEvents, setFilterTypes, setFilterSeverities, setLoading, setError, getFilteredEvents, } = useActivityFeedStore();
    const { sessions } = useLayoutStore();
    const [showFilters, setShowFilters] = useState(false);
    const listRef = useRef(null);
    // Load initial events
    useEffect(() => {
        const loadEvents = async () => {
            setLoading(true);
            try {
                const events = await window.terminalIDE.activity.getEvents({ limit: 100 });
                setEvents(events);
            }
            catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load events');
            }
            finally {
                setLoading(false);
            }
        };
        loadEvents();
    }, [setEvents, setLoading, setError]);
    // Subscribe to new events
    useEffect(() => {
        const unsubscribe = window.terminalIDE.activity.onEvent(({ event }) => {
            addEvent(event);
        });
        return unsubscribe;
    }, [addEvent]);
    const handleClearAll = useCallback(async () => {
        if (!confirm('Clear all activity events?')) {
            focusActiveTerminal();
            return;
        }
        await window.terminalIDE.activity.clearEvents();
        clearEvents();
        focusActiveTerminal();
    }, [clearEvents]);
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
    const getEventIcon = (event) => {
        switch (event.type) {
            case 'file_created': return '+';
            case 'file_modified': return '~';
            case 'file_deleted': return '-';
            case 'error': return '!';
            case 'warning': return '\u26A0';
            case 'task_completed': return '\u2713';
            case 'command_executed': return '>';
            default: return '\u2022';
        }
    };
    const getSeverityClass = (severity) => {
        switch (severity) {
            case 'error': return 'severity-error';
            case 'warning': return 'severity-warning';
            case 'success': return 'severity-success';
            default: return 'severity-info';
        }
    };
    const getFileName = (filePath) => {
        const parts = filePath.replace(/\\/g, '/').split('/');
        return parts[parts.length - 1] || filePath;
    };
    const handleEventClick = (event) => {
        if (onSelectSession) {
            onSelectSession(event.sessionId);
        }
    };
    const filteredEvents = getFilteredEvents();
    const typeOptions = [
        { value: 'file_created', label: 'Created' },
        { value: 'file_modified', label: 'Modified' },
        { value: 'file_deleted', label: 'Deleted' },
        { value: 'error', label: 'Errors' },
        { value: 'warning', label: 'Warnings' },
        { value: 'task_completed', label: 'Tasks' },
    ];
    const severityOptions = [
        { value: 'error', label: 'Errors' },
        { value: 'warning', label: 'Warnings' },
        { value: 'success', label: 'Success' },
        { value: 'info', label: 'Info' },
    ];
    return (<div className="activity-feed">
      {/* Header with filter controls */}
      <div className="activity-feed-header">
        <button className="filter-toggle" onClick={() => setShowFilters(!showFilters)} title="Toggle filters">
          \u2699 Filter
        </button>
        {events.length > 0 && (<button className="clear-btn" onClick={handleClearAll} title="Clear all events">
            Clear
          </button>)}
      </div>

      {/* Filter panel */}
      {showFilters && (<div className="filter-panel">
          <div className="filter-group">
            <label>Type:</label>
            <div className="filter-chips">
              {typeOptions.map(opt => (<button key={opt.value} className={`filter-chip ${filterTypes?.includes(opt.value) ? 'active' : ''}`} onClick={() => {
                    if (!filterTypes) {
                        setFilterTypes([opt.value]);
                    }
                    else if (filterTypes.includes(opt.value)) {
                        const newTypes = filterTypes.filter(t => t !== opt.value);
                        setFilterTypes(newTypes.length > 0 ? newTypes : null);
                    }
                    else {
                        setFilterTypes([...filterTypes, opt.value]);
                    }
                }}>
                  {opt.label}
                </button>))}
            </div>
          </div>
          <div className="filter-group">
            <label>Severity:</label>
            <div className="filter-chips">
              {severityOptions.map(opt => (<button key={opt.value} className={`filter-chip ${opt.value} ${filterSeverities?.includes(opt.value) ? 'active' : ''}`} onClick={() => {
                    if (!filterSeverities) {
                        setFilterSeverities([opt.value]);
                    }
                    else if (filterSeverities.includes(opt.value)) {
                        const newSeverities = filterSeverities.filter(s => s !== opt.value);
                        setFilterSeverities(newSeverities.length > 0 ? newSeverities : null);
                    }
                    else {
                        setFilterSeverities([...filterSeverities, opt.value]);
                    }
                }}>
                  {opt.label}
                </button>))}
            </div>
          </div>
        </div>)}

      {/* Event list */}
      <div className="activity-list" ref={listRef}>
        {loading ? (<div className="activity-empty">Loading...</div>) : error ? (<div className="activity-empty error">{error}</div>) : filteredEvents.length === 0 ? (<div className="activity-empty">
            {events.length === 0 ? 'No activity yet' : 'No matching events'}
          </div>) : (filteredEvents.map((event) => (<div key={event.id} className={`activity-item ${getSeverityClass(event.severity)}`} onClick={() => handleEventClick(event)} title={event.details || event.title}>
              <div className="activity-item-header">
                <span className="activity-icon">{getEventIcon(event)}</span>
                <span className="activity-title">{event.title}</span>
                <span className="activity-time">{formatTimeAgo(event.timestamp)}</span>
              </div>
              {event.filePath && (<div className="activity-file" title={event.filePath}>
                  {getFileName(event.filePath)}
                </div>)}
              {event.details && (<div className="activity-details">{event.details}</div>)}
              {event.agentIcon && (<div className="activity-agent">
                  <span className="agent-icon">{event.agentIcon}</span>
                  <span className="agent-name">{event.agentName}</span>
                </div>)}
            </div>)))}
      </div>
    </div>);
};
//# sourceMappingURL=ActivityFeed.js.map
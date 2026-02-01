import React, { useState, useEffect, useRef } from 'react';
import { useMessagingStore } from '../../stores/messagingStore';
import { useLayoutStore } from '../../stores/layoutStore';
import './QuickSendDialog.css';
export const QuickSendDialog = ({ onClose }) => {
    const { quickSendOpen, quickSendTarget, closeQuickSend, setLastSentMessage } = useMessagingStore();
    const { sessions, activePanel, getAllPanels } = useLayoutStore();
    const [selectedSessions, setSelectedSessions] = useState([]);
    const [content, setContent] = useState('');
    const [addNewline, setAddNewline] = useState(true);
    const [isBroadcast, setIsBroadcast] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);
    const inputRef = useRef(null);
    const dialogRef = useRef(null);
    // Get active session ID
    const panels = getAllPanels();
    const activePanel_data = panels.find(p => p.id === activePanel);
    const activeSessionId = activePanel_data?.sessionId;
    // Get available sessions (running, not the active one)
    const availableSessions = Array.from(sessions.values()).filter(s => s.status === 'running' && s.id !== activeSessionId);
    // Initialize selected sessions
    useEffect(() => {
        if (quickSendOpen) {
            if (quickSendTarget) {
                setSelectedSessions([quickSendTarget]);
            }
            else {
                setSelectedSessions([]);
            }
            setContent('');
            setError(null);
            // Focus input after dialog opens
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [quickSendOpen, quickSendTarget]);
    // Handle escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && quickSendOpen) {
                handleClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [quickSendOpen]);
    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dialogRef.current && !dialogRef.current.contains(e.target)) {
                handleClose();
            }
        };
        if (quickSendOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [quickSendOpen]);
    const handleClose = () => {
        closeQuickSend();
        onClose?.();
    };
    const handleToggleSession = (sessionId) => {
        setSelectedSessions(prev => prev.includes(sessionId)
            ? prev.filter(id => id !== sessionId)
            : [...prev, sessionId]);
        setIsBroadcast(false);
    };
    const handleSelectAll = () => {
        setSelectedSessions(availableSessions.map(s => s.id));
        setIsBroadcast(true);
    };
    const handleSend = async () => {
        if (!content.trim()) {
            setError('Please enter a message');
            return;
        }
        if (!isBroadcast && selectedSessions.length === 0) {
            setError('Please select at least one session');
            return;
        }
        setSending(true);
        setError(null);
        try {
            let result;
            if (isBroadcast) {
                result = await window.terminalIDE.messaging.broadcast(content, { addNewline }, activeSessionId);
            }
            else {
                result = await window.terminalIDE.messaging.send(selectedSessions, content, { addNewline });
            }
            if (result.success) {
                // Show feedback on sent sessions
                const targets = isBroadcast ? availableSessions.map(s => s.id) : selectedSessions;
                targets.forEach(id => setLastSentMessage(id));
                handleClose();
            }
            else {
                setError(result.error || 'Failed to send message');
            }
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send message');
        }
        finally {
            setSending(false);
        }
    };
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            handleSend();
        }
    };
    if (!quickSendOpen)
        return null;
    return (<div className="quick-send-overlay">
      <div className="quick-send-dialog" ref={dialogRef}>
        <div className="quick-send-header">
          <h3>Send to Sessions</h3>
          <button className="close-btn" onClick={handleClose}>&times;</button>
        </div>

        <div className="quick-send-content">
          {/* Target selection */}
          <div className="target-section">
            <div className="target-header">
              <label>Target Sessions:</label>
              <button className={`broadcast-btn ${isBroadcast ? 'active' : ''}`} onClick={handleSelectAll} disabled={availableSessions.length === 0}>
                Broadcast All
              </button>
            </div>

            <div className="session-checkboxes">
              {availableSessions.length === 0 ? (<div className="no-sessions">No other running sessions</div>) : (availableSessions.map(session => (<label key={session.id} className="session-checkbox">
                    <input type="checkbox" checked={selectedSessions.includes(session.id) || isBroadcast} onChange={() => handleToggleSession(session.id)} disabled={isBroadcast}/>
                    <span className="session-info">
                      {session.agentIcon && <span className="agent-icon">{session.agentIcon}</span>}
                      <span className="session-name">
                        {session.agentName || session.id.slice(0, 8)}
                      </span>
                    </span>
                  </label>)))}
            </div>
          </div>

          {/* Message input */}
          <div className="message-section">
            <label>Message:</label>
            <textarea ref={inputRef} value={content} onChange={(e) => setContent(e.target.value)} onKeyDown={handleKeyPress} placeholder="Enter command or text to send..." rows={3}/>
            <div className="message-options">
              <label className="option-checkbox">
                <input type="checkbox" checked={addNewline} onChange={(e) => setAddNewline(e.target.checked)}/>
                Execute (add newline)
              </label>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}
        </div>

        <div className="quick-send-footer">
          <button className="cancel-btn" onClick={handleClose}>
            Cancel
          </button>
          <button className="send-btn" onClick={handleSend} disabled={sending || (!isBroadcast && selectedSessions.length === 0) || !content.trim()}>
            {sending ? 'Sending...' : 'Send'} (Ctrl+Enter)
          </button>
        </div>
      </div>
    </div>);
};
//# sourceMappingURL=QuickSendDialog.js.map
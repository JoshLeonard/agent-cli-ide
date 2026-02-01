import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../stores/projectStore';
import './NewSessionDialog.css';
export const NewSessionDialog = ({ isOpen, onClose, onSubmit, }) => {
    const currentProject = useProjectStore((state) => state.currentProject);
    const [agents, setAgents] = useState([]);
    const [selectedAgentId, setSelectedAgentId] = useState('');
    const [type, setType] = useState('attached');
    const [cwd, setCwd] = useState('');
    const [branch, setBranch] = useState('');
    const [isGitRepo, setIsGitRepo] = useState(false);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        if (isOpen) {
            // Reset form and load agents
            setType('attached');
            // Default to project path if available
            setCwd(currentProject?.path || '');
            setIsGitRepo(currentProject?.isGitRepo || false);
            setBranch('');
            setLoading(true);
            // Load available agents
            window.terminalIDE.agent.list().then((loadedAgents) => {
                setAgents(loadedAgents);
                // Select default agent
                window.terminalIDE.agent.getDefault().then((defaultAgent) => {
                    if (defaultAgent) {
                        setSelectedAgentId(defaultAgent.id);
                    }
                    else if (loadedAgents.length > 0) {
                        // Fallback to first available agent
                        const firstAvailable = loadedAgents.find(a => a.available);
                        if (firstAvailable) {
                            setSelectedAgentId(firstAvailable.id);
                        }
                    }
                    setLoading(false);
                });
            });
        }
    }, [isOpen]);
    const handleSelectDirectory = async () => {
        const selectedPath = await window.terminalIDE.dialog.selectDirectory();
        if (selectedPath) {
            setCwd(selectedPath);
            // For now, assume it could be a git repo
            // In production, we'd check this via IPC
            setIsGitRepo(true);
        }
    };
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!cwd || !selectedAgentId)
            return;
        onSubmit({
            type,
            cwd,
            branch: type === 'isolated' ? branch : undefined,
            agentId: selectedAgentId,
        });
        onClose();
    };
    // Group agents by category
    const groupedAgents = agents.reduce((acc, agent) => {
        acc[agent.category].push(agent);
        return acc;
    }, { 'ai-agent': [], shell: [], custom: [] });
    const categoryLabels = {
        'ai-agent': 'AI Agents',
        shell: 'Shells',
        custom: 'Custom',
    };
    const categoryOrder = ['ai-agent', 'shell', 'custom'];
    if (!isOpen)
        return null;
    return (<div className="dialog-overlay" onClick={onClose}>
      <div className="dialog dialog-wide" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>New Session</h2>
          <button className="dialog-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="dialog-content">
            {/* Agent Selection */}
            <div className="form-group">
              <label>Agent</label>
              {loading ? (<div className="agent-loading">Loading agents...</div>) : (<>
                  {/* Card grid for large screens */}
                  <div className="agent-grid">
                    {categoryOrder.map((category) => {
                const categoryAgents = groupedAgents[category];
                if (categoryAgents.length === 0)
                    return null;
                return (<div key={category} className="agent-category">
                          <div className="agent-category-label">
                            {categoryLabels[category]}
                          </div>
                          <div className="agent-options">
                            {categoryAgents.map((agent) => (<label key={agent.id} className={`agent-option ${selectedAgentId === agent.id ? 'selected' : ''} ${!agent.available ? 'unavailable' : ''}`}>
                                <input type="radio" name="agent" value={agent.id} checked={selectedAgentId === agent.id} onChange={() => setSelectedAgentId(agent.id)} disabled={!agent.available}/>
                                <span className="agent-icon">{agent.icon}</span>
                                <span className="agent-info">
                                  <span className="agent-name">{agent.name}</span>
                                  {agent.description && (<span className="agent-description">
                                      {agent.description}
                                    </span>)}
                                </span>
                                {!agent.available && (<span className="agent-badge unavailable">
                                    Not installed
                                  </span>)}
                              </label>))}
                          </div>
                        </div>);
            })}
                  </div>

                  {/* Dropdown for small screens */}
                  <div className="agent-dropdown">
                    <select value={selectedAgentId} onChange={(e) => setSelectedAgentId(e.target.value)}>
                      {categoryOrder.map((category) => {
                const categoryAgents = groupedAgents[category];
                if (categoryAgents.length === 0)
                    return null;
                return (<optgroup key={category} label={categoryLabels[category]}>
                            {categoryAgents.map((agent) => (<option key={agent.id} value={agent.id} disabled={!agent.available}>
                                {agent.icon} {agent.name}
                                {!agent.available ? ' (Not installed)' : ''}
                              </option>))}
                          </optgroup>);
            })}
                    </select>
                  </div>
                </>)}
            </div>

            {/* Working Directory */}
            <div className="form-group">
              <label htmlFor="cwd">Working Directory</label>
              <div className="input-with-button">
                <input id="cwd" type="text" value={cwd} onChange={(e) => setCwd(e.target.value)} placeholder="Select a directory..." readOnly/>
                <button type="button" onClick={handleSelectDirectory}>
                  Browse...
                </button>
              </div>
            </div>

            {/* Session Type */}
            <div className="form-group">
              <label>Session Type</label>
              <div className="radio-group">
                <label className="radio-label">
                  <input type="radio" name="type" value="attached" checked={type === 'attached'} onChange={() => setType('attached')}/>
                  <span>Attached</span>
                  <span className="radio-description">
                    Share the repository with other sessions
                  </span>
                </label>
                <label className="radio-label">
                  <input type="radio" name="type" value="isolated" checked={type === 'isolated'} onChange={() => setType('isolated')} disabled={!isGitRepo}/>
                  <span>Worktree</span>
                  <span className="radio-description">
                    Isolated branch for this session
                    {!isGitRepo && ' (requires Git repository)'}
                  </span>
                </label>
              </div>
            </div>

            {/* Branch Name (only when worktree selected) */}
            {type === 'isolated' && (<div className="form-group">
                <label htmlFor="branch">Branch</label>
                <input id="branch" type="text" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="feature/my-branch"/>
                <span className="form-hint">
                  Creates a new branch if it doesn't exist
                </span>
              </div>)}
          </div>

          <div className="dialog-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={!cwd ||
            !selectedAgentId ||
            (type === 'isolated' && !branch) ||
            loading}>
              Start Session
            </button>
          </div>
        </form>
      </div>
    </div>);
};
//# sourceMappingURL=NewSessionDialog.js.map
import React from 'react';
import { TerminalPanel } from './TerminalPanel';
import './GridLayout.css';
export const GridLayout = ({ panels, config, activePanel, onCreateSession, onWorktreeDrop, }) => {
    return (<div className="grid-layout" style={{
            gridTemplateColumns: `repeat(${config.cols}, 1fr)`,
            gridTemplateRows: `repeat(${config.rows}, 1fr)`,
        }}>
      {panels.map(panel => (<TerminalPanel key={panel.id} panel={panel} isActive={activePanel === panel.id} onCreateSession={onCreateSession} onWorktreeDrop={onWorktreeDrop ? (data) => onWorktreeDrop(panel.id, data) : undefined}/>))}
    </div>);
};
//# sourceMappingURL=GridLayout.js.map
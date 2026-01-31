import React from 'react';
import type { GridConfig, TerminalPanel as TerminalPanelType } from '../../../shared/types/layout';
import { TerminalPanel } from './TerminalPanel';
import './GridLayout.css';

interface WorktreeDropData {
  path: string;
  branch: string;
}

interface GridLayoutProps {
  panels: TerminalPanelType[];
  config: GridConfig;
  activePanel: string | null;
  onCreateSession: (panelId: string) => void;
  onWorktreeDrop?: (panelId: string, worktreeData: WorktreeDropData) => void;
}

export const GridLayout: React.FC<GridLayoutProps> = ({
  panels,
  config,
  activePanel,
  onCreateSession,
  onWorktreeDrop,
}) => {
  return (
    <div
      className="grid-layout"
      style={{
        gridTemplateColumns: `repeat(${config.cols}, 1fr)`,
        gridTemplateRows: `repeat(${config.rows}, 1fr)`,
      }}
    >
      {panels.map(panel => (
        <TerminalPanel
          key={panel.id}
          panel={panel}
          isActive={activePanel === panel.id}
          onCreateSession={onCreateSession}
          onWorktreeDrop={onWorktreeDrop ? (data) => onWorktreeDrop(panel.id, data) : undefined}
        />
      ))}
    </div>
  );
};

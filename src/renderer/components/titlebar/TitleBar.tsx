import React, { useState, useEffect } from 'react';
import { MenuBar } from './MenuBar';
import { WindowControls } from './WindowControls';
import './TitleBar.css';

interface GridConfig {
  rows: number;
  cols: number;
}

interface GridPreset {
  label: string;
  rows: number;
  cols: number;
}

const GRID_PRESETS: GridPreset[] = [
  { label: '1x1', rows: 1, cols: 1 },
  { label: '1x2', rows: 1, cols: 2 },
  { label: '2x2', rows: 2, cols: 2 },
  { label: '2x3', rows: 2, cols: 3 },
  { label: '2x4', rows: 2, cols: 4 },
  { label: '2x5', rows: 2, cols: 5 },
  { label: '3x3', rows: 3, cols: 3 },
];

interface TitleBarProps {
  gridConfig: GridConfig;
  onGridChange: (rows: number, cols: number) => void;
  activeSessionCount: number;
  onNewSession: () => void;
  onOpenProject: () => void;
  onTerminateSession: () => void;
  onSendMessage: () => void;
  onBroadcast: () => void;
  onCopyShared: () => void;
  onPasteShared: () => void;
  onToggleSidebar: () => void;
  onOpenSettings: () => void;
  hasActiveSession: boolean;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  gridConfig,
  onGridChange,
  activeSessionCount,
  onNewSession,
  onOpenProject,
  onTerminateSession,
  onSendMessage,
  onBroadcast,
  onCopyShared,
  onPasteShared,
  onToggleSidebar,
  onOpenSettings,
  hasActiveSession,
}) => {
  const [platform, setPlatform] = useState<NodeJS.Platform>('win32');
  const [isGridDropdownOpen, setGridDropdownOpen] = useState(false);

  useEffect(() => {
    const getPlatform = async () => {
      const p = await window.terminalIDE.window.getPlatform();
      setPlatform(p);
    };
    getPlatform();
  }, []);

  useEffect(() => {
    if (!isGridDropdownOpen) return;

    const handleClick = () => setGridDropdownOpen(false);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [isGridDropdownOpen]);

  const isMac = platform === 'darwin';

  const handleExit = () => {
    window.terminalIDE.window.close();
  };

  const handleToggleDevTools = () => {
    // DevTools toggle is handled by Electron menu on macOS or Ctrl+Shift+I shortcut
    console.log('Toggle DevTools');
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    // Only toggle maximize if clicking on the drag region
    if ((e.target as HTMLElement).closest('.title-bar-drag-region')) {
      window.terminalIDE.window.maximize();
    }
  };

  return (
    <div className="title-bar" onDoubleClick={handleDoubleClick}>
      {isMac && <div className="traffic-light-space" />}

      <div className="app-icon">
        <svg width="16" height="16" viewBox="0 0 16 16">
          <rect x="1" y="2" width="14" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M4 6 L6 8 L4 10" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="8" y1="10" x2="12" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>

      <MenuBar
        onNewSession={onNewSession}
        onOpenProject={onOpenProject}
        onExit={handleExit}
        onToggleSidebar={onToggleSidebar}
        onToggleDevTools={handleToggleDevTools}
        onGridChange={onGridChange}
        onTerminateSession={onTerminateSession}
        onSendMessage={onSendMessage}
        onBroadcast={onBroadcast}
        onCopyShared={onCopyShared}
        onPasteShared={onPasteShared}
        onOpenSettings={onOpenSettings}
        hasActiveSession={hasActiveSession}
      />

      <div className="title-bar-drag-region">
        <span className="title-bar-title">Terminal IDE</span>
      </div>

      <div className="grid-selector" onClick={(e) => e.stopPropagation()}>
        <button
          className="grid-selector-button"
          onClick={() => setGridDropdownOpen(!isGridDropdownOpen)}
        >
          Grid: {gridConfig.rows}x{gridConfig.cols}
        </button>
        {isGridDropdownOpen && (
          <div className="grid-selector-dropdown">
            {GRID_PRESETS.map((preset) => {
              const totalCells = preset.rows * preset.cols;
              const isDisabled = totalCells < activeSessionCount;
              const isSelected = preset.rows === gridConfig.rows && preset.cols === gridConfig.cols;
              return (
                <button
                  key={preset.label}
                  className={`grid-selector-option ${isSelected ? 'selected' : ''}`}
                  disabled={isDisabled}
                  onClick={() => {
                    onGridChange(preset.rows, preset.cols);
                    setGridDropdownOpen(false);
                  }}
                  title={isDisabled ? `Cannot shrink: ${activeSessionCount} active sessions` : ''}
                >
                  {preset.label}
                  {isSelected && ' \u2713'}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!isMac && <WindowControls />}
    </div>
  );
};

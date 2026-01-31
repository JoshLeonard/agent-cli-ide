import React, { useCallback, useRef } from 'react';
import { useLayoutStore } from '../../stores/layoutStore';
import { TerminalContainer } from '../terminal/TerminalContainer';
import { ResizeHandle } from './ResizeHandle';
import './PaneGrid.css';

interface PaneGridProps {
  onCreateSession: (paneId: string) => void;
}

const MIN_SIZE = 0.1; // Minimum 10% for any row/column

export const PaneGrid: React.FC<PaneGridProps> = ({ onCreateSession }) => {
  const {
    panes,
    rows,
    cols,
    rowSizes,
    colSizes,
    activePane,
    setActivePane,
    setRowSizes,
    setColSizes,
  } = useLayoutStore();

  const containerRef = useRef<HTMLDivElement>(null);

  const handleRowResize = useCallback((index: number, delta: number) => {
    if (!containerRef.current) return;
    const containerHeight = containerRef.current.offsetHeight;
    const deltaFraction = delta / containerHeight;

    const newSizes = [...rowSizes];
    const newSize1 = newSizes[index] + deltaFraction;
    const newSize2 = newSizes[index + 1] - deltaFraction;

    // Enforce minimum sizes
    if (newSize1 < MIN_SIZE || newSize2 < MIN_SIZE) return;

    newSizes[index] = newSize1;
    newSizes[index + 1] = newSize2;
    setRowSizes(newSizes);
  }, [rowSizes, setRowSizes]);

  const handleColResize = useCallback((index: number, delta: number) => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.offsetWidth;
    const deltaFraction = delta / containerWidth;

    const newSizes = [...colSizes];
    const newSize1 = newSizes[index] + deltaFraction;
    const newSize2 = newSizes[index + 1] - deltaFraction;

    // Enforce minimum sizes
    if (newSize1 < MIN_SIZE || newSize2 < MIN_SIZE) return;

    newSizes[index] = newSize1;
    newSizes[index + 1] = newSize2;
    setColSizes(newSizes);
  }, [colSizes, setColSizes]);

  // Calculate cumulative positions for resize handles
  const getRowHandlePositions = () => {
    const positions: number[] = [];
    let cumulative = 0;
    for (let i = 0; i < rowSizes.length - 1; i++) {
      cumulative += rowSizes[i];
      positions.push(cumulative * 100);
    }
    return positions;
  };

  const getColHandlePositions = () => {
    const positions: number[] = [];
    let cumulative = 0;
    for (let i = 0; i < colSizes.length - 1; i++) {
      cumulative += colSizes[i];
      positions.push(cumulative * 100);
    }
    return positions;
  };

  const gridStyle: React.CSSProperties = {
    gridTemplateRows: rowSizes.map(s => `${s}fr`).join(' '),
    gridTemplateColumns: colSizes.map(s => `${s}fr`).join(' '),
  };

  if (panes.length === 0) {
    return (
      <div className="pane-grid-empty">
        <div className="empty-message">
          <h2>No terminals open</h2>
          <p>Click "New Session" to create a terminal</p>
        </div>
      </div>
    );
  }

  const rowHandlePositions = getRowHandlePositions();
  const colHandlePositions = getColHandlePositions();

  return (
    <div className="pane-grid" style={gridStyle} ref={containerRef}>
      {panes.map((pane) => (
        <div
          key={pane.id}
          className={`pane ${activePane === pane.id ? 'active' : ''}`}
          style={{
            gridRow: pane.row + 1,
            gridColumn: pane.col + 1,
            gridRowEnd: pane.rowSpan ? `span ${pane.rowSpan}` : undefined,
            gridColumnEnd: pane.colSpan ? `span ${pane.colSpan}` : undefined,
          }}
        >
          <div className="pane-header">
            <span className="pane-title">
              {pane.sessionId ? `Session ${pane.sessionId.slice(0, 8)}` : 'Empty'}
            </span>
          </div>
          <div className="pane-content">
            {pane.sessionId ? (
              <TerminalContainer
                key={`terminal-${pane.sessionId}`}
                sessionId={pane.sessionId}
                isActive={activePane === pane.id}
                onFocus={() => setActivePane(pane.id)}
              />
            ) : (
              <div className="pane-empty">
                <button onClick={() => onCreateSession(pane.id)}>
                  Create Session
                </button>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Horizontal resize handles (between rows) */}
      {rowHandlePositions.map((position, index) => (
        <ResizeHandle
          key={`row-handle-${index}`}
          type="horizontal"
          position={position}
          onDrag={(delta) => handleRowResize(index, delta)}
        />
      ))}

      {/* Vertical resize handles (between columns) */}
      {colHandlePositions.map((position, index) => (
        <ResizeHandle
          key={`col-handle-${index}`}
          type="vertical"
          position={position}
          onDrag={(delta) => handleColResize(index, delta)}
        />
      ))}
    </div>
  );
};

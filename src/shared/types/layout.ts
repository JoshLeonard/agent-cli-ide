// Grid-based layout structure for fixed panel system

export interface GridConfig {
  rows: number;  // default: 2
  cols: number;  // default: 5
}

export interface TerminalPanel {
  type: 'panel';
  id: string;
  sessionId: string | null;  // Direct session reference (null = empty panel)
}

export interface GridLayoutState {
  version: 3;
  config: GridConfig;
  panels: TerminalPanel[];  // Array of rows * cols panels
}

// Legacy types for migration support

export type LayoutNode = LegacyPanelGroup | TerminalPanel;

export interface LegacyPanelGroup {
  type: 'group';
  id: string;
  direction: 'horizontal' | 'vertical';
  children: LayoutNode[];
  sizes: number[];
}

export interface LegacyLayoutState {
  panes: {
    id: string;
    sessionId?: string;
    row: number;
    col: number;
    rowSpan?: number;
    colSpan?: number;
  }[];
  rows: number;
  cols: number;
  rowSizes?: number[];
  colSizes?: number[];
}

export interface TreeLayoutState {
  version: 2;
  root: LayoutNode;
}

// Union type for persisted layout (supports migration)
export type PersistedLayoutState = LegacyLayoutState | TreeLayoutState | GridLayoutState;

// Type guards
export function isTerminalPanel(node: LayoutNode): node is TerminalPanel {
  return node.type === 'panel';
}

export function isPanelGroup(node: LayoutNode): node is LegacyPanelGroup {
  return node.type === 'group';
}

export function isTreeLayoutState(state: PersistedLayoutState): state is TreeLayoutState {
  return 'version' in state && state.version === 2;
}

export function isGridLayoutState(state: PersistedLayoutState): state is GridLayoutState {
  return 'version' in state && state.version === 3;
}

// Grid-based layout structure for fixed panel system
// Type guards
export function isTerminalPanel(node) {
    return node.type === 'panel';
}
export function isPanelGroup(node) {
    return node.type === 'group';
}
export function isTreeLayoutState(state) {
    return 'version' in state && state.version === 2;
}
export function isGridLayoutState(state) {
    return 'version' in state && state.version === 3;
}
//# sourceMappingURL=layout.js.map
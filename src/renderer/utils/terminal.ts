/**
 * Focus the active terminal's xterm textarea.
 * Uses a small delay to ensure the DOM is ready after native dialogs close.
 */
export function focusActiveTerminal(): void {
  setTimeout(() => {
    const activeTerminal = document.querySelector('.terminal-container.active .xterm-helper-textarea') as HTMLTextAreaElement;
    activeTerminal?.focus();
  }, 50);
}

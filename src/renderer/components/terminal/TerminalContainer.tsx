import React, { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import './TerminalContainer.css';

interface TerminalContainerProps {
  sessionId: string;
  isActive: boolean;
  onFocus: () => void;
}

export const TerminalContainer: React.FC<TerminalContainerProps> = ({
  sessionId,
  isActive,
  onFocus,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resizeTimeoutRef = useRef<number | null>(null);
  const sessionIdRef = useRef(sessionId);
  const userScrolledUpRef = useRef(false);
  const scrollListenerCleanupRef = useRef<(() => void) | null>(null);

  // Keep sessionId ref updated
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        cursorAccent: '#1e1e1e',
        selectionBackground: '#264f78',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    terminal.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Track user scroll state to enable smart auto-scroll
    const viewport = containerRef.current.querySelector('.xterm-viewport');
    if (viewport) {
      const handleScroll = () => {
        const { scrollTop, scrollHeight, clientHeight } = viewport as HTMLElement;
        const atBottom = scrollTop + clientHeight >= scrollHeight - 10; // 10px threshold
        userScrolledUpRef.current = !atBottom;
      };
      viewport.addEventListener('scroll', handleScroll);
      scrollListenerCleanupRef.current = () => viewport.removeEventListener('scroll', handleScroll);
    }

    // Prevent native paste event (we handle it manually via Ctrl+V)
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
    };
    containerRef.current.addEventListener('paste', handlePaste);

    // Handle Ctrl+C (copy) and Ctrl+V (paste)
    terminal.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown') return true;

      // Ctrl+C: Copy if selection exists, else send SIGINT
      if (event.ctrlKey && event.key === 'c') {
        const selection = terminal.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection);
          return false; // Handled - don't send SIGINT
        }
        return true; // No selection - let SIGINT through
      }

      // Ctrl+V: Paste from OS clipboard
      if (event.ctrlKey && event.key === 'v') {
        window.terminalIDE.clipboard.readOS().then((content) => {
          if (content) {
            window.terminalIDE.session.write(sessionIdRef.current, content);
          }
        });
        return false; // Handled
      }

      return true; // Let all other keys through
    });

    // Send initial size to backend
    const { cols, rows } = terminal;
    window.terminalIDE.session.resize(sessionId, cols, rows);

    // Handle user input - use ref to always get current sessionId
    const dataDisposable = terminal.onData((data) => {
      window.terminalIDE.session.write(sessionIdRef.current, data);
    });

    // Handle resize
    const resizeDisposable = terminal.onResize(({ cols, rows }) => {
      window.terminalIDE.session.resize(sessionIdRef.current, cols, rows);
    });

    const container = containerRef.current;
    return () => {
      container?.removeEventListener('paste', handlePaste);
      scrollListenerCleanupRef.current?.();
      scrollListenerCleanupRef.current = null;
      dataDisposable.dispose();
      resizeDisposable.dispose();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId]);

  // Handle output from backend - separate effect for subscription
  useEffect(() => {
    const currentSessionId = sessionId;

    const unsubscribe = window.terminalIDE.session.onOutput((event) => {
      // Only write output for THIS session
      if (event.sessionId === currentSessionId && terminalRef.current) {
        terminalRef.current.write(event.data);
        // Auto-scroll to bottom if user hasn't scrolled up
        if (!userScrolledUpRef.current) {
          terminalRef.current.scrollToBottom();
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [sessionId]);

  // Handle container resize with debouncing
  const handleResize = useCallback(() => {
    if (resizeTimeoutRef.current) {
      window.clearTimeout(resizeTimeoutRef.current);
    }

    resizeTimeoutRef.current = window.setTimeout(() => {
      if (fitAddonRef.current && terminalRef.current) {
        const wasAtBottom = !userScrolledUpRef.current;
        fitAddonRef.current.fit();
        // Restore scroll position after fit
        if (wasAtBottom) {
          terminalRef.current.scrollToBottom();
        }
      }
    }, 100);
  }, []);

  useEffect(() => {
    const resizeObserver = new ResizeObserver(handleResize);

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (resizeTimeoutRef.current) {
        window.clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [handleResize]);

  // Focus terminal when pane becomes active
  useEffect(() => {
    if (isActive && terminalRef.current) {
      terminalRef.current.focus();
    }
  }, [isActive]);

  return (
    <div
      className={`terminal-container ${isActive ? 'active' : ''}`}
      ref={containerRef}
      onClick={onFocus}
    />
  );
};

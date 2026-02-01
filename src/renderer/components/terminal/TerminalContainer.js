import React, { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import './TerminalContainer.css';
export const TerminalContainer = ({ sessionId, isActive, onFocus, }) => {
    const containerRef = useRef(null);
    const terminalRef = useRef(null);
    const fitAddonRef = useRef(null);
    const resizeTimeoutRef = useRef(null);
    const sessionIdRef = useRef(sessionId);
    // Keep sessionId ref updated
    useEffect(() => {
        sessionIdRef.current = sessionId;
    }, [sessionId]);
    // Initialize terminal
    useEffect(() => {
        if (!containerRef.current)
            return;
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
        return () => {
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
                fitAddonRef.current.fit();
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
    return (<div className={`terminal-container ${isActive ? 'active' : ''}`} ref={containerRef} onClick={onFocus}/>);
};
//# sourceMappingURL=TerminalContainer.js.map
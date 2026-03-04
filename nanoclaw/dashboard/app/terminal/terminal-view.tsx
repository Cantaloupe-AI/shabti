'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

interface TerminalViewProps {
  sessionId: string | null;
  visible: boolean;
  apiKey: string;
  wsUrl: string;
  onSessionId: (tabKey: string, sessionId: string) => void;
  onExit: (tabKey: string) => void;
  tabKey: string;
}

export function TerminalView({
  sessionId,
  visible,
  apiKey,
  wsUrl,
  onSessionId,
  onExit,
  tabKey,
}: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const initializedRef = useRef(false);

  const connect = useCallback(
    (term: Terminal, fitAddon: FitAddon) => {
      const cols = term.cols;
      const rows = term.rows;
      const params = new URLSearchParams({
        apiKey,
        cols: String(cols),
        rows: String(rows),
      });
      if (sessionId) params.set('sessionId', sessionId);

      const ws = new WebSocket(`${wsUrl}/api/terminal/ws?${params}`);
      wsRef.current = ws;

      ws.onopen = () => {
        fitAddon.fit();
      };

      ws.onmessage = (ev) => {
        const data = ev.data as string;
        // Check for JSON control messages
        if (data.startsWith('{')) {
          try {
            const msg = JSON.parse(data);
            if (msg.type === 'session') {
              onSessionId(tabKey, msg.id);
              return;
            }
            if (msg.type === 'exit') {
              term.writeln('\r\n\x1b[90m[session ended]\x1b[0m');
              onExit(tabKey);
              return;
            }
            if (msg.type === 'error') {
              term.writeln(`\r\n\x1b[31m${msg.message}\x1b[0m`);
              return;
            }
          } catch {
            // Not JSON, fall through to write as terminal data
          }
        }
        term.write(data);
      };

      ws.onclose = () => {
        term.writeln('\r\n\x1b[90m[disconnected]\x1b[0m');
      };
    },
    [apiKey, wsUrl, sessionId, onSessionId, onExit, tabKey],
  );

  useEffect(() => {
    if (initializedRef.current || !containerRef.current) return;
    initializedRef.current = true;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
      theme: {
        background: '#0a0a0a',
        foreground: '#e5e5e5',
        cursor: '#e5e5e5',
        selectionBackground: '#3b82f640',
        black: '#0a0a0a',
        brightBlack: '#737373',
        white: '#e5e5e5',
        brightWhite: '#ffffff',
        blue: '#3b82f6',
        brightBlue: '#60a5fa',
        green: '#22c55e',
        brightGreen: '#4ade80',
        red: '#ef4444',
        brightRed: '#f87171',
        yellow: '#f59e0b',
        brightYellow: '#fbbf24',
        cyan: '#06b6d4',
        brightCyan: '#22d3ee',
        magenta: '#a855f7',
        brightMagenta: '#c084fc',
      },
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    term.onData((data) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // ResizeObserver for auto-fitting
    const observer = new ResizeObserver(() => {
      fitAddon.fit();
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    });
    observer.observe(containerRef.current);

    connect(term, fitAddon);

    return () => {
      observer.disconnect();
      wsRef.current?.close();
      term.dispose();
    };
  }, [connect]);

  // Focus terminal when tab becomes visible
  useEffect(() => {
    if (visible && termRef.current) {
      termRef.current.focus();
      fitAddonRef.current?.fit();
    }
  }, [visible]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ display: visible ? 'block' : 'none' }}
    />
  );
}

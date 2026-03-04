'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TerminalTabs } from './terminal-tabs';
import { TerminalView } from './terminal-view';

interface Tab {
  key: string;
  label: string;
  sessionId: string | null;
}

interface Credentials {
  apiKey: string;
  wsUrl: string;
}

let tabCounter = 0;

function makeTab(): Tab {
  tabCounter++;
  return { key: `tab-${tabCounter}`, label: `Terminal ${tabCounter}`, sessionId: null };
}

export default function TerminalPage() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeKey, setActiveKey] = useState('');
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);

  // Fetch API key and existing sessions on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    (async () => {
      try {
        // Fetch credentials
        const keyRes = await fetch('/api/terminal/key');
        if (!keyRes.ok) throw new Error('Failed to fetch terminal credentials');
        const keyData = await keyRes.json();
        setCreds(keyData);

        // Fetch existing sessions for reconnection
        const sessRes = await fetch('/api/terminal/sessions');
        if (sessRes.ok) {
          const existing: { id: string; createdAt: string }[] = await sessRes.json();
          if (existing.length > 0) {
            const reconnectedTabs = existing.map((s) => {
              tabCounter++;
              return { key: `tab-${tabCounter}`, label: `Terminal ${tabCounter}`, sessionId: s.id };
            });
            setTabs(reconnectedTabs);
            setActiveKey(reconnectedTabs[0].key);
            return;
          }
        }

        // No existing sessions — create first tab
        const first = makeTab();
        setTabs([first]);
        setActiveKey(first.key);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to initialize terminal');
      }
    })();
  }, []);

  const handleNew = useCallback(() => {
    const tab = makeTab();
    setTabs((prev) => [...prev, tab]);
    setActiveKey(tab.key);
  }, []);

  const handleClose = useCallback(
    (key: string) => {
      setTabs((prev) => {
        const tab = prev.find((t) => t.key === key);
        if (tab?.sessionId) {
          fetch(`/api/terminal/sessions/${tab.sessionId}`, { method: 'DELETE' }).catch(() => {});
        }
        const next = prev.filter((t) => t.key !== key);
        if (next.length === 0) {
          const fresh = makeTab();
          setActiveKey(fresh.key);
          return [fresh];
        }
        if (key === activeKey) {
          setActiveKey(next[next.length - 1].key);
        }
        return next;
      });
    },
    [activeKey],
  );

  const handleSessionId = useCallback((tabKey: string, sessionId: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.key === tabKey ? { ...t, sessionId } : t)),
    );
  }, []);

  const handleExit = useCallback(
    (tabKey: string) => {
      // Mark session as null so reconnection won't try
      setTabs((prev) =>
        prev.map((t) => (t.key === tabKey ? { ...t, sessionId: null } : t)),
      );
    },
    [],
  );

  if (error) {
    return (
      <div className="flex h-[calc(100vh-73px)] items-center justify-center">
        <div className="rounded-lg border border-[var(--error)]/30 bg-[var(--error)]/5 p-6">
          <p className="text-sm text-[var(--error)]">{error}</p>
        </div>
      </div>
    );
  }

  if (!creds) {
    return (
      <div className="flex h-[calc(100vh-73px)] items-center justify-center">
        <p className="text-sm text-[var(--text-muted)]">Connecting...</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-73px)] flex-col">
      <TerminalTabs
        tabs={tabs}
        activeKey={activeKey}
        onSelect={setActiveKey}
        onClose={handleClose}
        onNew={handleNew}
      />
      <div className="relative flex-1">
        {tabs.map((tab) => (
          <TerminalView
            key={tab.key}
            tabKey={tab.key}
            sessionId={tab.sessionId}
            visible={tab.key === activeKey}
            apiKey={creds.apiKey}
            wsUrl={creds.wsUrl}
            onSessionId={handleSessionId}
            onExit={handleExit}
          />
        ))}
      </div>
    </div>
  );
}

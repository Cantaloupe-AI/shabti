'use client';

import { useState, useEffect } from 'react';
import type { SessionsSnapshot, ActiveSession } from '@/lib/api';

function SessionStatusBadge({ session }: { session: ActiveSession }) {
  if (!session.active) {
    return (
      <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-[var(--warning)]/15 text-[var(--warning)]">
        queued
      </span>
    );
  }
  if (session.idleWaiting) {
    return (
      <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-[var(--text-muted)]/15 text-[var(--text-muted)]">
        idle
      </span>
    );
  }
  return (
    <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-[var(--success)]/15 text-[var(--success)]">
      running
    </span>
  );
}

function TypeBadge({ isTask }: { isTask: boolean }) {
  return (
    <span className="text-xs text-[var(--text-muted)]">
      {isTask ? 'task' : 'message'}
    </span>
  );
}

export function ActiveSessions() {
  const [data, setData] = useState<SessionsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const poll = async () => {
      try {
        const res = await fetch('/api/sessions');
        if (!res.ok) throw new Error(`${res.status}`);
        const snap: SessionsSnapshot = await res.json();
        if (mounted) {
          setData(snap);
          setError(null);
        }
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Failed to fetch');
      }
    };

    poll();
    const interval = setInterval(poll, 10_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (error && !data) {
    return (
      <div className="rounded-lg border border-[var(--error)]/30 bg-[var(--error)]/5 p-4">
        <p className="text-xs text-[var(--error)]">Sessions unavailable: {error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-[var(--text-muted)]">Loading sessions...</p>
    );
  }

  const activeGroups = data.groups.filter((g) => g.active);
  const queuedGroups = data.groups.filter((g) => !g.active);

  return (
    <div className="space-y-3">
      {/* Summary line */}
      <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
        <span>{data.activeCount} / {data.maxConcurrent} slots used</span>
        {data.waitingCount > 0 && (
          <span className="text-[var(--warning)]">{data.waitingCount} waiting</span>
        )}
      </div>

      {activeGroups.length === 0 && queuedGroups.length === 0 && (
        <p className="text-sm text-[var(--text-muted)]">No active sessions.</p>
      )}

      {/* Active sessions */}
      {activeGroups.map((s) => (
        <div
          key={s.groupJid}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
        >
          <div className="flex items-start justify-between gap-3 mb-1">
            <span className="text-sm font-medium truncate">
              {s.groupFolder || s.groupJid}
            </span>
            <SessionStatusBadge session={s} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
            <TypeBadge isTask={s.isTaskContainer} />
            {s.containerName && <span className="truncate">{s.containerName}</span>}
            {s.pendingMessages && <span>+ pending messages</span>}
            {s.pendingTaskCount > 0 && <span>+ {s.pendingTaskCount} queued task{s.pendingTaskCount > 1 ? 's' : ''}</span>}
          </div>
        </div>
      ))}

      {/* Queued sessions */}
      {queuedGroups.map((s) => (
        <div
          key={s.groupJid}
          className="rounded-lg border border-[var(--border)] border-dashed bg-[var(--surface)]/50 px-4 py-3"
        >
          <div className="flex items-start justify-between gap-3 mb-1">
            <span className="text-sm font-medium truncate text-[var(--text-muted)]">
              {s.groupFolder || s.groupJid}
            </span>
            <SessionStatusBadge session={s} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
            {s.pendingMessages && <span>pending messages</span>}
            {s.pendingTaskCount > 0 && <span>{s.pendingTaskCount} queued task{s.pendingTaskCount > 1 ? 's' : ''}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import type { ScheduledTask, TaskRunLog } from '@/lib/api';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-[var(--success)]/15 text-[var(--success)]',
    paused: 'bg-[var(--warning)]/15 text-[var(--warning)]',
    completed: 'bg-[var(--text-muted)]/15 text-[var(--text-muted)]',
  };

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || colors.completed}`}
    >
      {status}
    </span>
  );
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Denver',
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function TaskRow({ task }: { task: ScheduledTask }) {
  const [expanded, setExpanded] = useState(false);
  const [runs, setRuns] = useState<TaskRunLog[] | null>(null);
  const [loading, setLoading] = useState(false);

  const loadRuns = async () => {
    if (runs) {
      setExpanded(!expanded);
      return;
    }
    setLoading(true);
    setExpanded(true);
    try {
      const res = await fetch(`/api/tasks?taskId=${task.id}`);
      if (res.ok) {
        setRuns(await res.json());
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  // Truncate prompt for display
  const shortPrompt =
    task.prompt.length > 80 ? task.prompt.slice(0, 80) + '...' : task.prompt;

  return (
    <>
      <tr
        className="border-b border-[var(--border)] hover:bg-[var(--surface-hover)] cursor-pointer transition-colors"
        onClick={loadRuns}
      >
        <td className="px-4 py-3 text-sm">{task.id.slice(0, 8)}</td>
        <td className="px-4 py-3 text-sm max-w-xs truncate" title={task.prompt}>
          {shortPrompt}
        </td>
        <td className="px-4 py-3 text-sm text-[var(--text-muted)]">
          {task.schedule_type === 'cron' ? task.schedule_value : task.schedule_type}
        </td>
        <td className="px-4 py-3">
          <StatusBadge status={task.status} />
        </td>
        <td className="px-4 py-3 text-sm text-[var(--text-muted)]">
          {formatTime(task.next_run)}
        </td>
        <td className="px-4 py-3 text-sm text-[var(--text-muted)] max-w-[200px] truncate">
          {task.last_result || '—'}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="bg-[var(--surface)] px-4 py-3">
            {loading ? (
              <p className="text-xs text-[var(--text-muted)]">Loading runs...</p>
            ) : runs && runs.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs font-medium text-[var(--text-muted)] mb-2">
                  Recent Runs
                </p>
                {runs.map((run, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 text-xs py-1 border-b border-[var(--border)]/50 last:border-0"
                  >
                    <span
                      className={
                        run.status === 'success'
                          ? 'text-[var(--success)]'
                          : 'text-[var(--error)]'
                      }
                    >
                      {run.status === 'success' ? '✓' : '✗'}
                    </span>
                    <span className="text-[var(--text-muted)]">
                      {formatTime(run.run_at)}
                    </span>
                    <span className="text-[var(--text-muted)]">
                      {formatDuration(run.duration_ms)}
                    </span>
                    <span className="truncate max-w-md">
                      {run.error || run.result || '—'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">No runs yet</p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export function TaskList({ tasks }: { tasks: ScheduledTask[] }) {
  const [, setTick] = useState(0);

  // Auto-refresh by reloading the page every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
      window.location.reload();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  if (tasks.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)]">No scheduled tasks.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
      <table className="w-full text-left">
        <thead className="bg-[var(--surface)] text-xs text-[var(--text-muted)] uppercase tracking-wider">
          <tr>
            <th className="px-4 py-3">ID</th>
            <th className="px-4 py-3">Prompt</th>
            <th className="px-4 py-3">Schedule</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Next Run</th>
            <th className="px-4 py-3">Last Result</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

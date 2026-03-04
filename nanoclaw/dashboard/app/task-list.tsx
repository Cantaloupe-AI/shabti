'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { ScheduledTask, TaskRunLog, RegisteredGroup } from '@/lib/api';

// --- Helpers ---

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

function formatSchedule(scheduleValue: string): string {
  const ms = Number(scheduleValue);
  if (isNaN(ms) || ms <= 0) return scheduleValue;

  const minutes = ms / 60_000;
  const hours = ms / 3_600_000;
  const perDay = 86_400_000 / ms;

  if (minutes < 60) return `Every ${minutes} min`;
  if (hours === Math.floor(hours)) return `Every ${hours}h`;
  if (perDay === Math.floor(perDay) && perDay >= 1 && perDay <= 24) return `${perDay}x / day`;
  return `Every ${hours.toFixed(1)}h`;
}

type ScheduleMode = 'interval' | 'per_day';
type IntervalUnit = 'minutes' | 'hours';

interface FormState {
  prompt: string;
  mode: ScheduleMode;
  intervalValue: number;
  intervalUnit: IntervalUnit;
  perDayValue: number;
}

function msToForm(ms: number): Pick<FormState, 'mode' | 'intervalValue' | 'intervalUnit' | 'perDayValue'> {
  const minutes = ms / 60_000;
  const hours = ms / 3_600_000;

  if (hours >= 1 && hours === Math.floor(hours)) {
    return { mode: 'interval', intervalValue: hours, intervalUnit: 'hours', perDayValue: 1 };
  }
  if (minutes >= 1 && minutes === Math.floor(minutes)) {
    return { mode: 'interval', intervalValue: minutes, intervalUnit: 'minutes', perDayValue: 1 };
  }

  const perDay = 86_400_000 / ms;
  if (perDay === Math.floor(perDay) && perDay >= 1 && perDay <= 24) {
    return { mode: 'per_day', intervalValue: 30, intervalUnit: 'minutes', perDayValue: perDay };
  }

  return { mode: 'interval', intervalValue: Math.round(minutes), intervalUnit: 'minutes', perDayValue: 1 };
}

function formToMs(form: FormState): number {
  if (form.mode === 'per_day') {
    return Math.floor(86_400_000 / form.perDayValue);
  }
  return form.intervalUnit === 'hours'
    ? form.intervalValue * 3_600_000
    : form.intervalValue * 60_000;
}

// --- Modal ---

function TaskFormModal({
  task,
  onClose,
  onSave,
}: {
  task: ScheduledTask | null;
  onClose: () => void;
  onSave: (data: { prompt: string; schedule_value: string }) => void;
}) {
  const defaults = task
    ? { prompt: task.prompt, ...msToForm(Number(task.schedule_value)) }
    : { prompt: '', mode: 'interval' as ScheduleMode, intervalValue: 30, intervalUnit: 'minutes' as IntervalUnit, perDayValue: 1 };

  const [form, setForm] = useState<FormState>(defaults);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ prompt: form.prompt, schedule_value: String(formToMs(form)) });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-lg border border-[var(--border)] bg-[var(--bg)] p-5 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-lg font-semibold">{task ? 'Edit Task' : 'New Task'}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Prompt</label>
            <textarea
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              rows={4}
              value={form.prompt}
              onChange={(e) => setForm({ ...form, prompt: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-[var(--text-muted)]">Schedule</label>
            <div className="mb-3 flex gap-2">
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  form.mode === 'interval'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'
                }`}
                onClick={() => setForm({ ...form, mode: 'interval' })}
              >
                Every X time
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  form.mode === 'per_day'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'
                }`}
                onClick={() => setForm({ ...form, mode: 'per_day' })}
              >
                X times per day
              </button>
            </div>

            {form.mode === 'interval' ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--text-muted)]">Every</span>
                <input
                  type="number"
                  min={1}
                  className="w-20 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  value={form.intervalValue}
                  onChange={(e) => setForm({ ...form, intervalValue: Number(e.target.value) })}
                  required
                />
                <select
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  value={form.intervalUnit}
                  onChange={(e) => setForm({ ...form, intervalUnit: e.target.value as IntervalUnit })}
                >
                  <option value="minutes">minutes</option>
                  <option value="hours">hours</option>
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={24}
                  className="w-20 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  value={form.perDayValue}
                  onChange={(e) => setForm({ ...form, perDayValue: Number(e.target.value) })}
                  required
                />
                <span className="text-sm text-[var(--text-muted)]">times per day</span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            >
              {task ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Task Card (accordion) ---

function TaskCard({
  task,
  onEdit,
  onToggle,
  onDelete,
}: {
  task: ScheduledTask;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
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

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      {/* Card header — clickable to expand runs */}
      <div
        className="px-4 py-3 cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
        onClick={loadRuns}
      >
        {/* Top row: prompt + status */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <p className="text-sm leading-snug line-clamp-2 flex-1">{task.prompt}</p>
          <StatusBadge status={task.status} />
        </div>

        {/* Meta row: schedule, next run, ID */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
          <span>{formatSchedule(task.schedule_value)}</span>
          <span>Next: {formatTime(task.next_run)}</span>
          <span className="hidden sm:inline">ID: {task.id.slice(0, 8)}</span>
        </div>

        {/* Last result (if any) */}
        {task.last_result && (
          <p className="mt-1.5 text-xs text-[var(--text-muted)] truncate">
            Last: {task.last_result}
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex border-t border-[var(--border)]">
        <button
          onClick={onEdit}
          className="flex-1 px-3 py-2 text-xs text-[var(--text-muted)] hover:bg-[var(--surface-hover)] transition-colors border-r border-[var(--border)]"
        >
          Edit
        </button>
        <button
          onClick={onToggle}
          className="flex-1 px-3 py-2 text-xs text-[var(--text-muted)] hover:bg-[var(--surface-hover)] transition-colors border-r border-[var(--border)]"
        >
          {task.status === 'active' ? 'Pause' : 'Resume'}
        </button>
        <button
          onClick={onDelete}
          className="flex-1 px-3 py-2 text-xs text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors"
        >
          Delete
        </button>
      </div>

      {/* Expanded runs */}
      {expanded && (
        <div className="border-t border-[var(--border)] px-4 py-3 bg-[var(--bg)]">
          {loading ? (
            <p className="text-xs text-[var(--text-muted)]">Loading runs...</p>
          ) : runs && runs.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--text-muted)]">Recent Runs</p>
              {runs.map((run, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs py-1.5 border-b border-[var(--border)]/50 last:border-0"
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
                  <span className="text-[var(--text-muted)]">{formatTime(run.run_at)}</span>
                  <span className="text-[var(--text-muted)]">{formatDuration(run.duration_ms)}</span>
                  <span className="basis-full sm:basis-auto truncate text-[var(--text-muted)]">
                    {run.error || run.result || '—'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">No runs yet</p>
          )}
        </div>
      )}
    </div>
  );
}

// --- Main Component ---

export function TaskList({
  tasks: initialTasks,
  groups,
}: {
  tasks: ScheduledTask[];
  groups: Record<string, RegisteredGroup>;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [modalTask, setModalTask] = useState<ScheduledTask | null | 'new'>(null);

  const mainGroupJid = Object.entries(groups).find(([, g]) => g.folder === 'main')?.[0] || '';

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 30000);
    return () => clearInterval(interval);
  }, [router]);

  const handleCreate = useCallback(async (data: { prompt: string; schedule_value: string }) => {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        group_folder: 'main',
        chat_jid: mainGroupJid,
      }),
    });
    if (res.ok) {
      const task: ScheduledTask = await res.json();
      setTasks((prev) => [task, ...prev]);
    }
    setModalTask(null);
  }, [mainGroupJid]);

  const handleEdit = useCallback(async (id: string, data: { prompt: string; schedule_value: string }) => {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const updated: ScheduledTask = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    }
    setModalTask(null);
  }, []);

  const handleToggle = useCallback(async (task: ScheduledTask) => {
    const newStatus = task.status === 'active' ? 'paused' : 'active';
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      const updated: ScheduledTask = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this task? This cannot be undone.')) return;
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
    }
  }, []);

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setModalTask('new')}
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          + New Task
        </button>
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No scheduled tasks.</p>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={() => setModalTask(task)}
              onToggle={() => handleToggle(task)}
              onDelete={() => handleDelete(task.id)}
            />
          ))}
        </div>
      )}

      {modalTask !== null && (
        <TaskFormModal
          key={modalTask === 'new' ? 'new' : modalTask.id}
          task={modalTask === 'new' ? null : modalTask}
          onClose={() => setModalTask(null)}
          onSave={(data) =>
            modalTask === 'new'
              ? handleCreate(data)
              : handleEdit((modalTask as ScheduledTask).id, data)
          }
        />
      )}
    </>
  );
}

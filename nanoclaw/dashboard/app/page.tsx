import { fetchApi, type ScheduledTask, type RegisteredGroup } from '@/lib/api';
import { ActiveSessions } from './active-sessions';
import { TaskList } from './task-list';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let tasks: ScheduledTask[] = [];
  let groups: Record<string, RegisteredGroup> = {};
  let error: string | null = null;

  try {
    [tasks, groups] = await Promise.all([
      fetchApi<ScheduledTask[]>('/api/tasks'),
      fetchApi<Record<string, RegisteredGroup>>('/api/groups'),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to fetch data';
  }

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="rounded-lg border border-[var(--error)]/30 bg-[var(--error)]/5 p-6">
          <p className="text-sm text-[var(--error)]">Failed to load: {error}</p>
        </div>
      </main>
    );
  }

  const groupCount = Object.keys(groups).length;
  const activeTasks = tasks.filter((t) => t.status === 'active').length;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Groups" value={groupCount} />
        <StatCard label="Active Tasks" value={activeTasks} />
        <StatCard label="Total Tasks" value={tasks.length} />
      </div>

      {/* Active sessions */}
      <section>
        <h2 className="mb-4 text-sm font-medium text-[var(--text-muted)] uppercase tracking-wider">
          Active Sessions
        </h2>
        <ActiveSessions />
      </section>

      {/* Task list */}
      <section>
        <h2 className="mb-4 text-sm font-medium text-[var(--text-muted)] uppercase tracking-wider">
          Scheduled Tasks
        </h2>
        <TaskList tasks={tasks} groups={groups} />
      </section>
    </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

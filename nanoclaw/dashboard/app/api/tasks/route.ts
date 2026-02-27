import { NextRequest, NextResponse } from 'next/server';
import { fetchApi, type TaskRunLog } from '@/lib/api';

export async function GET(request: NextRequest) {
  const taskId = request.nextUrl.searchParams.get('taskId');

  if (!taskId) {
    return NextResponse.json({ error: 'taskId required' }, { status: 400 });
  }

  try {
    const runs = await fetchApi<TaskRunLog[]>(`/api/tasks/${taskId}/runs`);
    return NextResponse.json(runs);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

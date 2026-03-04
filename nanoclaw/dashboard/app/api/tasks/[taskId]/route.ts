import { NextRequest, NextResponse } from 'next/server';
import { mutateApi, type ScheduledTask } from '@/lib/api';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  try {
    const { taskId } = await params;
    const body = await request.json();
    const task = await mutateApi<ScheduledTask>(`/api/tasks/${taskId}`, 'PATCH', body);
    return NextResponse.json(task);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  try {
    const { taskId } = await params;
    await mutateApi(`/api/tasks/${taskId}`, 'DELETE');
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

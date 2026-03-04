import { NextRequest, NextResponse } from 'next/server';
import { mutateApi } from '@/lib/api';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const data = await mutateApi(`/api/terminal/sessions/${sessionId}`, 'DELETE');
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

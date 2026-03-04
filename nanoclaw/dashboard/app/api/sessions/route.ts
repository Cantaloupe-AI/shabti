import { NextResponse } from 'next/server';
import { fetchApi, type SessionsSnapshot } from '@/lib/api';

export async function GET() {
  try {
    const data = await fetchApi<SessionsSnapshot>('/api/sessions');
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

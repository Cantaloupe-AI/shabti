import { NextResponse } from 'next/server';
import { fetchApi } from '@/lib/api';

export async function GET() {
  try {
    const data = await fetchApi<{ id: string; createdAt: string; cols: number; rows: number }[]>(
      '/api/terminal/sessions',
    );
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.SHABTI_API_KEY || '';
  const apiUrl = process.env.SHABTI_API_URL || 'http://localhost:3001';

  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  // Derive WebSocket URL from API URL
  const wsUrl = apiUrl.replace(/^http/, 'ws');

  return NextResponse.json({ apiKey, wsUrl });
}

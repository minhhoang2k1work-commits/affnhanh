import { NextResponse } from 'next/server';
import { handleTelegramUpdate, flushTelegramNotifications } from '@/lib/telegram/agent';
import { isTelegramConfigured, validTelegramSecret } from '@/lib/telegram/config';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (!isTelegramConfigured()) return NextResponse.json({ error: 'Telegram is disabled or not configured.' }, { status: 503 });
  if (!validTelegramSecret(request.headers.get('x-telegram-bot-api-secret-token'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const raw = await request.text();
  if (raw.length > 20000) return NextResponse.json({ error: 'Request too large' }, { status: 413 });
  let body;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  try {
    return NextResponse.json(body?.flush === true ? await flushTelegramNotifications() : await handleTelegramUpdate(body));
  } catch { return NextResponse.json({ error: 'Agent temporarily unavailable; retry later.' }, { status: 503 }); }
}

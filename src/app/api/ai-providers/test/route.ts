import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, apiKey } = body;

    if (!name || !apiKey) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let success = false;
    let message = 'Test failed';

    try {
      if (name.toLowerCase() === 'openai') {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (res.ok) {
          success = true;
          message = 'Connected successfully';
        }
      } else if (name.toLowerCase() === 'kling') {
        const res = await fetch('https://api.klingai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (res.ok) {
          success = true;
          message = 'Connected successfully';
        }
      } else if (name.toLowerCase() === 'elevenlabs') {
        const res = await fetch('https://api.elevenlabs.io/v1/voices', {
          headers: { 'xi-api-key': apiKey },
        });
        if (res.ok) {
          success = true;
          message = 'Connected successfully';
        }
      } else {
        message = `Provider ${name} has no safe read-only connection test. Use a controlled canary generation.`;
      }
    } catch (e: any) {
      message = e.message;
    }

    return NextResponse.json({ success, message });
  } catch (error: any) {
    console.error('Error testing AI provider:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

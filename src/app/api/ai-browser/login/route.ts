import { NextResponse } from 'next/server';
import { getOrCreateUser } from '@/lib/db';
import { aiSessionManager } from '@/lib/ai-browser/session-manager';

// POST - Launch browser for user to login to an AI service
export async function POST(request: Request) {
  try {
    const user = await getOrCreateUser();
    const body = await request.json();
    const { service } = body;
    
    if (!service) {
      return NextResponse.json({ success: false, error: 'Service is required' }, { status: 400 });
    }

    const result = await aiSessionManager.launchLoginSession(user.id, service);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error launching login session:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

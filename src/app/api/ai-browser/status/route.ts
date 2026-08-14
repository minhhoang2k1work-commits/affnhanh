import { NextResponse } from 'next/server';
import { getOrCreateUser } from '@/lib/db';
import { aiSessionManager } from '@/lib/ai-browser/session-manager';

// GET - Get all session statuses
export async function GET(request: Request) {
  try {
    const user = await getOrCreateUser();
    const statuses = await aiSessionManager.getAllSessionStatuses(user.id);
    return NextResponse.json({ success: true, statuses });
  } catch (error: any) {
    console.error('Error getting session statuses:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// POST - Check specific session health
export async function POST(request: Request) {
  try {
    const user = await getOrCreateUser();
    const { service } = await request.json();
    
    if (!service) {
      return NextResponse.json({ success: false, error: 'Service is required' }, { status: 400 });
    }

    const result = await aiSessionManager.checkSessionHealth(user.id, service);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Error checking session health:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

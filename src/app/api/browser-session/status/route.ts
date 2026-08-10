import { NextRequest, NextResponse } from 'next/server';
import { BrowserManager } from '@/lib/browser/manager';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let user = await db.user.findFirst();
    if (!user) {
      return NextResponse.json({ connected: false, status: 'DISCONNECTED', message: 'Chưa có người dùng.' });
    }

    const manager = BrowserManager.getInstance();
    const result = await manager.checkSessionStatus(user.id);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('Error checking browser session status:', error);
    return NextResponse.json({ connected: false, status: 'ERROR', error: error?.message || 'Lỗi kiểm tra session.' }, { status: 500 });
  }
}

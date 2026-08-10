import { NextRequest, NextResponse } from 'next/server';
import { BrowserManager } from '@/lib/browser/manager';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    let user = await db.user.findFirst();
    if (!user) {
      user = await db.user.create({
        data: { email: 'creator@affhub.com', name: 'Affiliate Creator Pro' },
      });
    }

    const manager = BrowserManager.getInstance();
    const result = await manager.launchManualLoginSession(user.id);

    return NextResponse.json({
      success: result.success,
      message: result.message,
    });
  } catch (error: any) {
    console.error('Error launching browser session:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Không thể mở trình duyệt Playwright.' }, { status: 500 });
  }
}

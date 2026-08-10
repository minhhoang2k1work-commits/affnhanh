import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { deviceToken } = body;

    let user = await db.user.findFirst();
    if (!user) {
      user = await db.user.create({
        data: { email: 'creator@affhub.com', name: 'Affiliate Creator Pro' },
      });
    }

    if (deviceToken) {
      await db.extensionDevice.upsert({
        where: { deviceToken },
        update: { lastSeenAt: new Date() },
        create: {
          userId: user.id,
          deviceToken,
          lastSeenAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      serverTime: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Extension Heartbeat Error]:', error);
    return NextResponse.json(
      { error: 'Không thể xử lý heartbeat.' },
      { status: 500 }
    );
  }
}

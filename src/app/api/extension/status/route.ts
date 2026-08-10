import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await db.user.findFirst();
    if (!user) {
      return NextResponse.json({ connected: false, lastSeen: null });
    }

    const threshold = new Date(Date.now() - 30 * 1000);
    const activeDevice = await db.extensionDevice.findFirst({
      where: {
        userId: user.id,
        lastSeenAt: { gte: threshold },
      },
      orderBy: { lastSeenAt: 'desc' },
    });

    if (activeDevice) {
      return NextResponse.json({
        connected: true,
        deviceToken: activeDevice.deviceToken,
        lastSeen: activeDevice.lastSeenAt.toISOString(),
      });
    }

    const lastDevice = await db.extensionDevice.findFirst({
      where: { userId: user.id },
      orderBy: { lastSeenAt: 'desc' },
    });

    return NextResponse.json({
      connected: false,
      lastSeen: lastDevice ? lastDevice.lastSeenAt.toISOString() : null,
    });
  } catch (error: any) {
    console.error('[Extension Status Error]:', error);
    return NextResponse.json({ connected: false, lastSeen: null, error: error?.message });
  }
}

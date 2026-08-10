import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  let dbStatus = 'disconnected';
  let shopeeAffiliateStatus = 'not_connected';
  let extensionStatus = 'not_connected';
  let lastExtensionSeen: string | null = null;

  try {
    const user = await db.user.findFirst();
    if (user) {
      dbStatus = 'connected';

      const affAcc = await db.affiliateAccount.findFirst({
        where: { userId: user.id, platform: 'SHOPEE', status: 'ACTIVE' },
      });
      if (affAcc && affAcc.appId) {
        shopeeAffiliateStatus = 'connected';
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
        extensionStatus = 'connected';
        lastExtensionSeen = activeDevice.lastSeenAt.toISOString();
      }
    }
  } catch (error: any) {
    console.error('[HealthCheck Full Error]:', error);
  }

  return NextResponse.json({
    database: dbStatus,
    shopeeProductSource: 'ready',
    shopeeAffiliate: shopeeAffiliateStatus,
    extension: extensionStatus,
    lastExtensionSeen,
    timestamp: new Date().toISOString(),
  });
}

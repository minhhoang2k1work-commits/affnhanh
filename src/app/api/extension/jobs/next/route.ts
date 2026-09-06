import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const deviceToken = url.searchParams.get('deviceToken');
    const licenseKey = url.searchParams.get('licenseKey');

    // Update lastSeenAt for the requesting device if registered
    if (deviceToken) {
      db.licenseDevice.updateMany({
        where: { deviceToken },
        data: { lastSeenAt: new Date() },
      }).catch(() => {});
    }

    const user = await db.user.findFirst();
    if (!user) {
      return NextResponse.json({ hasJob: false });
    }

    // 1. Check specific queued ExtensionJob (e.g. GENERATE_AFFILIATE_LINK or SCAN_SHOP)
    const extJob = await db.extensionJob.findFirst({
      where: { userId: user.id, status: 'queued' },
      orderBy: { createdAt: 'asc' },
    });

    if (extJob) {
      if (extJob.payload && JSON.parse(extJob.payload).source === 'telegram') {
        const device = deviceToken ? await db.extensionDevice.findUnique({ where: { deviceToken } }) : null;
        const licensedDevice = deviceToken ? await db.licenseDevice.findUnique({ where: { deviceToken }, include: { license: true } }) : null;
        if (!device || device.userId !== extJob.userId || !licensedDevice || licensedDevice.license.key !== licenseKey || !licensedDevice.license.isActive || (licensedDevice.license.expiresAt && licensedDevice.license.expiresAt < new Date())) {
          return NextResponse.json({ hasJob: false, error: 'Thiết bị chưa được phép nhận lệnh Telegram.' }, { status: 403 });
        }
      }
      const claim = await db.extensionJob.updateMany({
        where: { id: extJob.id, status: 'queued' },
        data: { status: 'claimed', claimedAt: new Date() },
      });
      if (!claim.count) return NextResponse.json({ hasJob: false });

      return NextResponse.json({
        hasJob: true,
        job: {
          id: extJob.id,
          type: extJob.type,
          targetUrl: extJob.targetUrl,
          scanJobId: extJob.scanJobId,
          productId: extJob.productId,
          payload: extJob.payload ? JSON.parse(extJob.payload) : null,
        },
      });
    }

    // 2. Check queued ScanJob created from Web UI
    const scanJob = await db.scanJob.findFirst({
      where: {
        userId: user.id,
        source: 'extension',
        status: 'queued',
      },
      orderBy: { createdAt: 'asc' },
    });

    if (scanJob) {
      await db.scanJob.update({
        where: { id: scanJob.id },
        data: { status: 'processing', startedAt: new Date() },
      });

      return NextResponse.json({
        hasJob: true,
        job: {
          id: scanJob.id,
          type: 'SCAN_SHOP',
          targetUrl: scanJob.targetUrl,
          scanJobId: scanJob.id,
          scanToken: scanJob.scanToken,
        },
      });
    }

    return NextResponse.json({ hasJob: false });
  } catch (error: any) {
    console.error('[Extension Next Job Error]:', error);
    return NextResponse.json({ hasJob: false, error: error?.message });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { deviceToken, licenseKey } = body;

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

    let licenseValid = undefined;
    if (licenseKey && deviceToken) {
      const license = await db.license.findUnique({ where: { key: licenseKey } });
      if (!license || !license.isActive || (license.expiresAt && license.expiresAt < new Date())) {
        licenseValid = false;
      } else {
        const device = await db.licenseDevice.findUnique({ where: { deviceToken } });
        if (!device || device.licenseId !== license.id) {
          licenseValid = false;
        } else {
          licenseValid = true;
          // Update lastSeenAt for license device
          await db.licenseDevice.update({
             where: { id: device.id },
             data: { lastSeenAt: new Date() }
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      serverTime: new Date().toISOString(),
      ...(licenseValid !== undefined ? { licenseValid } : {})
    });
  } catch (error: any) {
    console.error('[Extension Heartbeat Error]:', error);
    return NextResponse.json(
      { error: 'Không thể xử lý heartbeat.' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    let { deviceToken, extensionVersion } = body;

    let user = await db.user.findFirst();
    if (!user) {
      user = await db.user.create({
        data: { email: 'creator@affhub.com', name: 'Affiliate Creator Pro' },
      });
    }

    if (!deviceToken) {
      deviceToken = `dev_${crypto.randomBytes(16).toString('hex')}`;
    }

    const device = await db.extensionDevice.upsert({
      where: { deviceToken },
      update: {
        lastSeenAt: new Date(),
        extensionVersion: extensionVersion || '1.0.0',
      },
      create: {
        userId: user.id,
        deviceToken,
        extensionVersion: extensionVersion || '1.0.0',
        lastSeenAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      deviceToken: device.deviceToken,
      userId: user.id,
      pairedAt: device.createdAt,
    });
  } catch (error: any) {
    console.error('[Extension Pair Error]:', error);
    return NextResponse.json(
      { error: 'Không thể kết nối cơ sở dữ liệu. Vui lòng kiểm tra cấu hình hệ thống.' },
      { status: 500 }
    );
  }
}

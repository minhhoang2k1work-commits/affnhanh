import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { licenseKey, deviceToken } = await req.json();

    if (!licenseKey || !deviceToken) {
      return NextResponse.json({ valid: false, reason: 'Thiếu thông tin bắt buộc.' }, { status: 400 });
    }

    const license = await db.license.findUnique({ where: { key: licenseKey } });

    if (!license) {
      return NextResponse.json({ valid: false, reason: 'License key không hợp lệ.' });
    }

    if (!license.isActive) {
      return NextResponse.json({ valid: false, reason: 'License đã bị vô hiệu hóa.' });
    }

    if (license.expiresAt && license.expiresAt < new Date()) {
      return NextResponse.json({ valid: false, reason: 'License đã hết hạn.' });
    }

    const device = await db.licenseDevice.findUnique({ where: { deviceToken } });

    if (!device || device.licenseId !== license.id) {
      return NextResponse.json({ success: false, valid: false, reason: 'Thiết bị không được đăng ký với license này.' });
    }

    await db.licenseDevice.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      valid: true,
      expiresAt: license.expiresAt,
      licenseName: license.name,
      maxDevices: license.maxDevices,
    });
  } catch (error) {
    console.error('[Extension Auth Verify Error]:', error);
    return NextResponse.json({ success: false, valid: false, reason: 'Lỗi server nội bộ.' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { licenseKey, deviceToken, deviceName } = await req.json();

    if (!licenseKey || !deviceToken) {
      return NextResponse.json({ valid: false, error: 'Thiếu thông tin bắt buộc.' }, { status: 400 });
    }

    const license = await db.license.findUnique({ where: { key: licenseKey } });

    if (!license) {
      return NextResponse.json({ valid: false, error: 'License key không hợp lệ.' });
    }

    if (!license.isActive) {
      return NextResponse.json({ valid: false, error: 'License đã bị vô hiệu hóa.' });
    }

    if (license.expiresAt && license.expiresAt < new Date()) {
      return NextResponse.json({ valid: false, error: 'License đã hết hạn.' });
    }

    const existingDevice = await db.licenseDevice.findUnique({ where: { deviceToken } });

    if (existingDevice) {
      if (existingDevice.licenseId === license.id) {
        await db.licenseDevice.update({
          where: { id: existingDevice.id },
          data: { lastSeenAt: new Date(), ...(deviceName ? { deviceName } : {}) },
        });
        
        const deviceCount = await db.licenseDevice.count({ where: { licenseId: license.id } });
        
        return NextResponse.json({
          success: true,
          valid: true,
          licenseName: license.name,
          expiresAt: license.expiresAt,
          deviceCount,
          maxDevices: license.maxDevices,
          deviceToken,
        });
      } else {
        return NextResponse.json({ success: false, valid: false, error: 'Thiết bị đã được đăng ký với license khác.' });
      }
    }

    const deviceCount = await db.licenseDevice.count({ where: { licenseId: license.id } });

    if (deviceCount >= license.maxDevices) {
      return NextResponse.json({ success: false, valid: false, error: `Đã đạt giới hạn ${license.maxDevices} thiết bị cho license này.` });
    }

    await db.licenseDevice.create({
      data: {
        licenseId: license.id,
        deviceToken,
        deviceName: deviceName || 'Unknown Device',
        lastSeenAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      valid: true,
      licenseName: license.name,
      expiresAt: license.expiresAt,
      deviceCount: deviceCount + 1,
      maxDevices: license.maxDevices,
      deviceToken,
    });
  } catch (error) {
    console.error('[Extension Auth Error]:', error);
    return NextResponse.json({ success: false, valid: false, error: 'Lỗi server nội bộ.' }, { status: 500 });
  }
}

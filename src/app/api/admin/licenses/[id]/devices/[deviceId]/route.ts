import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdminSessionFromRequest } from '@/lib/admin-auth';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string, deviceId: string }> }) {
  try {
    if (!verifyAdminSessionFromRequest(req)) {
      return NextResponse.json({ error: 'Chưa đăng nhập admin.' }, { status: 401 });
    }

    const { id, deviceId } = await params;
    
    await db.licenseDevice.delete({
      where: { 
        id: deviceId,
        licenseId: id
      },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin License Device DELETE Error]:', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ.' }, { status: 500 });
  }
}

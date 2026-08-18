import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string, deviceId: string }> }) {
  try {
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

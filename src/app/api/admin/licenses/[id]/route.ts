import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    
    const dataToUpdate: any = {};
    if (body.isActive !== undefined) dataToUpdate.isActive = body.isActive;
    if (body.name !== undefined) dataToUpdate.name = body.name;
    if (body.maxDevices !== undefined) dataToUpdate.maxDevices = body.maxDevices;
    if (body.expiresAt !== undefined) dataToUpdate.expiresAt = body.expiresAt === null ? null : new Date(body.expiresAt);
    
    const license = await db.license.update({
      where: { id },
      data: dataToUpdate,
    });
    
    return NextResponse.json(license);
  } catch (error) {
    console.error('[Admin License PATCH Error]:', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    await db.licenseDevice.deleteMany({
      where: { licenseId: id },
    });
    
    const deletedLicense = await db.license.delete({
      where: { id },
    });
    
    return NextResponse.json({ success: true, deleted: deletedLicense });
  } catch (error) {
    console.error('[Admin License DELETE Error]:', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ.' }, { status: 500 });
  }
}

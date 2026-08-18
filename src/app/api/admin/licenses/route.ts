import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const licenses = await db.license.findMany({
      include: { devices: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(licenses);
  } catch (error) {
    console.error('[Admin Licenses GET Error]:', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ.' }, { status: 500 });
  }
}

function generateLicenseKey(): string {
  const segment1 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const segment2 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const segment3 = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `AFF-${segment1}-${segment2}-${segment3}`;
}

export async function POST(req: NextRequest) {
  try {
    const { name, maxDevices, expiresAt } = await req.json().catch(() => ({}));
    
    const key = generateLicenseKey();
    
    const license = await db.license.create({
      data: {
        key,
        name: name || 'New License',
        maxDevices: maxDevices || 1,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });
    
    return NextResponse.json(license, { status: 201 });
  } catch (error) {
    console.error('[Admin Licenses POST Error]:', error);
    return NextResponse.json({ error: 'Lỗi server nội bộ.' }, { status: 500 });
  }
}

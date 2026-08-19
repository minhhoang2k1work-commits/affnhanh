import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const licenses = await db.license.findMany({
      include: { devices: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(licenses);
  } catch (error: any) {
    console.error('[Admin Licenses GET Error]:', error?.message || error);
    return NextResponse.json({ error: 'Lỗi server nội bộ.', detail: error?.message }, { status: 500 });
  }
}

function generateLicenseKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const makeSegment = (len: number) => {
    const arr = new Uint8Array(len);
    globalThis.crypto.getRandomValues(arr);
    return Array.from(arr).map(b => chars[b % chars.length]).join('');
  };
  return `AFF-${makeSegment(4)}-${makeSegment(4)}-${makeSegment(4)}`;
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
  } catch (error: any) {
    console.error('[Admin Licenses POST Error]:', error?.message || error);
    return NextResponse.json({ error: 'Lỗi server nội bộ.', detail: error?.message }, { status: 500 });
  }
}

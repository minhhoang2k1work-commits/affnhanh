import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const zipPath = path.join(process.cwd(), 'public', 'downloads', 'aff-shopee-scanner.zip');

    if (!fs.existsSync(zipPath)) {
      return NextResponse.redirect(new URL('/downloads/aff-shopee-scanner.zip', req.url));
    }

    const fileBuffer = fs.readFileSync(zipPath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="AFF-Shopee-Scanner-Extension.zip"',
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Lỗi khi tải file tiện ích.' }, { status: 500 });
  }
}

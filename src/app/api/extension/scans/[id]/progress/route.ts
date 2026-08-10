import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scanJobId = params.id;
    const body = await req.json();
    const { progress, processedProducts } = body;

    const job = await db.scanJob.update({
      where: { id: scanJobId },
      data: {
        progress: typeof progress === 'number' ? Math.min(100, Math.max(0, progress)) : undefined,
        processedProducts: typeof processedProducts === 'number' ? processedProducts : undefined,
        status: 'processing',
      },
    });

    return NextResponse.json({ success: true, progress: job.progress });
  } catch (error: any) {
    console.error('[Extension Progress Error]:', error);
    return NextResponse.json({ error: 'Lỗi cập nhật progress.' }, { status: 500 });
  }
}

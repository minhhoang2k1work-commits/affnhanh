import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureExtensionScanJob } from '@/lib/scanner/queue';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scanJobId = params.id;
    
    const scanJob = await ensureExtensionScanJob(scanJobId);
    if (!scanJob) {
       return NextResponse.json({ error: 'ScanJob không tồn tại.' }, { status: 404 });
    }

    const job = await db.scanJob.update({
      where: { id: scanJobId },
      data: {
        status: 'completed',
        progress: 100,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      status: job.status,
      totalProducts: job.totalProducts,
    });
  } catch (error: any) {
    console.error('[Extension Complete Error]:', error);
    return NextResponse.json({ error: 'Lỗi hoàn tất scan job.' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { startScanJobQueue } from '@/lib/scanner/queue';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    const scanJob = await db.scanJob.findUnique({
      where: { id: jobId },
      include: { items: true },
    });

    if (!scanJob) {
      return NextResponse.json({ error: 'Không tìm thấy Scan Job này.' }, { status: 404 });
    }

    // Reset failed items back to 'queued'
    await db.scanJobItem.updateMany({
      where: {
        scanJobId: jobId,
        status: { in: ['failed', 'invalid_url'] },
      },
      data: {
        status: 'queued',
        errorMessage: null,
      },
    });

    // Reset scan job status
    const updated = await db.scanJob.update({
      where: { id: jobId },
      data: {
        status: 'queued',
        progress: 0,
      },
    });

    // Restart Queue Runner
    startScanJobQueue(jobId);

    return NextResponse.json({
      success: true,
      message: 'Đã phát lại lượt quét cho các shop thất bại.',
      job: updated,
    });
  } catch (error: any) {
    console.error('Error retrying scan job:', error);
    return NextResponse.json({ error: error?.message || 'Có lỗi xảy ra khi thử lại.' }, { status: 500 });
  }
}

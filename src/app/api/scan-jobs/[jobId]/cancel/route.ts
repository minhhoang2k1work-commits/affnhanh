import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    const scanJob = await db.scanJob.findUnique({
      where: { id: jobId },
    });

    if (!scanJob) {
      return NextResponse.json({ error: 'Không tìm thấy Scan Job này.' }, { status: 404 });
    }

    const updated = await db.scanJob.update({
      where: { id: jobId },
      data: {
        status: 'cancelled',
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Đã dừng lượt quét shop thành công.',
      job: updated,
    });
  } catch (error: any) {
    console.error('Error cancelling scan job:', error);
    return NextResponse.json({ error: error?.message || 'Có lỗi xảy ra khi dừng lượt quét.' }, { status: 500 });
  }
}

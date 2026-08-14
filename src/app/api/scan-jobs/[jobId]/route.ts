import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    const scanJob = await db.scanJob.findUnique({
      where: { id: jobId },
      include: {
        items: {
          orderBy: { startedAt: 'asc' },
        },
      },
    });

    if (!scanJob) {
      return NextResponse.json({ error: 'Không tìm thấy Scan Job này.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      job: scanJob,
    });
  } catch (error: any) {
    console.error('Error fetching scan job status:', error);
    return NextResponse.json({ error: error?.message || 'Có lỗi xảy ra.' }, { status: 500 });
  }
}

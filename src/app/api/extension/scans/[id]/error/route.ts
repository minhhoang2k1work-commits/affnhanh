import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scanJobId = params.id;
    const body = await req.json();
    const { errorMessage } = body;

    const job = await db.scanJob.update({
      where: { id: scanJobId },
      data: {
        status: 'failed',
        errorMessage: errorMessage || 'Lỗi từ Extension khi đọc trang Shopee.',
        completedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, status: job.status });
  } catch (error: any) {
    console.error('[Extension Error Endpoint Error]:', error);
    return NextResponse.json({ error: 'Lỗi ghi nhận thất bại.' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const extJobId = params.jobId;
    const body = await req.json();
    const { affiliateUrl, productId, error } = body;

    const extJob = await db.extensionJob.findUnique({
      where: { id: extJobId },
    });

    if (!extJob) {
      return NextResponse.json({ error: 'ExtensionJob không tồn tại.' }, { status: 404 });
    }

    if (error || !affiliateUrl) {
      await db.extensionJob.update({
        where: { id: extJobId },
        data: {
          status: 'failed',
          errorMessage: error || 'Extension không thể sinh Affiliate Link.',
          completedAt: new Date(),
        },
      });
      return NextResponse.json({ success: false, error });
    }

    // Save Affiliate Link in DB
    const targetProdId = productId || extJob.productId;
    if (targetProdId) {
      const prod = await db.product.findUnique({ where: { id: targetProdId } });
      if (prod) {
        await db.affiliateLink.create({
          data: {
            userId: extJob.userId,
            productId: prod.id,
            originalUrl: prod.originalUrl,
            affiliateUrl,
            dataSource: 'browser',
            status: 'ACTIVE',
            subId: 'HUB_EXTENSION',
          },
        });

        // Update product affiliate status and URL
        await db.product.update({
          where: { id: prod.id },
          data: { 
            affiliateStatus: 'success',
            affiliateUrl: affiliateUrl 
          },
        });
      }
    }

    await db.extensionJob.update({
      where: { id: extJobId },
      data: {
        status: 'completed',
        result: JSON.stringify({ affiliateUrl }),
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      jobId: extJobId,
      affiliateUrl,
    });
  } catch (error: any) {
    console.error('[Extension Affiliate Result Error]:', error);
    return NextResponse.json({ error: 'Lỗi ghi nhận Affiliate Link.' }, { status: 500 });
  }
}

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

    // For web-initiated scans: Extension sends SCAN_COMPLETE before PRODUCTS_BATCH.
    // Don't finalize if products haven't been pushed yet — the products endpoint will handle finalization.
    const isExtensionOnly = scanJobId.startsWith('ext_');
    const hasProducts = scanJob.totalProducts > 0 || scanJob.processedProducts > 0;

    if (!isExtensionOnly && !hasProducts) {
      // Products not yet pushed — leave job in processing state
      // The /products endpoint will mark it completed when data arrives
      console.log(`[Extension Complete] Job ${scanJobId}: No products yet, keeping processing state.`);
      return NextResponse.json({
        success: true,
        status: scanJob.status,
        totalProducts: scanJob.totalProducts,
        message: 'Waiting for products push',
      });
    }

    const job = await db.scanJob.update({
      where: { id: scanJobId },
      data: {
        status: 'completed',
        progress: 100,
        completedAt: new Date(),
      },
    });

    // Also mark remaining pending ScanJobItems as completed
    await db.scanJobItem.updateMany({
      where: {
        scanJobId: scanJobId,
        status: { in: ['queued', 'resolving', 'scanning', 'queued_for_extension'] },
      },
      data: {
        status: 'completed',
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

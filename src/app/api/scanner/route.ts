import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateBulkInput, validateShopUrl } from '@/lib/scanner/url';
import { startScanJobQueue } from '@/lib/scanner/queue';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { shopUrl, shopUrls } = body;

    // Default system user
    let user = await db.user.findFirst();
    if (!user) {
      user = await db.user.create({
        data: {
          email: 'creator@affhub.com',
          name: 'Affiliate Creator Pro',
        },
      });
    }

    let inputUrls: string[] = [];
    if (Array.isArray(shopUrls) && shopUrls.length > 0) {
      inputUrls = shopUrls;
    } else if (typeof shopUrls === 'string' && shopUrls.trim()) {
      inputUrls = shopUrls.split('\n');
    } else if (shopUrl && typeof shopUrl === 'string') {
      inputUrls = [shopUrl];
    }

    if (inputUrls.length === 0) {
      return NextResponse.json({ error: 'Vui lòng nhập đường dẫn Shop hợp lệ.' }, { status: 400 });
    }

    // Section 34: Validate Bulk Input (max 50 URLs)
    const rawText = inputUrls.join('\n');
    const bulkValidation = await validateBulkInput(rawText, 50);

    if (bulkValidation.validItems.length === 0 && bulkValidation.invalidItems.length > 0) {
      return NextResponse.json(
        {
          error: bulkValidation.invalidItems[0]?.errorMessage || 'Tất cả đường dẫn nhập vào đều không hợp lệ.',
          invalidItems: bulkValidation.invalidItems,
        },
        { status: 400 }
      );
    }

    const totalShopsToScan = bulkValidation.validItems.length + bulkValidation.invalidItems.length;

    // Create ScanJob Record in DB
    const scanJob = await db.scanJob.create({
      data: {
        userId: user.id,
        type: inputUrls.length > 1 ? 'BULK' : 'SINGLE',
        totalShops: totalShopsToScan,
        status: 'queued',
        progress: 0,
      },
    });

    // Create ScanJobItem Records in DB
    const itemsToCreate = [
      ...bulkValidation.validItems.map((val) => ({
        scanJobId: scanJob.id,
        shopUrl: val.normalizedUrl,
        status: 'queued',
      })),
      ...bulkValidation.invalidItems.map((inv) => ({
        scanJobId: scanJob.id,
        shopUrl: inv.rawUrl,
        status: 'invalid_url',
        errorMessage: inv.errorMessage || 'Invalid URL',
      })),
    ];

    await db.scanJobItem.createMany({
      data: itemsToCreate,
    });

    // Launch Background Queue Runner (Async without blocking response)
    startScanJobQueue(scanJob.id);

    return NextResponse.json({
      success: true,
      jobId: scanJob.id,
      summary: {
        totalInput: bulkValidation.totalInput,
        validCount: bulkValidation.validItems.length,
        invalidCount: bulkValidation.invalidItems.length,
        duplicateCount: bulkValidation.duplicateCount,
      },
    });
  } catch (error: any) {
    console.error('Error submitting scan job:', error);
    return NextResponse.json({ error: error?.message || 'Có lỗi xảy ra khi khởi tạo lượt quét.' }, { status: 500 });
  }
}

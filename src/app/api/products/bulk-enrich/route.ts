import { NextRequest, NextResponse } from 'next/server';
import { enrichProductsBatch } from '@/lib/services/commissionEnricher';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { productIds, forceUpdate = true } = body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Danh sách productIds không hợp lệ hoặc đang trống.' },
        { status: 400 }
      );
    }

    // Limit batch size per request to 50 items
    const targetIds = productIds.slice(0, 50);

    const results = await enrichProductsBatch(targetIds, {
      maxConcurrency: 3,
      forceUpdate,
    });

    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      success: true,
      total: targetIds.length,
      successCount,
      results,
    });
  } catch (error: any) {
    console.error('Bulk enrich error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Lỗi khi cập nhật hoa hồng hàng loạt.' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { AccesstradeService } from '@/lib/providers/accesstradeService';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const since = searchParams.get('since') || undefined;
    const until = searchParams.get('until') || undefined;

    const apiKey = await AccesstradeService.getActiveApiKey();
    const adapter = AccesstradeService.getAdapter();

    const data = await adapter.getOrders(apiKey, { page, limit, since, until });

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Không thể tải báo cáo đơn hàng từ Accesstrade.' },
      { status: 500 }
    );
  }
}

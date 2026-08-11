import { NextRequest, NextResponse } from 'next/server';
import { AccesstradeService } from '@/lib/providers/accesstradeService';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const search = searchParams.get('search') || undefined;
    const approval = searchParams.get('approval') || undefined;

    const apiKey = await AccesstradeService.getActiveApiKey();
    const adapter = AccesstradeService.getAdapter();

    const data = await adapter.getCampaigns(apiKey, { page, limit, search, approval });

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Không thể tải danh sách chiến dịch Accesstrade.' },
      { status: 500 }
    );
  }
}

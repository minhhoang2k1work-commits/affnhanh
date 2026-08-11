import { NextRequest, NextResponse } from 'next/server';
import { AccesstradeService } from '@/lib/providers/accesstradeService';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { urls, campaignId, subId1, subId2, subId3, subId4, subId5, utterance } = body;

    if (!urls || (!Array.isArray(urls) && typeof urls !== 'string')) {
      return NextResponse.json({ success: false, error: 'Danh sách URL không hợp lệ.' }, { status: 400 });
    }

    const urlList: string[] = Array.isArray(urls)
      ? urls.map((u: string) => u.trim()).filter(Boolean)
      : [urls.trim()];

    if (urlList.length === 0) {
      return NextResponse.json({ success: false, error: 'Vui lòng cung cấp ít nhất 1 URL.' }, { status: 400 });
    }

    const apiKey = await AccesstradeService.getActiveApiKey();
    const adapter = AccesstradeService.getAdapter();

    const results = await adapter.createDeeplink(apiKey, {
      urls: urlList,
      campaignId,
      subId1,
      subId2,
      subId3,
      subId4,
      subId5,
      utterance,
    });

    const defaultUser = await AccesstradeService.getOrCreateDefaultUser();

    // Persist created affiliate links into database where possible
    for (const res of results) {
      if (res.success && res.affiliateUrl && res.productUrl) {
        try {
          await db.affiliateLink.create({
            data: {
              userId: defaultUser.id,
              productId: `at_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              originalUrl: res.productUrl,
              affiliateUrl: res.affiliateUrl,
              subId: subId1 || utterance || 'ACCESSTRADE_HUB',
              status: 'ACTIVE',
              dataSource: 'accesstrade_api',
            },
          });
        } catch (e) {
          // Non-blocking log for duplicate or optional DB save
          console.warn('Affiliate link DB save notice:', e);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Đã chuyển đổi thành công ${results.length} link Affiliate.`,
      results,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Lỗi xử lý tạo Deep Link từ Accesstrade.' },
      { status: 500 }
    );
  }
}

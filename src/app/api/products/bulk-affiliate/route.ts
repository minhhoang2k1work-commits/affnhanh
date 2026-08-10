import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AffiliateLinkService } from '@/lib/affiliate/service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { productIds } = body;

    let user = await db.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng.' }, { status: 401 });
    }

    let targetProducts = [];

    if (Array.isArray(productIds) && productIds.length > 0) {
      targetProducts = await db.product.findMany({
        where: { id: { in: productIds }, hasAffiliate: true },
      });
    } else {
      // Find all products pending configuration or missing affiliate links
      targetProducts = await db.product.findMany({
        where: {
          hasAffiliate: true,
          affiliateStatus: { in: ['pending', 'pending_configuration', 'failed'] },
        },
      });
    }

    let successCount = 0;
    let failedCount = 0;
    let pendingConfig = false;

    for (const prod of targetProducts) {
      const res = await AffiliateLinkService.generateAffiliateLinkForProduct({
        userId: user.id,
        productId: prod.id,
        subId: 'HUB_BULK_AFFILIATE',
      });

      if (res.status === 'success') {
        successCount++;
      } else if (res.status === 'pending_configuration') {
        pendingConfig = true;
        break;
      } else {
        failedCount++;
      }
    }

    if (pendingConfig) {
      return NextResponse.json(
        {
          error: 'Bạn chưa cấu hình tài khoản Affiliate. Vui lòng thêm App ID & App Secret trước.',
          status: 'pending_configuration',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      processedCount: targetProducts.length,
      successCount,
      failedCount,
    });
  } catch (error: any) {
    console.error('Error generating bulk affiliate links:', error);
    return NextResponse.json({ error: error?.message || 'Có lỗi xảy ra khi tạo link hàng loạt.' }, { status: 500 });
  }
}

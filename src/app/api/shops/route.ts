import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdapter } from '@/lib/adapters';

export async function GET() {
  try {
    const shops = await db.shop.findMany({
      include: {
        products: {
          select: { id: true, hasAffiliate: true, price: true, salePrice: true, commissionRate: true },
        },
        syncJobs: {
          take: 1,
          orderBy: { startedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, shops });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Có lỗi xảy ra.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, shopId, isAutoSync } = body;

    if (!shopId) {
      return NextResponse.json({ error: 'Thiếu shopId' }, { status: 400 });
    }

    if (action === 'TOGGLE_AUTO_SYNC') {
      const updated = await db.shop.update({
        where: { id: shopId },
        data: { isAutoSync: Boolean(isAutoSync) },
      });
      return NextResponse.json({ success: true, shop: updated });
    }

    if (action === 'SYNC_NOW') {
      const shop = await db.shop.findUnique({ where: { id: shopId } });
      if (!shop) return NextResponse.json({ error: 'Không tìm thấy shop' }, { status: 404 });

      const adapter = getAdapter(shop.platform);
      const catalog = await adapter.getProducts(shop.externalShopId, 40);

      let affCount = 0;
      for (const item of catalog) {
        if (item.hasAffiliate) affCount++;
        await db.product.upsert({
          where: {
            platform_externalProductId: {
              platform: item.platform,
              externalProductId: item.externalProductId,
            },
          },
          update: {
            price: item.price,
            salePrice: item.salePrice,
            sold: item.sold,
            stock: item.stock,
            rating: item.rating,
          },
          create: {
            platform: item.platform,
            shopId: shop.id,
            externalProductId: item.externalProductId,
            name: item.name,
            image: item.image,
            price: item.price,
            salePrice: item.salePrice,
            sold: item.sold,
            rating: item.rating,
            stock: item.stock,
            originalUrl: item.originalUrl,
            category: item.category,
            hasAffiliate: item.hasAffiliate,
            commissionRate: item.commissionRate,
            estCommission: item.estCommission,
            affiliateScore: item.affiliateScore,
          },
        });
      }

      const updatedShop = await db.shop.update({
        where: { id: shop.id },
        data: {
          productCount: catalog.length,
          affProductCount: affCount,
          lastSyncedAt: new Date(),
        },
      });

      return NextResponse.json({ success: true, shop: updatedShop, totalFound: catalog.length });
    }

    if (action === 'DELETE') {
      await db.shop.delete({ where: { id: shopId } });
      return NextResponse.json({ success: true, message: 'Đã xóa shop thành công' });
    }

    return NextResponse.json({ error: 'Hành động không hợp lệ' }, { status: 400 });
  } catch (error: any) {
    console.error('Error managing shop:', error);
    return NextResponse.json({ error: error?.message || 'Có lỗi xảy ra.' }, { status: 500 });
  }
}

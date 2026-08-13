import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdapter } from '@/lib/adapters';
import { AffiliateLinkService } from '@/lib/affiliate/service';
import { sanitizePrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const shop = await db.shop.findUnique({ where: { id } });
    if (!shop) {
      return NextResponse.json({ error: 'Không tìm thấy Shop.' }, { status: 404 });
    }

    const adapter = getAdapter(shop.platform);
    const catalog = await adapter.getProducts(shop.externalShopId, 50);

    const fetchedExternalIds = new Set(catalog.map((p) => p.externalProductId));

    // Section 24 Requirement: Mark products missing in marketplace as isActive = false
    const existingProducts = await db.product.findMany({
      where: { shopId: shop.id },
      select: { id: true, externalProductId: true },
    });

    for (const oldProd of existingProducts) {
      if (!fetchedExternalIds.has(oldProd.externalProductId)) {
        await db.product.update({
          where: { id: oldProd.id },
          data: { isActive: false },
        });
      }
    }

    let affCount = 0;
    for (const item of catalog) {
      if (item.hasAffiliate) affCount++;

      const cleanPrice = sanitizePrice(item.price);
      const cleanSalePrice = sanitizePrice(item.salePrice);

      const productRecord = await db.product.upsert({
        where: {
          platform_shopId_externalProductId: {
            platform: item.platform,
            shopId: shop.id,
            externalProductId: item.externalProductId,
          },
        },
        update: {
          name: item.name,
          image: item.image,
          price: cleanPrice,
          salePrice: cleanSalePrice,
          sold: item.sold,
          rating: item.rating,
          stock: item.stock,
          originalUrl: item.originalUrl,
          category: item.category,
          hasAffiliate: item.hasAffiliate,
          commissionRate: item.commissionRate,
          estCommission: Math.round((cleanSalePrice * item.commissionRate) / 100),
          affiliateScore: item.affiliateScore,
          isActive: true,
          updatedAt: new Date(),
        },
        create: {
          userId: shop.userId,
          platform: item.platform,
          shopId: shop.id,
          externalProductId: item.externalProductId,
          name: item.name,
          image: item.image,
          price: cleanPrice,
          salePrice: cleanSalePrice,
          sold: item.sold,
          rating: item.rating,
          stock: item.stock,
          originalUrl: item.originalUrl,
          category: item.category,
          hasAffiliate: item.hasAffiliate,
          commissionRate: item.commissionRate,
          estCommission: Math.round((cleanSalePrice * item.commissionRate) / 100),
          affiliateScore: item.affiliateScore,
          affiliateStatus: item.hasAffiliate ? 'pending' : 'not_eligible',
          isActive: true,
        },
      });

      if (item.hasAffiliate) {
        await AffiliateLinkService.generateAffiliateLinkForProduct({
          userId: shop.userId,
          productId: productRecord.id,
          subId: 'HUB_SYNC',
        });
      }
    }

    const updatedShop = await db.shop.update({
      where: { id: shop.id },
      data: {
        productCount: catalog.length,
        affProductCount: affCount,
        lastSyncedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      shop: updatedShop,
      totalSynced: catalog.length,
    });
  } catch (error: any) {
    console.error('Error syncing shop:', error);
    return NextResponse.json({ error: error?.message || 'Có lỗi xảy ra khi đồng bộ Shop.' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureExtensionScanJob } from '@/lib/scanner/queue';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scanJobId = params.id;
    const body = await req.json();
    const { shop, products } = body;

    const scanJob = await ensureExtensionScanJob(scanJobId);

    if (!scanJob) {
      return NextResponse.json({ error: 'ScanJob không tồn tại.' }, { status: 404 });
    }

    if (scanJob.status === 'cancelled') {
      return NextResponse.json({ error: 'Lượt quét đã bị hủy.', status: 'cancelled' }, { status: 400 });
    }

    const userId = scanJob.userId;
    const platform = 'SHOPEE';

    // 1. Upsert Shop Record
    let dbShop = null;
    if (shop && shop.shopId) {
      const extShopId = String(shop.shopId);
      const shopName = shop.name || `Shopee Store ${extShopId}`;
      const logo = shop.avatar || shop.logo || null;
      const shopUrl = shop.url || `https://shopee.vn/shop/${extShopId}`;

      dbShop = await db.shop.upsert({
        where: {
          userId_platform_externalShopId: {
            userId,
            platform,
            externalShopId: extShopId,
          },
        },
        update: {
          name: shopName,
          logo: logo || undefined,
          shopUrl,
          lastSyncedAt: new Date(),
        },
        create: {
          userId,
          platform,
          externalShopId: extShopId,
          name: shopName,
          logo,
          shopUrl,
          lastSyncedAt: new Date(),
        },
      });
    }

    // 2. Validate & Upsert Products
    let savedCount = 0;
    if (Array.isArray(products) && products.length > 0 && dbShop) {
      for (const prod of products) {
        if (!prod.productId || !prod.productName) continue;

        const extProductId = String(prod.productId);
        const name = String(prod.productName).trim();
        const image = prod.productImage || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300';
        const price = Number(prod.price) || Number(prod.salePrice) || 0;
        const salePrice = Number(prod.salePrice) || price;
        const sold = Number(prod.soldCount) || Number(prod.sold) || 0;
        const rating = Number(prod.rating) || 5.0;
        const originalUrl = prod.productUrl || `https://shopee.vn/product/${dbShop.externalShopId}/${extProductId}`;
        
        const commRate = Number(prod.commissionRate) || (price > 0 ? Math.min(20, Math.max(3, Math.floor(Math.random() * 12) + 4)) : 5);
        const estComm = Math.round((salePrice * commRate) / 100);
        const affScore = Math.min(100, Math.max(50, Math.round(commRate * 4 + rating * 8)));

        await db.product.upsert({
          where: {
            platform_shopId_externalProductId: {
              platform,
              shopId: dbShop.id,
              externalProductId: extProductId,
            },
          },
          update: {
            name,
            image,
            price,
            salePrice,
            sold,
            rating,
            originalUrl,
            commissionRate: commRate,
            estCommission: estComm,
            affiliateScore: affScore,
            dataSource: 'browser',
            isActive: true,
          },
          create: {
            userId,
            platform,
            shopId: dbShop.id,
            externalProductId: extProductId,
            name,
            image,
            price,
            salePrice,
            sold,
            rating,
            originalUrl,
            hasAffiliate: true,
            commissionRate: commRate,
            estCommission: estComm,
            affiliateScore: affScore,
            affiliateStatus: 'pending',
            dataSource: 'browser',
            isActive: true,
          },
        });

        savedCount++;
      }
    }

    // 3. Update ScanJob Total Count & Shop Count
    const updatedJob = await db.scanJob.update({
      where: { id: scanJobId },
      data: {
        totalProducts: { increment: savedCount },
        processedProducts: { increment: savedCount },
        processedShops: dbShop ? 1 : scanJob.processedShops,
        status: 'processing',
      },
    });

    if (dbShop && savedCount > 0) {
      await db.shop.update({
        where: { id: dbShop.id },
        data: {
          productCount: { increment: savedCount },
          affProductCount: { increment: savedCount },
        },
      });
    }

    return NextResponse.json({
      success: true,
      scanJobId,
      savedCount,
      totalProductsFound: updatedJob.totalProducts,
    });
  } catch (error: any) {
    console.error('[Extension Scans Products Error]:', error);
    return NextResponse.json(
      { error: 'Không thể lưu sản phẩm từ Extension.' },
      { status: 500 }
    );
  }
}

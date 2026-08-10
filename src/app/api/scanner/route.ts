import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdapter } from '@/lib/adapters';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { shopUrl, shopUrls } = body;

    const urlsToProcess: string[] = [];
    if (Array.isArray(shopUrls) && shopUrls.length > 0) {
      urlsToProcess.push(...shopUrls);
    } else if (shopUrl && typeof shopUrl === 'string') {
      urlsToProcess.push(shopUrl);
    }

    if (urlsToProcess.length === 0) {
      return NextResponse.json({ error: 'Vui lòng nhập ít nhất 1 đường dẫn Shop.' }, { status: 400 });
    }

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

    // Default Affiliate Account
    let affAccount = await db.affiliateAccount.findFirst({
      where: { userId: user.id, isDefault: true },
    });

    const results = [];

    for (const url of urlsToProcess) {
      const adapter = getAdapter('SHOPEE');
      const resolved = await adapter.resolveUrl(url);

      const targetShopId = resolved.shopId || `shop_${Date.now()}`;
      const shopDetails = await adapter.getShop(targetShopId);

      // Upsert Shop into DB
      const shopRecord = await db.shop.upsert({
        where: {
          platform_externalShopId: {
            platform: shopDetails.platform,
            externalShopId: shopDetails.externalShopId,
          },
        },
        update: {
          name: shopDetails.name,
          logo: shopDetails.logo,
          shopUrl: shopDetails.shopUrl,
          lastSyncedAt: new Date(),
        },
        create: {
          platform: shopDetails.platform,
          externalShopId: shopDetails.externalShopId,
          name: shopDetails.name,
          logo: shopDetails.logo,
          shopUrl: shopDetails.shopUrl,
          lastSyncedAt: new Date(),
        },
      });

      // Fetch products from Shop
      const catalog = await adapter.getProducts(shopDetails.externalShopId, 35);
      let affCount = 0;
      const importedProducts = [];

      for (const item of catalog) {
        if (item.hasAffiliate) affCount++;

        const productRecord = await db.product.upsert({
          where: {
            platform_externalProductId: {
              platform: item.platform,
              externalProductId: item.externalProductId,
            },
          },
          update: {
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
          create: {
            platform: item.platform,
            shopId: shopRecord.id,
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

        // Generate Affiliate Link automatically if product has affiliate
        if (item.hasAffiliate) {
          const affUrl = await adapter.generateAffiliateLink({
            originUrl: item.originalUrl,
            subIds: ['HUB_AUTO_IMPORT'],
          });

          await db.affiliateLink.upsert({
            where: { id: `link_${productRecord.id}` },
            update: {
              affiliateUrl: affUrl,
            },
            create: {
              id: `link_${productRecord.id}`,
              userId: user.id,
              productId: productRecord.id,
              affiliateAccountId: affAccount?.id || null,
              originalUrl: item.originalUrl,
              affiliateUrl: affUrl,
              subId: 'HUB_AUTO_IMPORT',
            },
          });
        }

        importedProducts.push(productRecord);
      }

      // Update shop counter
      await db.shop.update({
        where: { id: shopRecord.id },
        data: {
          productCount: catalog.length,
          affProductCount: affCount,
        },
      });

      // Log Sync Job
      await db.syncJob.create({
        data: {
          shopId: shopRecord.id,
          status: 'COMPLETED',
          totalFound: catalog.length,
          totalAffiliate: affCount,
          completedAt: new Date(),
        },
      });

      results.push({
        shop: shopRecord,
        totalFound: catalog.length,
        totalAffiliate: affCount,
        nonAffiliate: catalog.length - affCount,
        products: importedProducts,
      });
    }

    return NextResponse.json({
      success: true,
      scannedCount: results.length,
      results,
    });
  } catch (error: any) {
    console.error('Error scanning shop:', error);
    return NextResponse.json({ error: error?.message || 'Có lỗi xảy ra khi quét Shop.' }, { status: 500 });
  }
}

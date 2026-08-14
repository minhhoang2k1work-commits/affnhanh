import { NextRequest, NextResponse } from 'next/server';
import { lookupShopeeProduct } from '@/lib/services/quickLookupService';
import { db } from '@/lib/db';

export async function GET() {
  const hasEnvCookie = Boolean(process.env.ADDLIVETAG_COOKIE);
  return NextResponse.json({
    status: 'ok',
    hasCookie: hasEnvCookie,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { input, customCookie, saveToLibrary, category, targetCustomer, subId } = body;

    if (!input || typeof input !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Vui lòng cung cấp link Shopee hoặc Item ID hợp lệ.' },
        { status: 400 }
      );
    }

    const result = await lookupShopeeProduct(input, customCookie);

    if (!result.success || !result.data) {
      return NextResponse.json(
        { success: false, error: result.error || 'Không tìm thấy thông tin sản phẩm.' },
        { status: 404 }
      );
    }

    const prod = result.data;

    // Find configured Shopee Affiliate ID to generate personalized affiliate link
    let generatedAffiliateUrl = prod.shopeeUrl;
    try {
      const shopeeAccount = await db.affiliateAccount.findFirst({
        where: {
          platform: 'SHOPEE',
          status: 'ACTIVE',
        },
      });

      const affId = shopeeAccount?.appId || '100889201';
      const trackingTag = subId ? `&sub_id=${encodeURIComponent(subId)}` : '';
      generatedAffiliateUrl = `https://s.shopee.vn/an_redir?origin_link=${encodeURIComponent(prod.shopeeUrl)}&affiliate_id=${affId}${trackingTag}`;
    } catch (e) {
      console.warn('Could not query account for affiliate ID', e);
    }

    // Optional: Save directly to Library DB
    let savedProduct = null;
    if (saveToLibrary) {
      try {
        const platform = 'SHOPEE';
        const defaultUserId = 'default-user-id';
        const extShopId = prod.shopId || 'unknown_shop';

        // 1. Ensure user exists
        let dbUser = await db.user.findFirst();
        const userId = dbUser ? dbUser.id : defaultUserId;

        // 2. Ensure shop exists
        const dbShop = await db.shop.upsert({
          where: {
            userId_platform_externalShopId: {
              userId,
              platform,
              externalShopId: extShopId,
            },
          },
          update: {
            name: prod.shopName || `Shopee Store ${extShopId}`,
            shopUrl: prod.shopeeUrl ? `https://shopee.vn/shop/${extShopId}` : undefined,
            lastSyncedAt: new Date(),
          },
          create: {
            userId,
            platform,
            externalShopId: extShopId,
            name: prod.shopName || `Shopee Store ${extShopId}`,
            shopUrl: `https://shopee.vn/shop/${extShopId}`,
            lastSyncedAt: new Date(),
          },
        });

        // 3. Upsert Product
        const totalComm = prod.commission.totalRate || 0;
        const estComm = prod.commission.totalAmount || Math.round((prod.price * totalComm) / 100);
        const affScore = Math.min(100, Math.max(50, Math.round((totalComm * 4) + (prod.rating * 8))));

        savedProduct = await db.product.upsert({
          where: {
            platform_shopId_externalProductId: {
              platform,
              shopId: dbShop.id,
              externalProductId: prod.itemId,
            },
          },
          update: {
            name: prod.name,
            price: prod.price,
            salePrice: prod.price,
            baseCommissionRate: prod.commission.shopeeRate || 0,
            extraCommissionRate: prod.commission.sellerRate || 0,
            totalCommissionRate: totalComm,
            commissionRate: totalComm,
            maxCommission: prod.commission.capAmount || undefined,
            estCommission: estComm,
            commissionSource: 'addlivetag',
            commissionUpdatedAt: new Date(),
            image: prod.image,
            originalUrl: prod.shopeeUrl,
            category: category || undefined,
            targetCustomer: targetCustomer || undefined,
            rating: prod.rating,
            sold: prod.soldCount,
            affiliateScore: affScore,
          },
          create: {
            userId,
            platform,
            shopId: dbShop.id,
            externalProductId: prod.itemId,
            name: prod.name,
            price: prod.price,
            salePrice: prod.price,
            baseCommissionRate: prod.commission.shopeeRate || 0,
            extraCommissionRate: prod.commission.sellerRate || 0,
            totalCommissionRate: totalComm,
            commissionRate: totalComm,
            maxCommission: prod.commission.capAmount || undefined,
            estCommission: estComm,
            commissionSource: 'addlivetag',
            commissionUpdatedAt: new Date(),
            image: prod.image,
            originalUrl: prod.shopeeUrl,
            category: category || 'Khác',
            targetCustomer: targetCustomer || 'Tất cả mọi người',
            rating: prod.rating,
            sold: prod.soldCount,
            affiliateScore: affScore,
          },
        });
      } catch (dbErr: any) {
        console.warn('Failed to auto-save to library:', dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...prod,
        generatedAffiliateUrl,
        savedProduct,
      },
    });
  } catch (error: any) {
    console.error('Quick lookup API error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Lỗi xử lý tra cứu sản phẩm.' },
      { status: 500 }
    );
  }
}

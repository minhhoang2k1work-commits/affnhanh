import { NextRequest, NextResponse } from 'next/server';
import { extractShopeeIdentifiers, lookupShopeeProduct, QuickLookupResult } from '@/lib/services/quickLookupService';
import { db } from '@/lib/db';
import { ShopeeAffiliateAdapter } from '@/lib/adapters/shopeeAffiliate';
import { decryptText } from '@/lib/crypto';

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

    let result: QuickLookupResult = await lookupShopeeProduct(input, customCookie);

    // Resilient fallback: keep working from the last verified library record
    // when the external lookup source is temporarily unavailable.
    if (!result.success || !result.data) {
      const { itemId } = extractShopeeIdentifiers(input);
      const cached = itemId ? await db.product.findFirst({
        where: { platform: 'SHOPEE', externalProductId: itemId },
        include: { shop: { select: { name: true, externalShopId: true } } },
        orderBy: { commissionUpdatedAt: 'desc' },
      }) : null;

      if (cached) {
        const price = cached.salePrice || cached.price;
        const totalRate = cached.totalCommissionRate || cached.commissionRate || 0;
        const sellerRate = cached.extraCommissionRate || 0;
        const shopeeRate = cached.baseCommissionRate || Math.max(0, totalRate - sellerRate);
        const formatVnd = (value: number) => `${new Intl.NumberFormat('vi-VN').format(Math.round(value))}đ`;
        const totalAmount = cached.estCommission || Math.round((price * totalRate) / 100);
        const sellerAmount = Math.round((price * sellerRate) / 100);
        const shopeeAmount = Math.round((price * shopeeRate) / 100);
        const cachedSource = cached.commissionSource?.includes('official')
          ? 'official_api'
          : cached.commissionSource?.includes('metadata') ? 'metadata' : totalRate > 0 ? 'details' : 'unavailable';

        result = {
          success: true,
          data: {
            name: cached.name,
            image: cached.image,
            shopName: cached.shop.name,
            isShopXtra: cached.extraCommissionRate > 0,
            isMall: false,
            price,
            priceFormatted: formatVnd(price),
            sold: `${cached.sold} đã bán`,
            soldCount: cached.sold,
            rating: cached.rating,
            itemId: cached.externalProductId,
            shopId: cached.shop.externalShopId,
            shopeeUrl: cached.originalUrl,
            commission: {
              totalRate,
              totalAmountFormatted: totalRate > 0 ? formatVnd(totalAmount) : '—',
              totalAmount,
              sellerRate,
              sellerAmountFormatted: totalRate > 0 ? formatVnd(sellerAmount) : '—',
              sellerAmount,
              shopeeRate,
              shopeeAmountFormatted: totalRate > 0 ? formatVnd(shopeeAmount) : '—',
              shopeeAmount,
              capAmountFormatted: cached.maxCommission != null ? formatVnd(cached.maxCommission) : 'Chưa rõ',
              capAmount: cached.maxCommission || 0,
              capStatus: cached.maxCommission != null ? 'Dữ liệu đã lưu' : 'Chưa công bố',
              note: `Đang dùng dữ liệu gần nhất trong Thư viện${cached.commissionUpdatedAt ? `, cập nhật ${cached.commissionUpdatedAt.toLocaleString('vi-VN')}` : ''}.`,
              isUnlocked: false,
              hasData: totalRate > 0,
              source: cachedSource,
              capKnown: cached.maxCommission != null,
              status: totalRate > 0 ? 'available' : 'unknown',
            },
            priceHistory: {
              currentPrice: formatVnd(price),
              maxPrice: formatVnd(price),
              avgPrice: formatVnd(price),
              change7d: 'Chưa có dữ liệu',
              change30d: 'Chưa có dữ liệu',
            },
            fetchedAt: (cached.commissionUpdatedAt || cached.updatedAt).toISOString(),
          },
        };
      }
    }

    if (!result.success || !result.data) {
      return NextResponse.json(
        { success: false, error: result.error || 'Không tìm thấy thông tin sản phẩm.' },
        { status: 404 }
      );
    }

    const prod = result.data;

    // Prefer the official Shopee Affiliate offer API whenever credentials exist.
    // Addlivetag remains the fallback for accounts without API access.
    let shopeeAccount = null;
    try {
      shopeeAccount = await db.affiliateAccount.findFirst({
        where: { platform: 'SHOPEE', status: 'ACTIVE' },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      });
      if (shopeeAccount?.appId && shopeeAccount.appSecretEnc) {
        const official = await new ShopeeAffiliateAdapter().getProductCommission(prod.itemId, {
          appId: shopeeAccount.appId,
          appSecret: decryptText(shopeeAccount.appSecretEnc),
        });
        if (official.available) {
          const totalAmount = Math.round((prod.price * official.totalRate) / 100);
          const sellerAmount = Math.round((prod.price * official.extraRate) / 100);
          const shopeeAmount = Math.round((prod.price * official.baseRate) / 100);
          const formatVnd = (value: number) => `${new Intl.NumberFormat('vi-VN').format(value)}đ`;
          prod.commission = {
            ...prod.commission,
            totalRate: official.totalRate,
            totalAmount,
            totalAmountFormatted: formatVnd(totalAmount),
            sellerRate: official.extraRate,
            sellerAmount,
            sellerAmountFormatted: formatVnd(sellerAmount),
            shopeeRate: official.baseRate,
            shopeeAmount,
            shopeeAmountFormatted: formatVnd(shopeeAmount),
            hasData: true,
            source: 'official_api',
            status: official.totalRate > 0 ? 'available' : 'not_affiliate',
            note: official.totalRate > 0
              ? 'Tỷ lệ hoa hồng được xác nhận từ Shopee Affiliate Open API.'
              : 'Shopee Affiliate Open API xác nhận sản phẩm này hiện không có hoa hồng.',
          };
        }
      }
    } catch (error) {
      console.warn('Official Shopee commission lookup failed; using fallback source.', error);
    }

    // Find configured Shopee Affiliate ID to generate personalized affiliate link
    let generatedAffiliateUrl = prod.shopeeUrl;
    try {
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
        const totalComm = prod.commission.hasData ? prod.commission.totalRate : 0;
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
            maxCommission: prod.commission.capKnown ? prod.commission.capAmount : undefined,
            estCommission: estComm,
            commissionSource: prod.commission.hasData ? `addlivetag_${prod.commission.source}` : 'addlivetag_unavailable',
            commissionUpdatedAt: prod.commission.hasData ? new Date() : undefined,
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
            maxCommission: prod.commission.capKnown ? prod.commission.capAmount : undefined,
            estCommission: estComm,
            commissionSource: prod.commission.hasData ? `addlivetag_${prod.commission.source}` : 'addlivetag_unavailable',
            commissionUpdatedAt: prod.commission.hasData ? new Date() : undefined,
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

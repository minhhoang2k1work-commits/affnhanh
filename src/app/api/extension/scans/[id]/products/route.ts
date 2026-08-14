import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureExtensionScanJob } from '@/lib/scanner/queue';
import { sanitizePrice } from '@/lib/utils';
import { enrichProductsBatch } from '@/lib/services/commissionEnricher';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: scanJobId } = await params;
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
    let platform = (body.platform || shop?.platform || '').toUpperCase();
    if (!platform || (platform !== 'SHOPEE' && platform !== 'TIKTOK')) {
      const urlToCheck = shop?.url || (products?.[0]?.productUrl) || (products?.[0]?.link) || '';
      platform = urlToCheck.includes('tiktok') ? 'TIKTOK' : 'SHOPEE';
    }

    // 1. Upsert Shop Record
    let dbShop = null;
    if (shop) {
      const extShopId = String(shop.shopId || `shop_${Date.now()}`);
      const defaultName = platform === 'TIKTOK' ? `TikTok Shop @${extShopId}` : `Shopee Store ${extShopId}`;
      const defaultUrl = platform === 'TIKTOK' ? `https://www.tiktok.com/@${extShopId}` : `https://shopee.vn/shop/${extShopId}`;
      const shopName = shop.name || defaultName;
      const logo = shop.avatar || shop.logo || null;
      const shopUrl = shop.url || defaultUrl;

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

    // 2. Validate & Upsert Products (Handle existing product updates)
    let savedCount = 0;
    let createdCount = 0;
    let updatedCount = 0;
    const affectedProductIds: string[] = [];

    if (Array.isArray(products) && products.length > 0 && dbShop) {
      for (const prod of products) {
        if (!prod || (!prod.productId && !prod.itemId) || !prod.productName) continue;

        try {
          const extProductId = String(prod.productId || prod.itemId || `prod_${Date.now()}_${Math.random()}`);
          const name = String(prod.productName || prod.name || 'Unnamed Product').trim();
          const image = prod.productImage || prod.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300';
          
          let price = sanitizePrice(Number(prod.price) || Number(prod.salePrice) || 0);
          let salePrice = sanitizePrice(Number(prod.salePrice) || price);

          let sold = Number(prod.soldCount) || Number(prod.sold) || 0;
          if (isNaN(sold)) sold = 0;

          let rating = Number(prod.rating) || 5.0;
          if (isNaN(rating)) rating = 5.0;

          const defaultProdUrl = platform === 'TIKTOK' 
            ? `https://www.tiktok.com/view/product/${extProductId}`
            : `https://shopee.vn/product/${dbShop.externalShopId}/${extProductId}`;
          const originalUrl = prod.productUrl || prod.link || defaultProdUrl;
          
          let commRate = (prod.commissionRate !== undefined && prod.commissionRate !== null && !isNaN(Number(prod.commissionRate))) ? Number(prod.commissionRate) : 0;
          if (isNaN(commRate)) commRate = 0;

          const maxCommission = prod.maxCommission !== undefined && prod.maxCommission !== null ? Number(prod.maxCommission) : undefined;
          const affiliateProgram = prod.affiliateProgram || undefined;
          const voucherAffiliate = prod.voucherAffiliate || undefined;
          const voucherShop = prod.voucherShop || undefined;
          const voucherPlatform = prod.voucherPlatform || undefined;
          const commissionCondition = prod.commissionCondition || undefined;
          const campaignValidity = prod.campaignValidity || undefined;
          const allowAds = prod.allowAds !== undefined && prod.allowAds !== null ? Boolean(prod.allowAds) : undefined;
          const cpsActual = prod.cpsActual !== undefined && prod.cpsActual !== null ? Number(prod.cpsActual) : undefined;

          // Check if product already exists
          const existingProduct = await db.product.findUnique({
            where: {
              platform_shopId_externalProductId: {
                platform,
                shopId: dbShop.id,
                externalProductId: extProductId,
              },
            },
          });

          if (existingProduct) {
            // UPDATING existing product
            // Preserve commissionRate if extension sent 0 but existing product had a commission rate > 0
            const finalCommRate = commRate > 0 ? commRate : (existingProduct.commissionRate || 0);
            const finalEstComm = Math.round((salePrice * finalCommRate) / 100);
            const finalAffScore = Math.min(100, Math.max(50, Math.round(finalCommRate * 4 + rating * 8)));

            await db.product.update({
              where: { id: existingProduct.id },
              data: {
                name,
                image,
                price: price > 0 ? price : existingProduct.price,
                salePrice: salePrice > 0 ? salePrice : existingProduct.salePrice,
                sold: Math.max(sold, existingProduct.sold),
                rating,
                originalUrl,
                commissionRate: finalCommRate,
                estCommission: finalEstComm,
                affiliateScore: finalAffScore,
                dataSource: 'browser',
                isActive: true,
                updatedAt: new Date(),
                ...(maxCommission !== undefined && { maxCommission }),
                ...(affiliateProgram && { affiliateProgram }),
                ...(voucherAffiliate && { voucherAffiliate }),
                ...(voucherShop && { voucherShop }),
                ...(voucherPlatform && { voucherPlatform }),
                ...(commissionCondition && { commissionCondition }),
                ...(campaignValidity && { campaignValidity }),
                ...(allowAds !== undefined && { allowAds }),
                ...(cpsActual !== undefined && { cpsActual }),
              },
            });
            affectedProductIds.push(existingProduct.id);
            updatedCount++;
          } else {
            // CREATING new product
            let estComm = Math.round((salePrice * commRate) / 100);
            if (isNaN(estComm)) estComm = 0;

            let affScore = Math.min(100, Math.max(50, Math.round(commRate * 4 + rating * 8)));
            if (isNaN(affScore)) affScore = 85;

            const createdProduct = await db.product.create({
              data: {
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
                ...(maxCommission !== undefined && { maxCommission }),
                ...(affiliateProgram && { affiliateProgram }),
                ...(voucherAffiliate && { voucherAffiliate }),
                ...(voucherShop && { voucherShop }),
                ...(voucherPlatform && { voucherPlatform }),
                ...(commissionCondition && { commissionCondition }),
                ...(campaignValidity && { campaignValidity }),
                ...(allowAds !== undefined && { allowAds }),
                ...(cpsActual !== undefined && { cpsActual }),
              },
            });
            affectedProductIds.push(createdProduct.id);
            createdCount++;
          }

          savedCount++;
        } catch (itemErr: any) {
          console.error(`[Extension Products Upsert Item Error]:`, itemErr?.message);
        }
      }
    }

    // 3. Update ScanJob Total Count & Shop Count
    const isExtensionOnly = scanJobId.startsWith('ext_');
    const jobStatus = isExtensionOnly ? 'processing' : 'completed';

    const updatedJob = await db.scanJob.update({
      where: { id: scanJobId },
      data: {
        totalProducts: { increment: createdCount },
        processedProducts: { increment: savedCount },
        processedShops: dbShop ? 1 : scanJob.processedShops,
        status: jobStatus,
        progress: isExtensionOnly ? scanJob.progress : 100,
        completedAt: isExtensionOnly ? null : new Date(),
      },
    });

    if (!isExtensionOnly) {
      // Mark ExtensionJob as completed
      await db.extensionJob.updateMany({
        where: { scanJobId: scanJobId, type: 'SCAN_SHOP' },
        data: { status: 'completed' },
      });

      // Mark ScanJobItem as completed — include shopId so scanner page can find it
      await db.scanJobItem.updateMany({
        where: { scanJobId: scanJobId },
        data: { 
          status: 'completed',
          shopId: dbShop ? dbShop.externalShopId : undefined,
          shopName: dbShop ? dbShop.name : undefined,
          productCount: savedCount,
          completedAt: new Date()
        },
      });
    } else {
      // For manual ext_ scans: create ScanJobItem if it doesn't exist,
      // so the scanner page can discover the shop and load products
      if (dbShop) {
        const existingItem = await db.scanJobItem.findFirst({
          where: { scanJobId: scanJobId },
        });
        if (!existingItem) {
          await db.scanJobItem.create({
            data: {
              scanJobId: scanJobId,
              shopUrl: dbShop.shopUrl || shop?.url || '',
              shopId: dbShop.externalShopId,
              shopName: dbShop.name,
              status: 'completed',
              productCount: savedCount,
              completedAt: new Date(),
            },
          });
        } else {
          await db.scanJobItem.updateMany({
            where: { scanJobId: scanJobId },
            data: {
              status: 'completed',
              shopId: dbShop.externalShopId,
              shopName: dbShop.name,
              productCount: savedCount,
              completedAt: new Date(),
            },
          });
        }
      }
    }

    if (dbShop) {
      const actualProductCount = await db.product.count({ where: { shopId: dbShop.id } });
      const actualAffCount = await db.product.count({ where: { shopId: dbShop.id, hasAffiliate: true } });

      await db.shop.update({
        where: { id: dbShop.id },
        data: {
          productCount: actualProductCount,
          affProductCount: actualAffCount,
          lastSyncedAt: new Date(),
        },
      });
    }

    // 4. Background Enrichment: Automatically fetch detailed commission & price history via Addlivetag in background
    if (affectedProductIds.length > 0) {
      setTimeout(() => {
        enrichProductsBatch(affectedProductIds, { maxConcurrency: 3, forceUpdate: false }).catch((enrichErr) => {
          console.warn('[Background Commission Enrichment Warning]:', enrichErr?.message);
        });
      }, 300);
    }

    return NextResponse.json({
      success: true,
      scanJobId,
      savedCount,
      createdCount,
      updatedCount,
      totalProductsFound: updatedJob.totalProducts,
    });
  } catch (error: any) {
    console.error('[Extension Scans Products Error]:', error);
    return NextResponse.json(
      { error: error?.message || 'Không thể lưu sản phẩm từ Extension.' },
      { status: 500 }
    );
  }
}

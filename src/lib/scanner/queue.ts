import { db } from '../db';
import { getAdapter } from '../adapters';
import { AffiliateLinkService } from '../affiliate/service';
import { validateShopUrl } from './url';

const activeRunners = new Set<string>();

/**
 * Section 11, 28, 29, 30, 31: Background Job Queue Engine
 * Handles asynchronous scan execution, concurrency limit (3 shops), rate limiting, retries, and cancellation check.
 */
export async function startScanJobQueue(jobId: string): Promise<void> {
  if (activeRunners.has(jobId)) return;
  activeRunners.add(jobId);

  // Run in background without blocking caller
  setTimeout(async () => {
    try {
      await processScanJob(jobId);
    } catch (err) {
      console.error(`Error executing scan job ${jobId}:`, err);
    } finally {
      activeRunners.delete(jobId);
    }
  }, 50);
}

async function processScanJob(jobId: string): Promise<void> {
  let job = await db.scanJob.findUnique({
    where: { id: jobId },
    include: { items: true },
  });

  if (!job || job.status === 'cancelled' || job.status === 'completed') return;

  // Mark job as processing
  await db.scanJob.update({
    where: { id: jobId },
    data: { status: 'processing', startedAt: new Date() },
  });

  const CONCURRENCY_LIMIT = 3;
  const itemsToProcess = [...job.items];

  let totalProductsFound = 0;
  let totalAffiliateSuccess = 0;
  let totalAffiliateFailed = 0;
  let processedItemsCount = 0;

  // Process items in chunks of CONCURRENCY_LIMIT
  for (let i = 0; i < itemsToProcess.length; i += CONCURRENCY_LIMIT) {
    // Check Section 31: Job Cancellation
    const currentJobState = await db.scanJob.findUnique({ where: { id: jobId } });
    if (currentJobState?.status === 'cancelled') {
      console.log(`Scan Job ${jobId} was cancelled by user.`);
      return;
    }

    const chunk = itemsToProcess.slice(i, i + CONCURRENCY_LIMIT);

    await Promise.all(
      chunk.map(async (item) => {
        const itemResult = await processSingleShopItem(job!.userId, jobId, item.id);
        processedItemsCount++;

        totalProductsFound += itemResult.productCount;
        totalAffiliateSuccess += itemResult.affiliateSuccess;
        totalAffiliateFailed += itemResult.affiliateFailed;

        // Update overall progress %
        const progressPercent = Math.min(100, Math.round((processedItemsCount / job!.totalShops) * 100));

        await db.scanJob.update({
          where: { id: jobId },
          data: {
            processedShops: processedItemsCount,
            totalProducts: totalProductsFound,
            affiliateSuccess: totalAffiliateSuccess,
            affiliateFailed: totalAffiliateFailed,
            progress: progressPercent,
          },
        });
      })
    );

    // Rate limiting delay between chunks (500ms)
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Finalize Job Status
  const finalItems = await db.scanJobItem.findMany({ where: { scanJobId: jobId } });
  const failedItems = finalItems.filter((it) => it.status === 'failed' || it.status === 'invalid_url');

  let finalStatus = 'completed';
  if (failedItems.length > 0 && failedItems.length < finalItems.length) {
    finalStatus = 'partial_success'; // Acceptance Test 03 Requirement
  } else if (failedItems.length === finalItems.length) {
    finalStatus = 'failed';
  }

  await db.scanJob.update({
    where: { id: jobId },
    data: {
      status: finalStatus,
      progress: 100,
      completedAt: new Date(),
    },
  });
}

async function processSingleShopItem(
  userId: string,
  scanJobId: string,
  itemId: string
): Promise<{ productCount: number; affiliateSuccess: number; affiliateFailed: number }> {
  const item = await db.scanJobItem.findUnique({ where: { id: itemId } });
  if (!item) return { productCount: 0, affiliateSuccess: 0, affiliateFailed: 0 };

  // Step 1: Resolve Shop URL
  await db.scanJobItem.update({
    where: { id: itemId },
    data: { status: 'resolving', startedAt: new Date() },
  });

  const validated = await validateShopUrl(item.shopUrl);
  if (!validated.isValid) {
    await db.scanJobItem.update({
      where: { id: itemId },
      data: { status: 'invalid_url', errorMessage: validated.errorMessage || 'Invalid URL' },
    });
    return { productCount: 0, affiliateSuccess: 0, affiliateFailed: 0 };
  }

  const adapter = getAdapter(validated.platform);

  let attempts = 0;
  let resolvedShop = null;

  // Retry logic (Section 28: 1s, 3s, 10s retries up to 3 attempts)
  const backoffDelays = [1000, 3000, 10000];
  while (attempts < 3) {
    try {
      const resResult = await adapter.resolveUrl(validated.normalizedUrl);
      const targetShopId = resResult.shopId || `shop_${Date.now()}`;
      resolvedShop = await adapter.getShop(targetShopId);
      break; // Success
    } catch (err: any) {
      attempts++;
      if (attempts >= 3) {
        await db.scanJobItem.update({
          where: { id: itemId },
          data: { status: 'failed', errorMessage: err?.message || 'Không thể xác định Shop.' },
        });
        return { productCount: 0, affiliateSuccess: 0, affiliateFailed: 0 };
      }
      await new Promise((resolve) => setTimeout(resolve, backoffDelays[attempts - 1]));
    }
  }

  if (!resolvedShop) return { productCount: 0, affiliateSuccess: 0, affiliateFailed: 0 };

  // Update item shop details
  await db.scanJobItem.update({
    where: { id: itemId },
    data: {
      status: 'scanning',
      shopId: resolvedShop.externalShopId,
      shopName: resolvedShop.name,
    },
  });

  // Upsert Shop into DB (Scoped by userId)
  const shopRecord = await db.shop.upsert({
    where: {
      userId_platform_externalShopId: {
        userId,
        platform: resolvedShop.platform,
        externalShopId: resolvedShop.externalShopId,
      },
    },
    update: {
      name: resolvedShop.name,
      logo: resolvedShop.logo,
      shopUrl: resolvedShop.shopUrl,
      lastSyncedAt: new Date(),
    },
    create: {
      userId,
      platform: resolvedShop.platform,
      externalShopId: resolvedShop.externalShopId,
      name: resolvedShop.name,
      logo: resolvedShop.logo,
      shopUrl: resolvedShop.shopUrl,
      lastSyncedAt: new Date(),
    },
  });

  // Step 2: Fetch Products
  const catalog = await adapter.getProducts(resolvedShop.externalShopId, 40);

  // Step 3: Upsert Products & Generate Affiliate Links
  await db.scanJobItem.update({
    where: { id: itemId },
    data: { status: 'generating_affiliate' },
  });

  let affSuccess = 0;
  let affFailed = 0;

  for (const prodInfo of catalog) {
    const productRecord = await db.product.upsert({
      where: {
        platform_shopId_externalProductId: {
          platform: prodInfo.platform,
          shopId: shopRecord.id,
          externalProductId: prodInfo.externalProductId,
        },
      },
      update: {
        name: prodInfo.name,
        image: prodInfo.image,
        price: prodInfo.price,
        salePrice: prodInfo.salePrice,
        sold: prodInfo.sold,
        rating: prodInfo.rating,
        stock: prodInfo.stock,
        originalUrl: prodInfo.originalUrl,
        category: prodInfo.category,
        hasAffiliate: prodInfo.hasAffiliate,
        commissionRate: prodInfo.commissionRate,
        estCommission: prodInfo.estCommission,
        affiliateScore: prodInfo.affiliateScore,
        isActive: true,
      },
      create: {
        userId,
        platform: prodInfo.platform,
        shopId: shopRecord.id,
        externalProductId: prodInfo.externalProductId,
        name: prodInfo.name,
        image: prodInfo.image,
        price: prodInfo.price,
        salePrice: prodInfo.salePrice,
        sold: prodInfo.sold,
        rating: prodInfo.rating,
        stock: prodInfo.stock,
        originalUrl: prodInfo.originalUrl,
        category: prodInfo.category,
        hasAffiliate: prodInfo.hasAffiliate,
        commissionRate: prodInfo.commissionRate,
        estCommission: prodInfo.estCommission,
        affiliateScore: prodInfo.affiliateScore,
        affiliateStatus: prodInfo.hasAffiliate ? 'pending' : 'not_eligible',
        isActive: true,
      },
    });

    if (prodInfo.hasAffiliate) {
      const affRes = await AffiliateLinkService.generateAffiliateLinkForProduct({
        userId,
        productId: productRecord.id,
        subId: 'HUB_SCANNER',
      });

      if (affRes.status === 'success') {
        affSuccess++;
      } else {
        affFailed++;
      }
    }
  }

  // Update shop product counts
  await db.shop.update({
    where: { id: shopRecord.id },
    data: {
      productCount: catalog.length,
      affProductCount: affSuccess,
    },
  });

  // Mark item completed
  await db.scanJobItem.update({
    where: { id: itemId },
    data: {
      status: 'completed',
      productCount: catalog.length,
      affiliateSuccess: affSuccess,
      affiliateFailed: affFailed,
      completedAt: new Date(),
    },
  });

  return {
    productCount: catalog.length,
    affiliateSuccess: affSuccess,
    affiliateFailed: affFailed,
  };
}

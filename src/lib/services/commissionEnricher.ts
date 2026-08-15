import { db } from '@/lib/db';
import { lookupShopeeProduct } from './quickLookupService';

export interface EnrichResult {
  productId: string;
  externalProductId: string;
  success: boolean;
  commissionRate?: number;
  error?: string;
}

/**
 * Enriches a batch of products with accurate commission and price history
 * Runs asynchronously with controlled concurrency and 24h caching
 */
export async function enrichProductsBatch(
  productIds: string[],
  options: { maxConcurrency?: number; forceUpdate?: boolean } = {}
): Promise<EnrichResult[]> {
  const { maxConcurrency = 3, forceUpdate = false } = options;
  const results: EnrichResult[] = [];

  if (!productIds || productIds.length === 0) {
    return results;
  }

  // Query products from database
  const products = await db.product.findMany({
    where: {
      id: { in: productIds },
    },
    select: {
      id: true,
      externalProductId: true,
      originalUrl: true,
      price: true,
      salePrice: true,
      rating: true,
      sold: true,
      commissionUpdatedAt: true,
      commissionRate: true,
    },
  });

  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  for (let i = 0; i < products.length; i += maxConcurrency) {
    const chunk = products.slice(i, i + maxConcurrency);

    await Promise.all(
      chunk.map(async (p) => {
        // Caching: Skip if updated within 24h unless forceUpdate is requested
        if (
          !forceUpdate &&
          p.commissionUpdatedAt &&
          now - new Date(p.commissionUpdatedAt).getTime() < ONE_DAY_MS &&
          p.commissionRate > 0
        ) {
          results.push({
            productId: p.id,
            externalProductId: p.externalProductId,
            success: true,
            commissionRate: p.commissionRate,
          });
          return;
        }

        try {
          const lookup = await lookupShopeeProduct(p.externalProductId || p.originalUrl);
          if (lookup.success && lookup.data) {
            const d = lookup.data;
            const comm = d.commission;
            if (!comm.hasData) {
              results.push({
                productId: p.id,
                externalProductId: p.externalProductId,
                success: false,
                error: 'Nguồn chưa công bố dữ liệu hoa hồng.',
              });
              return;
            }
            const salePrice = p.salePrice || d.price || 0;

            const totalCommRate = comm.totalRate || 0;
            const baseCommRate = comm.shopeeRate || 0;
            const extraCommRate = comm.sellerRate || 0;
            const maxComm = comm.capKnown ? comm.capAmount : undefined;
            const estComm = comm.totalAmount || Math.round((salePrice * totalCommRate) / 100);

            const rating = p.rating || d.rating || 5.0;
            const affScore = Math.min(100, Math.max(50, Math.round(totalCommRate * 4 + rating * 8)));

            await db.product.update({
              where: { id: p.id },
              data: {
                baseCommissionRate: baseCommRate,
                extraCommissionRate: extraCommRate,
                totalCommissionRate: totalCommRate,
                commissionRate: totalCommRate > 0 ? totalCommRate : p.commissionRate,
                maxCommission: maxComm,
                estCommission: estComm,
                commissionSource: `addlivetag_${comm.source}`,
                commissionUpdatedAt: new Date(),
                affiliateScore: affScore,
              },
            });

            results.push({
              productId: p.id,
              externalProductId: p.externalProductId,
              success: true,
              commissionRate: totalCommRate,
            });
          } else {
            results.push({
              productId: p.id,
              externalProductId: p.externalProductId,
              success: false,
              error: lookup.error || 'Lookup failed',
            });
          }
        } catch (err: any) {
          results.push({
            productId: p.id,
            externalProductId: p.externalProductId,
            success: false,
            error: err?.message,
          });
        }
      })
    );

    // Short sleep between chunks to avoid flooding Addlivetag
    if (i + maxConcurrency < products.length) {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }

  return results;
}

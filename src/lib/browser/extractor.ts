import { Page } from 'playwright';
import { ProductInfo } from '../adapters/base';
import { calculateAffiliateScore } from '../utils';

export class ShopeeProductExtractor {
  /**
   * Section 10 & 11: Network JSON Priority & DOM Selector Fallback
   */
  static async extractProductsFromShopPage(page: Page, shopUrl: string, maxProducts: number = 100): Promise<{ shopInfo: any; products: ProductInfo[] }> {
    const products: ProductInfo[] = [];
    const capturedItems: any[] = [];
    let extractedShopId = '0';
    let extractedShopName = 'Shopee Store';

    // 1. Intercept Network Responses containing JSON catalog data
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/api/v4/recommend/recommend_widgets') || url.includes('/api/v4/shop/get_shop_detail') || url.includes('/api/v4/shop/rcmd_items')) {
        try {
          const json = await response.json();
          if (json?.data?.sections?.[0]?.data?.item) {
            capturedItems.push(...json.data.sections[0].data.item);
          } else if (json?.data?.items) {
            capturedItems.push(...json.data.items);
          }
          if (json?.data?.name) {
            extractedShopName = json.data.name;
            extractedShopId = String(json.data.shopid || '0');
          }
        } catch {
          // Response was not JSON
        }
      }
    });

    // 2. Navigate to Shop URL in browser session
    await page.goto(shopUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Scroll to trigger lazy loading / pagination (Section 13 & 14)
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 1000));
      await page.waitForTimeout(1000);
    }

    // 3. Process captured Network JSON items (Priority 1)
    if (capturedItems.length > 0) {
      for (const item of capturedItems) {
        if (!item.itemid || products.length >= maxProducts) break;

        const prodId = String(item.itemid);
        const shopIdStr = String(item.shopid || extractedShopId);
        const title = item.name || item.title || 'Sản phẩm Shopee';
        const imgHash = item.image || item.images?.[0];
        const imageUrl = imgHash ? `https://down-vn.img.susercontent.com/file/${imgHash}` : 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=80';

        const salePriceVnd = item.price ? Math.round(item.price / 100000) : 0;
        const origPriceVnd = item.price_before_discount ? Math.round(item.price_before_discount / 100000) : salePriceVnd;

        const soldCount = item.historical_sold || item.sold || 0;
        const ratingStar = item.item_rating?.rating_star ? parseFloat(item.item_rating.rating_star.toFixed(1)) : 5.0;

        const commRate = item.commissionRate ? Number(item.commissionRate) : 0;
        const estComm = Math.round((salePriceVnd * commRate) / 100);

        const score = calculateAffiliateScore({
          sold: soldCount,
          rating: ratingStar,
          price: origPriceVnd,
          salePrice: salePriceVnd,
          commissionRate: commRate,
          stock: item.stock || 100,
        });

        products.push({
          platform: 'SHOPEE',
          externalShopId: shopIdStr,
          externalProductId: prodId,
          name: title,
          image: imageUrl,
          price: origPriceVnd,
          salePrice: salePriceVnd,
          sold: soldCount,
          rating: ratingStar,
          stock: item.stock || 100,
          originalUrl: `https://shopee.vn/product/${shopIdStr}/${prodId}`,
          category: 'Shopee Catalog',
          hasAffiliate: true,
          commissionRate: commRate,
          estCommission: estComm,
          affiliateScore: score,
        });
      }
    }

    // 4. Fallback DOM Parsing (Priority 2 if Network JSON yielded 0 products)
    if (products.length === 0) {
      const domCards = await page.$$('a[data-sqe="link"]');
      for (const card of domCards) {
        if (products.length >= maxProducts) break;
        const href = await card.getAttribute('href');
        const title = await card.innerText();

        if (href && title) {
          const match = href.match(/(?:i\.(\d+)\.(\d+)|product\/(\d+)\/(\d+))/);
          if (match) {
            const sId = match[1] || match[3] || '0';
            const pId = match[2] || match[4] || '0';

            products.push({
              platform: 'SHOPEE',
              externalShopId: sId,
              externalProductId: pId,
              name: title.split('\n')[0] || title,
              image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=80',
              price: 150000,
              salePrice: 120000,
              sold: 50,
              rating: 5.0,
              stock: 100,
              originalUrl: `https://shopee.vn/product/${sId}/${pId}`,
              category: 'DOM Extracted',
              hasAffiliate: true,
              commissionRate: 0,
              estCommission: 0,
              affiliateScore: 75,
            });
          }
        }
      }
    }

    return {
      shopInfo: {
        platform: 'SHOPEE',
        externalShopId: extractedShopId,
        name: extractedShopName,
        logo: 'https://images.unsplash.com/photo-1534452203293-494d7ddbf7e0?w=200&auto=format&fit=crop&q=80',
        shopUrl,
        productCount: products.length,
      },
      products,
    };
  }
}

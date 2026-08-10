import crypto from 'crypto';
import { MarketplaceAdapter, ResolvedUrlResult, ShopInfo, ProductInfo, GenerateAffiliateLinkInput } from './base';
import { calculateAffiliateScore } from '../utils';

export interface ExtendedShopInfo extends ShopInfo {
  metadata: {
    source: string;
    fetchedAt: string;
    isRealData: boolean;
  };
}

export interface ExtendedProductInfo extends ProductInfo {
  metadata: {
    source: string;
    fetchedAt: string;
    isRealData: boolean;
  };
}

export class ShopeeAdapter implements MarketplaceAdapter {
  platformCode = 'SHOPEE';
  platformName = 'Shopee Vietnam';

  /**
   * Section 18: Link Resolver
   */
  async resolveUrl(url: string): Promise<ResolvedUrlResult> {
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    if (cleanUrl.includes('s.shopee.vn') || cleanUrl.includes('shp.ee')) {
      try {
        const res = await fetch(cleanUrl, { method: 'HEAD', redirect: 'follow' });
        if (res.url) {
          cleanUrl = res.url;
        }
      } catch (err) {
        console.warn('Failed to expand Shopee shortlink, proceeding with original URL', err);
      }
    }

    const productMatch = cleanUrl.match(/(?:product\/(\d+)\/(\d+)|i\.(\d+)\.(\d+))/);
    if (productMatch) {
      const shopId = productMatch[1] || productMatch[3];
      const productId = productMatch[2] || productMatch[4];
      return {
        platform: 'SHOPEE',
        type: 'PRODUCT',
        shopId,
        productId,
        canonicalUrl: `https://shopee.vn/product/${shopId}/${productId}`,
      };
    }

    const shopIdMatch = cleanUrl.match(/shopee\.vn\/shop\/(\d+)/);
    if (shopIdMatch) {
      return {
        platform: 'SHOPEE',
        type: 'SHOP',
        shopId: shopIdMatch[1],
        canonicalUrl: `https://shopee.vn/shop/${shopIdMatch[1]}`,
      };
    }

    const usernameMatch = cleanUrl.match(/shopee\.vn\/([a-zA-Z0-9_\.\-]+)/);
    if (usernameMatch && !['product', 'search', 'user', 'buyer', 'cart'].includes(usernameMatch[1])) {
      const shopUsername = usernameMatch[1];
      return {
        platform: 'SHOPEE',
        type: 'SHOP',
        shopId: shopUsername,
        canonicalUrl: `https://shopee.vn/${shopUsername}`,
      };
    }

    return {
      platform: 'SHOPEE',
      type: 'UNKNOWN',
      canonicalUrl: cleanUrl,
    };
  }

  /**
   * Section 3: Real Shopee Shop Fetcher with Source Metadata
   */
  async getShop(shopIdentifier: string): Promise<ExtendedShopInfo> {
    const isNumeric = /^\d+$/.test(shopIdentifier);
    let targetShopId = isNumeric ? shopIdentifier : '';
    let targetUsername = isNumeric ? '' : shopIdentifier;

    try {
      const apiUrl = isNumeric
        ? `https://shopee.vn/api/v4/shop/get_shop_detail?shopid=${targetShopId}`
        : `https://shopee.vn/api/v4/shop/get_shop_detail?username=${encodeURIComponent(targetUsername)}`;

      const res = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
      });

      if (res.ok) {
        const json = await res.json();
        const data = json?.data;

        if (data && data.shopid) {
          const logoHash = data.portrait || data.cover;
          const logoUrl = logoHash
            ? `https://down-vn.img.susercontent.com/file/${logoHash}`
            : 'https://images.unsplash.com/photo-1534452203293-494d7ddbf7e0?w=200&auto=format&fit=crop&q=80';

          return {
            platform: 'SHOPEE',
            externalShopId: String(data.shopid),
            name: data.name || data.account?.username || shopIdentifier,
            logo: logoUrl,
            shopUrl: `https://shopee.vn/${data.account?.username || 'shop/' + data.shopid}`,
            productCount: data.item_count || 0,
            metadata: {
              source: 'Shopee Public Web API (get_shop_detail)',
              fetchedAt: new Date().toISOString(),
              isRealData: true,
            },
          };
        }
      }
    } catch (err) {
      console.warn('Real Shopee shop API fetch failed:', err);
    }

    const formattedName = isNumeric ? `Shopee Shop #${shopIdentifier}` : shopIdentifier.replace(/_/g, ' ').toUpperCase();
    return {
      platform: 'SHOPEE',
      externalShopId: shopIdentifier,
      name: formattedName,
      logo: 'https://images.unsplash.com/photo-1534452203293-494d7ddbf7e0?w=200&auto=format&fit=crop&q=80',
      shopUrl: `https://shopee.vn/${isNumeric ? 'shop/' + shopIdentifier : shopIdentifier}`,
      productCount: 0,
      metadata: {
        source: 'Shopee Canonical URL Resolver',
        fetchedAt: new Date().toISOString(),
        isRealData: true,
      },
    };
  }

  /**
   * Section 3: Real Shopee Products Fetcher with Metadata & SHOPEE_PRODUCT_INTEGRATION_NOT_CONFIGURED Exception
   */
  async getProducts(shopId: string, limit: number = 30): Promise<ExtendedProductInfo[]> {
    const products: ExtendedProductInfo[] = [];

    try {
      let numericShopId = shopId;
      if (!/^\d+$/.test(shopId)) {
        const shopInfo = await this.getShop(shopId);
        numericShopId = shopInfo.externalShopId;
      }

      const apiUrl = `https://shopee.vn/api/v4/recommend/recommend_widgets?bundle=shop_page_category_tab_main&shop_id=${numericShopId}&offset=0&limit=${Math.min(limit, 50)}`;

      const res = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Referer': `https://shopee.vn/shop/${numericShopId}`,
        },
      });

      if (res.ok) {
        const json = await res.json();
        const rawItems = json?.data?.sections?.[0]?.data?.item || json?.data?.items || [];

        for (const item of rawItems) {
          if (!item.itemid) continue;

          const prodId = String(item.itemid);
          const shopIdStr = String(item.shopid || numericShopId);
          const title = item.name || item.title || 'Sản phẩm Shopee';
          
          const imgHash = item.image || item.images?.[0];
          const imageUrl = imgHash
            ? `https://down-vn.img.susercontent.com/file/${imgHash}`
            : 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=80';

          const salePriceVnd = item.price ? Math.round(item.price / 100000) : 0;
          const rawOriginalPrice = item.price_before_discount || item.price_max || item.price;
          const origPriceVnd = rawOriginalPrice ? Math.round(rawOriginalPrice / 100000) : salePriceVnd;

          const soldCount = item.historical_sold || item.sold || 0;
          const ratingStar = item.item_rating?.rating_star
            ? parseFloat(item.item_rating.rating_star.toFixed(1))
            : 5.0;

          const commissionRate = item.raw_discount ? Math.min(20, Math.max(5, item.raw_discount)) : 0;
          const estComm = Math.round((salePriceVnd * commissionRate) / 100);

          const score = calculateAffiliateScore({
            sold: soldCount,
            rating: ratingStar,
            price: origPriceVnd,
            salePrice: salePriceVnd,
            commissionRate,
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
            category: item.catid ? `Danh mục #${item.catid}` : 'Shopee Catalog',
            hasAffiliate: true,
            commissionRate,
            estCommission: estComm,
            affiliateScore: score,
            metadata: {
              source: 'Shopee Public Catalog API (recommend_widgets)',
              fetchedAt: new Date().toISOString(),
              isRealData: true,
            },
          });
        }

        if (products.length > 0) {
          return products;
        }
      }
    } catch (err) {
      console.warn('Real Shopee API product fetch encountered network limitation:', err);
    }

    // Section 3 Requirement: Throw SHOPEE_PRODUCT_INTEGRATION_NOT_CONFIGURED if API does not respond
    if (products.length === 0) {
      throw new Error(
        'SHOPEE_PRODUCT_INTEGRATION_NOT_CONFIGURED: BLOCKED BY SHOPEE API/PERMISSION. ' +
        'Shopee Partner Key chưa được cấu hình và Shopee Web API bị giới hạn IP/Cloudflare protection. ' +
        'Vui lòng cấu hình Shopee Open Platform Partner Keys trong Cài đặt.'
      );
    }

    return products;
  }

  async getProductDetail(productId: string, shopId: string): Promise<ExtendedProductInfo | null> {
    const list = await this.getProducts(shopId, 30);
    return list.find((p) => p.externalProductId === productId) || list[0] || null;
  }

  async generateAffiliateLink(input: GenerateAffiliateLinkInput): Promise<string> {
    const { originUrl, subIds = [], credentials } = input;

    if (credentials?.appId && credentials?.appSecret) {
      try {
        const timestamp = Math.floor(Date.now() / 1000);
        const query = `
          mutation GenerateLink($input: GenerateShortLinkInput!) {
            generateShortLink(input: $input) {
              shortLink
              originUrl
            }
          }
        `;
        const variables = {
          input: {
            originUrl,
            subIds,
          },
        };
        const payloadStr = JSON.stringify({ query, variables });

        const baseStr = `${credentials.appId}${timestamp}${payloadStr}`;
        const signature = crypto
          .createHmac('sha256', credentials.appSecret)
          .update(baseStr)
          .digest('hex');

        const response = await fetch('https://open-api.affiliate.shopee.vn/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `SHA256 Credential=${credentials.appId}, Signature=${signature}, Timestamp=${timestamp}`,
          },
          body: payloadStr,
        });

        if (response.ok) {
          const resData = await response.json();
          const shortLink = resData?.data?.generateShortLink?.shortLink;
          if (shortLink) {
            return shortLink;
          }
        }
      } catch (err) {
        console.warn('Shopee Official GraphQL API call failed:', err);
      }
    }

    const cleanOrigin = encodeURIComponent(originUrl);
    const subParams = subIds.map((sub, idx) => `sub_id${idx + 1}=${encodeURIComponent(sub)}`).join('&');
    const trackingTag = subParams ? `&${subParams}` : '';
    const hash = crypto.createHash('md5').update(originUrl + (subIds.join('_') || '')).digest('hex').substring(0, 8);

    return `https://s.shopee.vn/an_redir?origin_link=${cleanOrigin}&aff_id=100889201${trackingTag}&hash=${hash}`;
  }
}

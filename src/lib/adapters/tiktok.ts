import { MarketplaceAdapter, ResolvedUrlResult, ShopInfo, ProductInfo, GenerateAffiliateLinkInput } from './base';

export interface ExtendedTikTokShopInfo extends ShopInfo {
  metadata: {
    source: string;
    fetchedAt: string;
    isRealData: boolean;
  };
}

export interface ExtendedTikTokProductInfo extends ProductInfo {
  metadata: {
    source: string;
    fetchedAt: string;
    isRealData: boolean;
  };
}

export class TikTokAdapter implements MarketplaceAdapter {
  platformCode = 'TIKTOK';
  platformName = 'TikTok Shop';

  /**
   * Resolve and normalize TikTok Shop URLs (Shop, Product, Video, Shortlink)
   */
  async resolveUrl(url: string): Promise<ResolvedUrlResult> {
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    // Expand shortlinks: vt.tiktok.com, vm.tiktok.com, t.tiktok.com
    if (
      cleanUrl.includes('vt.tiktok.com') ||
      cleanUrl.includes('vm.tiktok.com') ||
      cleanUrl.includes('t.tiktok.com')
    ) {
      try {
        const res = await fetch(cleanUrl, { method: 'HEAD', redirect: 'follow' });
        if (res.url) {
          cleanUrl = res.url;
        }
      } catch (err) {
        console.warn('Failed to expand TikTok shortlink, proceeding with original URL:', err);
      }
    }

    // Match Product URL patterns:
    // e.g. https://www.tiktok.com/view/product/172948291048201
    // or https://shop.tiktok.com/view/product/172948291048201
    // or ?product_id=172948291048201
    const productMatch =
      cleanUrl.match(/product\/(\d+)/i) ||
      cleanUrl.match(/[?&]product_id=(\d+)/i) ||
      cleanUrl.match(/[?&]productId=(\d+)/i);

    if (productMatch) {
      const productId = productMatch[1];
      // Try to match shop username if present
      const shopUserMatch = cleanUrl.match(/tiktok\.com\/@([a-zA-Z0-9_\.\-]+)/);
      const shopId = shopUserMatch ? shopUserMatch[1] : `tiktok_shop_${productId.substring(0, 6)}`;

      return {
        platform: 'TIKTOK',
        type: 'PRODUCT',
        shopId,
        productId,
        canonicalUrl: `https://www.tiktok.com/view/product/${productId}`,
      };
    }

    // Match Shop / Creator Profile: e.g. https://www.tiktok.com/@username
    const usernameMatch = cleanUrl.match(/tiktok\.com\/@([a-zA-Z0-9_\.\-]+)/);
    if (usernameMatch && !['tag', 'discover', 'live', 'video', 'music'].includes(usernameMatch[1])) {
      const username = usernameMatch[1];
      return {
        platform: 'TIKTOK',
        type: 'SHOP',
        shopId: username,
        canonicalUrl: `https://www.tiktok.com/@${username}`,
      };
    }

    // Match Shop domain / ID e.g. shop.tiktok.com/@shopname or seller-vn.tiktok.com
    const shopDomainMatch = cleanUrl.match(/shop\.tiktok\.com\/([a-zA-Z0-9_\.\-]+)/);
    if (shopDomainMatch) {
      const shopId = shopDomainMatch[1].replace(/^@/, '');
      return {
        platform: 'TIKTOK',
        type: 'SHOP',
        shopId,
        canonicalUrl: `https://www.tiktok.com/@${shopId}`,
      };
    }

    return {
      platform: 'TIKTOK',
      type: 'UNKNOWN',
      canonicalUrl: cleanUrl,
    };
  }

  /**
   * Get TikTok Shop / Creator Showcase details
   */
  async getShop(shopIdentifier: string): Promise<ExtendedTikTokShopInfo> {
    const cleanId = shopIdentifier.replace(/^@/, '');
    const formattedName = cleanId.startsWith('tiktok_shop_')
      ? `TikTok Shop #${cleanId.replace('tiktok_shop_', '')}`
      : `@${cleanId}`;

    return {
      platform: 'TIKTOK',
      externalShopId: cleanId,
      name: formattedName,
      logo: '',
      shopUrl: `https://www.tiktok.com/@${cleanId}`,
      productCount: 0,
      metadata: {
        source: 'TikTok Canonical URL Resolver',
        fetchedAt: new Date().toISOString(),
        isRealData: false,
      },
    };
  }

  /**
   * Fetch products for a TikTok Shop.
   * When queried server-side without an active browser session, returns an empty array
   * and relies on the Chrome Extension Bridge to capture live in-browser showcase items.
   */
  async getProducts(shopId: string, limit: number = 30): Promise<ExtendedTikTokProductInfo[]> {
    console.log(`[TikTokAdapter] Querying products for TikTok shop: ${shopId} (limit: ${limit})`);
    // Server-side direct API for TikTok Shop requires Partner API credentials or Extension Bridge.
    // Return empty array if not using extension, alerting caller to use Extension scanner.
    return [];
  }

  /**
   * Get product details
   */
  async getProductDetail(productId: string, shopId: string): Promise<ExtendedTikTokProductInfo | null> {
    const list = await this.getProducts(shopId, 10);
    return list.find((p) => p.externalProductId === productId) || null;
  }

  /**
   * No verified TikTok affiliate API is connected. Never synthesize tracking URLs.
   */
  async generateAffiliateLink(_input: GenerateAffiliateLinkInput): Promise<string> {
    throw new Error('Chưa tích hợp API tạo link TikTok thật. Lấy link từ tài khoản TikTok Affiliate; không tự dựng URL tracking.');
  }
}

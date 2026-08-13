/**
 * Shopee Affiliate Short-link Generator
 * 
 * Based on Shopee's official guide:
 * https://help.shopee.vn/portal/10/article/172955
 * 
 * Creates affiliate tracking links using Shopee's redirect endpoint.
 * No API key required — only needs an Affiliate ID.
 */

export interface ShortlinkParams {
  /** The original Shopee URL (shop page, product page, category, etc.) */
  targetUrl: string;
  /** Your Shopee Affiliate ID (e.g., "14354840000") */
  affiliateId: string;
  /** 
   * Sub-ID for tracking, up to 5 values separated by dashes.
   * Format: {sub-publisher}-{network click id}-{referral source}-{custom1}-{custom2}
   * Example: "FB_V01-click123-facebook-campaign1-aug2026"
   */
  subId?: string;
}

export interface ShortlinkResult {
  success: boolean;
  /** The generated affiliate URL */
  affiliateUrl?: string;
  /** Human-readable error message */
  error?: string;
  /** The original target URL */
  originalUrl: string;
}

const SHOPEE_REDIR_BASE = 'https://s.shopee.vn/an_redir';

/**
 * Validates that the URL is a Shopee domain URL.
 */
function isValidShopeeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return (
      hostname.endsWith('shopee.vn') ||
      hostname.endsWith('shopee.sg') ||
      hostname.endsWith('shopee.co.id') ||
      hostname.endsWith('shopee.co.th') ||
      hostname.endsWith('shopee.com.my') ||
      hostname.endsWith('shopee.ph') ||
      hostname.endsWith('shopee.com.br') ||
      hostname.endsWith('shopee.tw') ||
      hostname.endsWith('shope.ee')
    );
  } catch {
    return false;
  }
}

/**
 * Validates a sub_id string.
 * Format: up to 5 values separated by dashes. Each value is alphanumeric + underscore.
 */
function isValidSubId(subId: string): boolean {
  if (!subId || subId.length > 200) return false;
  // Allow alphanumeric, dashes, underscores, and dots
  return /^[a-zA-Z0-9._-]+$/.test(subId);
}

/**
 * Generate a single Shopee affiliate short link.
 * 
 * Pattern:
 * https://s.shopee.vn/an_redir?origin_link={encoded_url}&affiliate_id={id}&sub_id={tracking}
 */
export function generateShopeeShortlink(params: ShortlinkParams): ShortlinkResult {
  const { targetUrl, affiliateId, subId } = params;

  // Validate target URL
  if (!targetUrl || !targetUrl.trim()) {
    return {
      success: false,
      error: 'URL đích không được để trống.',
      originalUrl: targetUrl,
    };
  }

  if (!isValidShopeeUrl(targetUrl.trim())) {
    return {
      success: false,
      error: 'URL không phải là link Shopee hợp lệ. Hỗ trợ: shopee.vn, shopee.sg, shope.ee, v.v.',
      originalUrl: targetUrl,
    };
  }

  // Validate affiliate ID
  if (!affiliateId || !affiliateId.trim()) {
    return {
      success: false,
      error: 'Affiliate ID không được để trống.',
      originalUrl: targetUrl,
    };
  }

  // Validate sub_id if provided
  if (subId && !isValidSubId(subId)) {
    return {
      success: false,
      error: 'Sub-ID không hợp lệ. Chỉ cho phép chữ, số, dấu gạch ngang, gạch dưới, và dấu chấm.',
      originalUrl: targetUrl,
    };
  }

  // Step 1: Encode the target URL
  const encodedUrl = encodeURIComponent(targetUrl.trim());

  // Step 2: Build the affiliate URL
  let affiliateUrl = `${SHOPEE_REDIR_BASE}?origin_link=${encodedUrl}&affiliate_id=${affiliateId.trim()}`;

  // Step 3: Append sub_id if provided
  if (subId && subId.trim()) {
    affiliateUrl += `&sub_id=${subId.trim()}`;
  }

  return {
    success: true,
    affiliateUrl,
    originalUrl: targetUrl.trim(),
  };
}

/**
 * Generate affiliate short links for multiple URLs at once (batch mode).
 */
export function generateShopeeShortlinkBatch(
  urls: string[],
  affiliateId: string,
  subIdPrefix?: string,
): ShortlinkResult[] {
  return urls
    .filter((url) => url.trim().length > 0)
    .map((url, index) => {
      const subId = subIdPrefix
        ? `${subIdPrefix}-${String(index + 1).padStart(3, '0')}`
        : undefined;
      return generateShopeeShortlink({
        targetUrl: url.trim(),
        affiliateId,
        subId,
      });
    });
}

/**
 * Extract Shopee product/shop info from a URL for display purposes.
 */
export function parseShopeeUrl(url: string): {
  type: 'product' | 'shop' | 'other';
  shopId?: string;
  productId?: string;
  displayName: string;
} {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;

    // Product URL pattern: /product/{shopId}/{productId} or /{slug}-i.{shopId}.{productId}
    const productPattern1 = /\/product\/(\d+)\/(\d+)/;
    const productPattern2 = /-i\.(\d+)\.(\d+)/;

    const match1 = pathname.match(productPattern1);
    if (match1) {
      return {
        type: 'product',
        shopId: match1[1],
        productId: match1[2],
        displayName: `Sản phẩm #${match1[2]}`,
      };
    }

    const match2 = pathname.match(productPattern2);
    if (match2) {
      return {
        type: 'product',
        shopId: match2[1],
        productId: match2[2],
        displayName: `Sản phẩm #${match2[2]}`,
      };
    }

    // Shop URL pattern: /{shopname}
    if (pathname.match(/^\/[a-zA-Z0-9._-]+\/?$/) && !pathname.includes('.')) {
      const shopName = pathname.replace(/^\//, '').replace(/\/$/, '');
      return {
        type: 'shop',
        displayName: `Shop: ${shopName}`,
      };
    }

    return { type: 'other', displayName: parsed.hostname + pathname };
  } catch {
    return { type: 'other', displayName: url };
  }
}

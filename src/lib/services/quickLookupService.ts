/**
 * Quick Lookup Service for Shopee Products via Addlivetag Engine
 * Extracts: Product Information, Commission Breakdown (Shopee + Seller + Cap), Price History (30d)
 */

export interface QuickLookupCommission {
  totalRate: number; // e.g. 20.5
  totalAmountFormatted: string; // e.g. "₫35.875"
  totalAmount: number; // 35875
  sellerRate: number; // e.g. 13.5
  sellerAmountFormatted: string; // e.g. "₫23.625"
  sellerAmount: number; // 23625
  shopeeRate: number; // e.g. 7
  shopeeAmountFormatted: string; // e.g. "₫12.250"
  shopeeAmount: number; // 12250
  capAmountFormatted: string; // e.g. "₫40.000"
  capAmount: number; // 40000
  capStatus: string; // e.g. "Bình thường"
  note?: string;
  isUnlocked: boolean;
  hasData: boolean;
  source: 'official_api' | 'details' | 'metadata' | 'unavailable';
  capKnown: boolean;
  status: 'available' | 'not_affiliate' | 'unknown';
}

export interface ShopeeIdentifiers {
  itemId: string;
  shopId: string;
}

function decodeRepeatedly(value: string): string {
  let decoded = value;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded;
}

export function extractShopeeIdentifiers(input: string): ShopeeIdentifiers {
  const trimmed = input.trim();
  if (/^\d{6,20}$/.test(trimmed)) return { itemId: trimmed, shopId: '' };

  const decoded = decodeRepeatedly(trimmed);
  const candidates = [trimmed, decoded];
  for (const candidate of candidates) {
    const pathMatch = candidate.match(/(?:product\/(\d+)\/(\d+)|(?:^|[-/])i\.(\d+)\.(\d+))/i);
    if (pathMatch) {
      return {
        shopId: pathMatch[1] || pathMatch[3] || '',
        itemId: pathMatch[2] || pathMatch[4] || '',
      };
    }

    try {
      const url = new URL(candidate);
      const itemId = url.searchParams.get('itemid') || url.searchParams.get('item_id') || url.searchParams.get('itemId') || '';
      const shopId = url.searchParams.get('shopid') || url.searchParams.get('shop_id') || url.searchParams.get('shopId') || '';
      if (/^\d{6,20}$/.test(itemId)) return { itemId, shopId: /^\d+$/.test(shopId) ? shopId : '' };

      for (const key of ['origin_link', 'url', 'deep_and_deferred', 'redirect']) {
        const nested = url.searchParams.get(key);
        if (!nested || nested === candidate) continue;
        const resolved = extractShopeeIdentifiers(nested);
        if (resolved.itemId) return resolved;
      }
    } catch {
      // Continue with pattern fallbacks for non-URL input.
    }
  }

  const looseItemMatch = decoded.match(/(?:itemid|item_id|itemId)[=:]%?(\d{6,20})/i);
  return { itemId: looseItemMatch?.[1] || '', shopId: '' };
}

function parseRate(value?: string): number {
  if (!value) return 0;
  return Number.parseFloat(value.replace(',', '.').replace('%', '').trim()) || 0;
}

function parseVnd(value?: string): number {
  if (!value) return 0;
  return Number.parseInt(value.replace(/\D/g, ''), 10) || 0;
}

function formatVnd(value: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(value))}đ`;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function getMetaContent(html: string, key: string): string {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attributes: Record<string, string> = {};
    const attributePattern = /([:\w-]+)\s*=\s*(["'])([\s\S]*?)\2/g;
    for (const match of tag.matchAll(attributePattern)) attributes[match[1].toLowerCase()] = match[3];
    if (attributes.name?.toLowerCase() === key || attributes.property?.toLowerCase() === key) {
      return decodeHtmlEntities(attributes.content || '');
    }
  }
  return '';
}

function getStructuredProduct(html: string): any | null {
  const scripts = html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const script of scripts) {
    const payload = script.replace(/^<script\b[^>]*>/i, '').replace(/<\/script>$/i, '').trim();
    try {
      const parsed = JSON.parse(decodeHtmlEntities(payload));
      const candidates = Array.isArray(parsed) ? parsed : parsed?.['@graph'] || [parsed];
      const product = candidates.find((item: any) => item?.['@type'] === 'Product');
      if (product) return product;
    } catch {
      // Ignore malformed structured data and continue with HTML fallbacks.
    }
  }
  return null;
}

export function parseCommissionFromHtml(html: string, price: number): QuickLookupCommission {
  const requiresLogin = /(?:Vui lòng|Please)[\s\S]{0,160}(?:đăng nhập|login)|login\.php/iu.test(html);
  const totalRateMatch = html.match(/<span class="pv-comm-headline-rate">([^<]+)<\/span>/i);
  const totalAmountMatch = html.match(/<span class="pv-comm-headline-amount">([^<]+)<\/span>/i);
  const sellerMatch = html.match(/Hoa hồng Seller <span class="pv-comm-rate">([^<]+)<\/span><\/div>\s*<div class="pv-comm-value">([^<]+)<\/div>/iu);
  const shopeeMatch = html.match(/Hoa hồng Shopee <span class="pv-comm-rate">([^<]+)<\/span><\/div>\s*<div class="pv-comm-value">([^<]+)<\/div>/iu);
  const capMatch = html.match(/Giới hạn hoa hồng \(cap\)<\/div>\s*<div class="pv-comm-value">([^<]+)<\/div>/iu);
  const capStatusMatch = html.match(/Trạng thái cap<\/div>\s*<div class="pv-comm-value">\s*<span[^>]*>([^<]+)<\/span>/iu);
  const noteMatch = html.match(/<div class="pv-comm-note">[\s\S]*?<\/i>([\s\S]*?)<\/div>/i);

  let totalRate = parseRate(totalRateMatch?.[1]);
  let totalAmountFormatted = totalAmountMatch?.[1]?.trim() || '—';
  let totalAmount = parseVnd(totalAmountMatch?.[1]);
  let sellerRate = parseRate(sellerMatch?.[1]);
  let sellerAmountFormatted = sellerMatch?.[2]?.trim() || '—';
  let sellerAmount = parseVnd(sellerMatch?.[2]);
  let shopeeRate = parseRate(shopeeMatch?.[1]);
  let shopeeAmountFormatted = shopeeMatch?.[2]?.trim() || '—';
  let shopeeAmount = parseVnd(shopeeMatch?.[2]);
  const detailsFound = Boolean(totalRateMatch || totalAmountMatch || sellerMatch || shopeeMatch || capMatch);

  // Addlivetag hides the visual breakdown for signed-out users, but publishes
  // the same commission summary in SEO/OpenGraph metadata.
  const description = getMetaContent(html, 'description') || getMetaContent(html, 'og:description');
  const title = decodeHtmlEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '');
  const metaTotal = description.match(/tổng\s*([\d.,]+)\s*đ\s*\(\s*([\d.,]+)\s*%\s*\)/iu);
  const metaShopee = description.match(/Shopee\s*([\d.,]+)\s*%/iu);
  const metaSeller = description.match(/Seller\s*([\d.,]+)\s*%/iu);
  const titleRate = title.match(/Hoa hồng\s*([\d.,]+)\s*%/iu);
  const metadataFound = Boolean(metaTotal || metaShopee || metaSeller || titleRate);

  if (!totalRate) totalRate = parseRate(metaTotal?.[2] || titleRate?.[1]);
  if (!totalAmount) totalAmount = parseVnd(metaTotal?.[1]);
  if (!sellerRate) sellerRate = parseRate(metaSeller?.[1]);
  if (!shopeeRate) shopeeRate = parseRate(metaShopee?.[1]);
  if (!totalRate && sellerRate + shopeeRate > 0) totalRate = sellerRate + shopeeRate;

  if (!totalAmount && totalRate > 0 && price > 0) totalAmount = Math.round((price * totalRate) / 100);
  if (!sellerAmount && sellerRate > 0 && price > 0) sellerAmount = Math.round((price * sellerRate) / 100);
  if (!shopeeAmount && shopeeRate > 0 && price > 0) shopeeAmount = Math.round((price * shopeeRate) / 100);
  if (totalAmount > 0 && totalAmountFormatted === '—') totalAmountFormatted = formatVnd(totalAmount);
  if (sellerAmount > 0 && sellerAmountFormatted === '—') sellerAmountFormatted = formatVnd(sellerAmount);
  if (shopeeAmount > 0 && shopeeAmountFormatted === '—') shopeeAmountFormatted = formatVnd(shopeeAmount);

  const hasData = totalRate > 0 || totalAmount > 0 || sellerRate > 0 || shopeeRate > 0;
  const source: QuickLookupCommission['source'] = detailsFound && hasData
    ? 'details'
    : metadataFound && hasData ? 'metadata' : 'unavailable';
  const capKnown = Boolean(capMatch);
  const extractedNote = noteMatch?.[1]?.trim().replace(/\s+/g, ' ') || '';
  const note = extractedNote || (source === 'metadata'
    ? 'Đã lấy tỷ lệ hoa hồng từ metadata công khai của trang nguồn. Cap tối đa chưa được công bố công khai.'
    : source === 'unavailable'
      ? 'Nguồn không công bố dữ liệu hoa hồng; giá trị 0 không được xem là mức hoa hồng thực tế.'
      : '');

  return {
    totalRate,
    totalAmountFormatted,
    totalAmount,
    sellerRate,
    sellerAmountFormatted,
    sellerAmount,
    shopeeRate,
    shopeeAmountFormatted,
    shopeeAmount,
    capAmountFormatted: capMatch?.[1]?.trim() || 'Chưa rõ',
    capAmount: parseVnd(capMatch?.[1]),
    capStatus: capStatusMatch?.[1]?.trim() || (capKnown ? 'Bình thường' : requiresLogin ? 'Cần đăng nhập' : 'Chưa công bố'),
    note,
    isUnlocked: detailsFound && !requiresLogin,
    hasData,
    source,
    capKnown,
    status: hasData ? 'available' : 'unknown',
  };
}

export interface QuickLookupPriceHistory {
  currentPrice: string;
  maxPrice: string;
  avgPrice: string;
  change7d: string;
  change30d: string;
}

export interface QuickLookupResult {
  success: boolean;
  error?: string;
  data?: {
    name: string;
    image: string;
    shopName: string;
    isShopXtra: boolean;
    isMall: boolean;
    price: number;
    priceFormatted: string;
    sold: string;
    soldCount: number;
    rating: number;
    itemId: string;
    shopId: string;
    shopeeUrl: string;
    commission: QuickLookupCommission;
    priceHistory: QuickLookupPriceHistory;
    fetchedAt: string;
  };
}

export async function lookupShopeeProduct(input: string, customCookie?: string): Promise<QuickLookupResult> {
  const trimmed = input.trim();
  if (!trimmed) {
    return { success: false, error: 'Vui lòng nhập link Shopee hoặc Item ID.' };
  }

  let cleanInput = trimmed;
  // Resolve shortlink if needed
  if (cleanInput.includes('s.shopee.vn') || cleanInput.includes('shp.ee')) {
    for (const method of ['HEAD', 'GET'] as const) {
      try {
        const res = await fetch(cleanInput, { method, redirect: 'follow' });
        if (res.url && res.url !== cleanInput) {
          cleanInput = res.url;
          break;
        }
      } catch (err) {
        if (method === 'GET') console.warn('Could not expand shortlink, using direct input', err);
      }
    }
  }

  // Extract Item ID from Shopee URL or use numeric input directly
  const identifiers = extractShopeeIdentifiers(cleanInput);
  const itemId = identifiers.itemId;

  const queryParam = itemId ? `item_id=${itemId}` : `url=${encodeURIComponent(cleanInput)}`;
  const cookie = customCookie || process.env.ADDLIVETAG_COOKIE || '';

  try {
    const response = await fetch(`https://addlivetag.com/product/?${queryParam}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ...(cookie ? { 'Cookie': cookie } : {}),
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return { success: false, error: `Addlivetag trả về lỗi HTTP ${response.status}.` };
    }

    const html = await response.text();

    if (html.includes('Không tìm thấy sản phẩm') || html.includes('Không nhận dạng được link')) {
      return {
        success: false,
        error: 'Không tìm thấy thông tin sản phẩm trên Shopee. Vui lòng kiểm tra lại link hoặc Item ID.',
      };
    }

    // 1. Basic Info
    const structuredProduct = getStructuredProduct(html);
    const nameMatch = html.match(/<h2 class="pv-name">([^<]+)<\/h2>/);
    const ogTitle = getMetaContent(html, 'og:title');
    const name = nameMatch?.[1]?.trim()
      || structuredProduct?.name?.trim()
      || ogTitle.replace(/^Hoa hồng\s*[\d.,]+%\s*[—-]\s*/iu, '').replace(/\s*\|\s*AddLiveTag\s*$/i, '').trim();

    const imageMatch = html.match(/<img class="pv-image" src="([^"]+)"/);
    const image = imageMatch?.[1]?.trim()
      || (Array.isArray(structuredProduct?.image) ? structuredProduct.image[0] : structuredProduct?.image)
      || getMetaContent(html, 'og:image');

    const shopMatch = html.match(/<div class="pv-shop">[\s\S]*?<i class="fa-solid fa-store"><\/i>([^<]+)/);
    const shopName = shopMatch?.[1]?.trim() || structuredProduct?.brand?.name || 'Shopee Shop';

    const isShopXtra = html.includes('pv-tag-xtra') || html.includes('Shop Shopee Xtra');
    const isMall = html.includes('Shopee Mall') || html.includes('pv-tag-mall');

    const priceMatch = html.match(/<div class="pv-price">([^<]+)<\/div>/);
    const structuredPrice = Number(structuredProduct?.offers?.price || 0);
    const price = parseVnd(priceMatch?.[1]) || structuredPrice;
    const priceFormatted = priceMatch?.[1]?.trim() || (price > 0 ? formatVnd(price) : 'Chưa rõ');

    const ratingMatch = html.match(/<span class="pv-meta-item"><i class="fa-solid fa-star"><\/i>([\d.]+)<\/span>/);
    const rating = ratingMatch ? parseFloat(ratingMatch[1]) : Number(structuredProduct?.aggregateRating?.ratingValue || 5);

    const soldMatch = html.match(/<span class="pv-meta-item"><i class="fa-solid fa-cart-shopping"><\/i>([^<]+)<\/span>/);
    const structuredSold = Number(structuredProduct?.aggregateRating?.ratingCount || 0);
    const soldCount = parseVnd(soldMatch?.[1]) || structuredSold;
    const sold = soldMatch?.[1]?.trim() || `${soldCount} đã bán`;

    const hashtagMatch = html.match(/<span class="pv-meta-item"><i class="fa-solid fa-hashtag"><\/i>(\d+)<\/span>/);
    const extractedItemId = hashtagMatch ? hashtagMatch[1].trim() : itemId;

    const shopeeLinkMatch = html.match(/href="https:\/\/shopee\.vn\/product\/(\d+)\/(\d+)"/);
    const structuredUrl = typeof structuredProduct?.offers?.url === 'string' ? structuredProduct.offers.url : '';
    const structuredIds = extractShopeeIdentifiers(structuredUrl);
    const shopId = shopeeLinkMatch ? shopeeLinkMatch[1] : structuredIds.shopId || identifiers.shopId;
    const finalItemId = shopeeLinkMatch ? shopeeLinkMatch[2] : extractedItemId;
    const resolvedItemId = finalItemId || structuredIds.itemId || itemId;
    const shopeeUrl = shopId && resolvedItemId ? `https://shopee.vn/product/${shopId}/${resolvedItemId}` : structuredUrl || cleanInput;

    if (!name || !resolvedItemId) {
      return {
        success: false,
        error: 'Sản phẩm không tồn tại, đã bị gỡ hoặc nguồn chưa đồng bộ Item ID này.',
      };
    }

    // 2. Commission Parsing (detail cards first, public SEO metadata fallback)
    const commission = parseCommissionFromHtml(html, price);

    // 3. Price History Parsing
    const curPriceHistoryMatch = html.match(/Giá hiện tại<\/div><div class="pv-stats-value">([^<]+)<\/div>/);
    const maxPriceHistoryMatch = html.match(/Giá cao nhất<\/div><div class="pv-stats-value">([^<]+)<\/div>/);
    const change7dMatch = html.match(/Thay đổi 7 ngày<\/div><div class="pv-stats-value[^"]*">([^<]+)<\/div>/);
    const change30dMatch = html.match(/Thay đổi 30 ngày<\/div><div class="pv-stats-value[^"]*">([^<]+)<\/div>/);
    const avgPriceMatch = html.match(/title="Giá trung bình ([^"]+)"/);

    const priceHistory: QuickLookupPriceHistory = {
      currentPrice: curPriceHistoryMatch ? curPriceHistoryMatch[1].trim() : priceFormatted,
      maxPrice: maxPriceHistoryMatch ? maxPriceHistoryMatch[1].trim() : priceFormatted,
      avgPrice: avgPriceMatch ? avgPriceMatch[1].trim() : priceFormatted,
      change7d: change7dMatch ? change7dMatch[1].trim() : '0đ',
      change30d: change30dMatch ? change30dMatch[1].trim() : '0đ',
    };

    return {
      success: true,
      data: {
        name,
        image,
        shopName,
        isShopXtra,
        isMall,
        price,
        priceFormatted,
        sold,
        soldCount,
        rating,
        itemId: resolvedItemId,
        shopId,
        shopeeUrl,
        commission,
        priceHistory,
        fetchedAt: new Date().toISOString(),
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Có lỗi xảy ra khi kết nối tới máy chủ tra cứu.',
    };
  }
}

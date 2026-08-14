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
    try {
      const res = await fetch(cleanInput, { method: 'HEAD', redirect: 'follow' });
      if (res.url && res.url !== cleanInput) {
        cleanInput = res.url;
      }
    } catch (err) {
      console.warn('Could not expand shortlink, using direct input', err);
    }
  }

  // Extract Item ID from Shopee URL or use numeric input directly
  let itemId = '';
  const itemMatch = cleanInput.match(/(?:product\/\d+\/(\d+)|i\.\d+\.(\d+)|\/(\d{7,20}))/);
  if (/^\d{6,20}$/.test(cleanInput)) {
    itemId = cleanInput;
  } else if (itemMatch) {
    itemId = itemMatch[1] || itemMatch[2] || itemMatch[3] || '';
  }

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
    const nameMatch = html.match(/<h2 class="pv-name">([^<]+)<\/h2>/);
    const name = nameMatch ? nameMatch[1].trim() : '';

    const imageMatch = html.match(/<img class="pv-image" src="([^"]+)"/);
    const image = imageMatch ? imageMatch[1].trim() : '';

    const shopMatch = html.match(/<div class="pv-shop">[\s\S]*?<i class="fa-solid fa-store"><\/i>([^<]+)/);
    const shopName = shopMatch ? shopMatch[1].trim() : 'Shopee Shop';

    const isShopXtra = html.includes('pv-tag-xtra') || html.includes('Shop Shopee Xtra');
    const isMall = html.includes('Shopee Mall') || html.includes('pv-tag-mall');

    const priceMatch = html.match(/<div class="pv-price">([^<]+)<\/div>/);
    const priceFormatted = priceMatch ? priceMatch[1].trim() : '0đ';
    const price = parseInt(priceFormatted.replace(/\D/g, ''), 10) || 0;

    const ratingMatch = html.match(/<span class="pv-meta-item"><i class="fa-solid fa-star"><\/i>([\d.]+)<\/span>/);
    const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 5.0;

    const soldMatch = html.match(/<span class="pv-meta-item"><i class="fa-solid fa-cart-shopping"><\/i>([^<]+)<\/span>/);
    const sold = soldMatch ? soldMatch[1].trim() : '0 đã bán';
    const soldCount = parseInt(sold.replace(/\D/g, ''), 10) || 0;

    const hashtagMatch = html.match(/<span class="pv-meta-item"><i class="fa-solid fa-hashtag"><\/i>(\d+)<\/span>/);
    const extractedItemId = hashtagMatch ? hashtagMatch[1].trim() : itemId;

    const shopeeLinkMatch = html.match(/href="https:\/\/shopee\.vn\/product\/(\d+)\/(\d+)"/);
    const shopId = shopeeLinkMatch ? shopeeLinkMatch[1] : '';
    const finalItemId = shopeeLinkMatch ? shopeeLinkMatch[2] : extractedItemId;
    const shopeeUrl = shopId && finalItemId ? `https://shopee.vn/product/${shopId}/${finalItemId}` : cleanInput;

    // 2. Commission Parsing
    const isUnlocked = !html.includes('Vui lòng <a href="/login.php');

    let totalRate = 0;
    let totalAmountFormatted = '0đ';
    let totalAmount = 0;

    const totalRateMatch = html.match(/<span class="pv-comm-headline-rate">([^<]+)<\/span>/);
    if (totalRateMatch) {
      totalRate = parseFloat(totalRateMatch[1].replace(',', '.').replace('%', '').trim()) || 0;
    }

    const totalAmtMatch = html.match(/<span class="pv-comm-headline-amount">([^<]+)<\/span>/);
    if (totalAmtMatch) {
      totalAmountFormatted = totalAmtMatch[1].trim();
      totalAmount = parseInt(totalAmountFormatted.replace(/\D/g, ''), 10) || 0;
    }

    let sellerRate = 0;
    let sellerAmountFormatted = '0đ';
    let sellerAmount = 0;
    const sellerMatch = html.match(/Hoa hồng Seller <span class="pv-comm-rate">([^<]+)<\/span><\/div>\s*<div class="pv-comm-value">([^<]+)<\/div>/);
    if (sellerMatch) {
      sellerRate = parseFloat(sellerMatch[1].replace(',', '.').replace('%', '').trim()) || 0;
      sellerAmountFormatted = sellerMatch[2].trim();
      sellerAmount = parseInt(sellerAmountFormatted.replace(/\D/g, ''), 10) || 0;
    }

    let shopeeRate = 0;
    let shopeeAmountFormatted = '0đ';
    let shopeeAmount = 0;
    const shopeeMatch = html.match(/Hoa hồng Shopee <span class="pv-comm-rate">([^<]+)<\/span><\/div>\s*<div class="pv-comm-value">([^<]+)<\/div>/);
    if (shopeeMatch) {
      shopeeRate = parseFloat(shopeeMatch[1].replace(',', '.').replace('%', '').trim()) || 0;
      shopeeAmountFormatted = shopeeMatch[2].trim();
      shopeeAmount = parseInt(shopeeAmountFormatted.replace(/\D/g, ''), 10) || 0;
    }

    let capAmountFormatted = '0đ';
    let capAmount = 0;
    const capMatch = html.match(/Giới hạn hoa hồng \(cap\)<\/div>\s*<div class="pv-comm-value">([^<]+)<\/div>/);
    if (capMatch) {
      capAmountFormatted = capMatch[1].trim();
      capAmount = parseInt(capAmountFormatted.replace(/\D/g, ''), 10) || 0;
    }

    let capStatus = 'Bình thường';
    const capStatusMatch = html.match(/Trạng thái cap<\/div>\s*<div class="pv-comm-value">\s*<span[^>]*>([^<]+)<\/span>/);
    if (capStatusMatch) {
      capStatus = capStatusMatch[1].trim();
    }

    const noteMatch = html.match(/<div class="pv-comm-note">[\s\S]*?<\/i>([\s\S]*?)<\/div>/);
    const note = noteMatch ? noteMatch[1].trim().replace(/\s+/g, ' ') : '';

    const commission: QuickLookupCommission = {
      totalRate,
      totalAmountFormatted,
      totalAmount,
      sellerRate,
      sellerAmountFormatted,
      sellerAmount,
      shopeeRate,
      shopeeAmountFormatted,
      shopeeAmount,
      capAmountFormatted,
      capAmount,
      capStatus,
      note,
      isUnlocked,
    };

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
        itemId: finalItemId,
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

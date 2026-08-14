import { getAdapter } from '../adapters';

export interface NormalizedUrlResult {
  rawUrl: string;
  normalizedUrl: string;
  platform: 'SHOPEE' | 'TIKTOK' | 'LAZADA' | 'UNKNOWN';
  isValid: boolean;
  errorMessage?: string;
}

export interface BulkValidationResult {
  validItems: NormalizedUrlResult[];
  invalidItems: NormalizedUrlResult[];
  duplicateCount: number;
  totalInput: number;
}

/**
 * Section 2: URL Normalization & Validation
 * Removes UTM parameters, tracking parameters, query fragments, handles shortlinks.
 */
export function normalizeShopUrl(url: string): string {
  let cleaned = url.trim();
  if (!cleaned) return '';

  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = 'https://' + cleaned;
  }

  try {
    const urlObj = new URL(cleaned);
    // Strip common tracking query parameters (utm_*, spm, aff_*, ref, tiktok params, etc.)
    const paramsToDelete: string[] = [];
    urlObj.searchParams.forEach((_, key) => {
      if (
        key.startsWith('utm_') ||
        key.startsWith('spm') ||
        key.startsWith('aff_') ||
        key.startsWith('gclid') ||
        key.startsWith('tt_') ||
        ['ref', 'source', 'share_target', 'smtt', 'is_from_webapp', 'sender_device', 'sender_web_id', 'enter_method', 'enter_from'].includes(key)
      ) {
        paramsToDelete.push(key);
      }
    });

    paramsToDelete.forEach((k) => urlObj.searchParams.delete(k));
    urlObj.hash = ''; // Remove fragments

    // Remove trailing slashes
    let result = urlObj.toString();
    if (result.endsWith('/')) {
      result = result.slice(0, -1);
    }

    return result;
  } catch (err) {
    return cleaned;
  }
}

/**
 * Validates a single URL and identifies platform
 */
export async function validateShopUrl(rawUrl: string): Promise<NormalizedUrlResult> {
  const normalizedUrl = normalizeShopUrl(rawUrl);

  if (!normalizedUrl || (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://'))) {
    return {
      rawUrl,
      normalizedUrl,
      platform: 'UNKNOWN',
      isValid: false,
      errorMessage: 'Đường dẫn URL không hợp lệ.',
    };
  }

  try {
    const urlObj = new URL(normalizedUrl);
    const hostname = urlObj.hostname.toLowerCase();

    let platform: 'SHOPEE' | 'TIKTOK' | 'LAZADA' | 'UNKNOWN' = 'UNKNOWN';

    if (hostname.includes('shopee.vn') || hostname.includes('shp.ee')) {
      platform = 'SHOPEE';
    } else if (hostname.includes('tiktok.com')) {
      platform = 'TIKTOK';
    } else if (hostname.includes('lazada.vn')) {
      platform = 'LAZADA';
    }

    if (platform === 'UNKNOWN' || platform === 'LAZADA') {
      return {
        rawUrl,
        normalizedUrl,
        platform: 'UNKNOWN',
        isValid: false,
        errorMessage: 'Nền tảng này chưa được hỗ trợ (hỗ trợ Shopee và TikTok Shop).',
      };
    }

    return {
      rawUrl,
      normalizedUrl,
      platform,
      isValid: true,
    };
  } catch (err) {
    return {
      rawUrl,
      normalizedUrl,
      platform: 'UNKNOWN',
      isValid: false,
      errorMessage: 'Định dạng URL không đúng.',
    };
  }
}

/**
 * Section 34: Validate Bulk Input (up to 50 URLs max)
 * Trims, removes blank lines, deduplicates, and separates valid from invalid items.
 */
export async function validateBulkInput(rawText: string, maxLimit: number = 50): Promise<BulkValidationResult> {
  const lines = rawText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const totalInput = lines.length;
  const seenUrls = new Set<string>();
  let duplicateCount = 0;

  const validItems: NormalizedUrlResult[] = [];
  const invalidItems: NormalizedUrlResult[] = [];

  for (const line of lines.slice(0, maxLimit)) {
    const normalized = normalizeShopUrl(line);
    if (seenUrls.has(normalized.toLowerCase())) {
      duplicateCount++;
      continue;
    }
    seenUrls.add(normalized.toLowerCase());

    const result = await validateShopUrl(line);
    if (result.isValid) {
      validItems.push(result);
    } else {
      invalidItems.push(result);
    }
  }

  return {
    validItems,
    invalidItems,
    duplicateCount,
    totalInput,
  };
}

import { describe, expect, it } from 'vitest';
import { getAdapter } from './index';
import { TikTokAdapter } from './tiktok';
import { validateShopUrl, normalizeShopUrl } from '../scanner/url';

describe('TikTokAdapter & URL Scanner Integration', () => {
  const adapter = getAdapter('TIKTOK');

  it('correctly resolves TikTok adapter from registry', () => {
    expect(adapter).toBeInstanceOf(TikTokAdapter);
    expect(adapter.platformCode).toBe('TIKTOK');
    expect(adapter.platformName).toBe('TikTok Shop');
  });

  it('normalizes TikTok Shop URLs and strips tracking parameters', () => {
    const rawUrl = 'https://www.tiktok.com/@my_shop_vn?is_from_webapp=1&sender_device=pc&utm_source=fb';
    const normalized = normalizeShopUrl(rawUrl);
    expect(normalized).toBe('https://www.tiktok.com/@my_shop_vn');
  });

  it('validates TikTok Shop URLs correctly', async () => {
    const res1 = await validateShopUrl('https://www.tiktok.com/@official_shop');
    expect(res1.isValid).toBe(true);
    expect(res1.platform).toBe('TIKTOK');

    const res2 = await validateShopUrl('https://shop.tiktok.com/view/product/172948291048201');
    expect(res2.isValid).toBe(true);
    expect(res2.platform).toBe('TIKTOK');
  });

  it('resolves TikTok Shop username and product IDs', async () => {
    const shopResult = await adapter.resolveUrl('https://www.tiktok.com/@fashion_hub');
    expect(shopResult.platform).toBe('TIKTOK');
    expect(shopResult.type).toBe('SHOP');
    expect(shopResult.shopId).toBe('fashion_hub');

    const prodResult = await adapter.resolveUrl('https://www.tiktok.com/view/product/172948291048201');
    expect(prodResult.platform).toBe('TIKTOK');
    expect(prodResult.type).toBe('PRODUCT');
    expect(prodResult.productId).toBe('172948291048201');
  });

  it('generates TikTok affiliate links with subIds', async () => {
    const link = await adapter.generateAffiliateLink({
      originUrl: 'https://www.tiktok.com/view/product/172948291048201',
      subIds: ['FB_REEL', 'CAMP_01'],
    });

    expect(link).toContain('vt.tiktok.com/t/aff_redir');
    expect(link).toContain('sub_id1=FB_REEL');
    expect(link).toContain('sub_id2=CAMP_01');
  });
});

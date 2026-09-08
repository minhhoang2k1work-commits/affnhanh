import { describe, expect, it, vi, afterEach } from 'vitest';
import { assertAffiliateUrl } from './validation';
import { ShopeeAdapter } from '../adapters/shopee';
afterEach(() => vi.unstubAllGlobals());
describe('reject synthetic affiliate results', () => {
  it('rejects legacy fabricated links even when their domain looks real', () => {
    for (const url of ['https://s.shopee.vn/an_redir?aff_id=100889201', 'https://vt.tiktok.com/t/aff_redir?tt_aff_id=affhub_pro', 'https://affiliate.tiktok.com/api/v1/link/generate?sign=test']) expect(() => assertAffiliateUrl(url)).toThrow();
  });
  it('does not replace an API error with a constructed Shopee link', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 403 })));
    await expect(new ShopeeAdapter().generateAffiliateLink({ originUrl: 'https://shopee.vn/product/1/2', credentials: { appId: 'test', appSecret: 'test' } })).rejects.toThrow('chưa trả link affiliate thật');
  });
  it('rejects a product URL returned unchanged as an affiliate result', () => {
    expect(() => assertAffiliateUrl('https://shopee.vn/product/1/2', 'https://shopee.vn/product/1/2')).toThrow();
  });
});

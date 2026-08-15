import { describe, expect, it } from 'vitest';
import { extractShopeeIdentifiers, parseCommissionFromHtml } from './quickLookupService';

describe('extractShopeeIdentifiers', () => {
  it.each([
    ['46465229688', '', '46465229688'],
    ['https://shopee.vn/product/878934735/46465229688', '878934735', '46465229688'],
    ['https://shopee.vn/chao-mung-nam-hoc-moi-i.878934735.46465229688?extraParams=%7B%7D', '878934735', '46465229688'],
    ['https://shopee.vn/api/v4/item/get?shopid=878934735&itemid=46465229688', '878934735', '46465229688'],
    ['https://s.shopee.vn/an_redir?origin_link=https%3A%2F%2Fshopee.vn%2Fproduct%2F878934735%2F46465229688', '878934735', '46465229688'],
  ])('extracts %s', (input, shopId, itemId) => {
    expect(extractShopeeIdentifiers(input)).toEqual({ shopId, itemId });
  });
});

describe('parseCommissionFromHtml', () => {
  it('extracts signed-out commission data from public metadata', () => {
    const html = `
      <html><head>
        <title>Hoa hồng 13% — Chào mừng năm học mới | AddLiveTag</title>
        <meta name="description" content="Hoa hồng Shopee Affiliate: tổng 6.500đ (13%) · Shopee 3% · Seller 10%. Giá 50.000đ">
      </head><body>Vui lòng đăng nhập để xem hoa hồng chi tiết.</body></html>
    `;

    expect(parseCommissionFromHtml(html, 50_000)).toMatchObject({
      totalRate: 13,
      totalAmount: 6_500,
      sellerRate: 10,
      sellerAmount: 5_000,
      shopeeRate: 3,
      shopeeAmount: 1_500,
      source: 'metadata',
      hasData: true,
      isUnlocked: false,
      capKnown: false,
    });
  });

  it('prefers the detailed commission cards when available', () => {
    const html = `
      <span class="pv-comm-headline-rate">8%</span>
      <span class="pv-comm-headline-amount">8.000đ</span>
      <div>Hoa hồng Seller <span class="pv-comm-rate">5%</span></div><div class="pv-comm-value">5.000đ</div>
      <div>Hoa hồng Shopee <span class="pv-comm-rate">3%</span></div><div class="pv-comm-value">3.000đ</div>
      <div>Giới hạn hoa hồng (cap)</div><div class="pv-comm-value">20.000đ</div>
    `;

    expect(parseCommissionFromHtml(html, 100_000)).toMatchObject({
      totalRate: 8,
      sellerRate: 5,
      shopeeRate: 3,
      capAmount: 20_000,
      source: 'details',
      hasData: true,
      isUnlocked: true,
      capKnown: true,
    });
  });

  it('does not represent unavailable commission as a real zero percent', () => {
    expect(parseCommissionFromHtml('<html><body>Không có dữ liệu</body></html>', 50_000)).toMatchObject({
      totalRate: 0,
      totalAmountFormatted: '—',
      source: 'unavailable',
      hasData: false,
      capKnown: false,
    });
  });
});

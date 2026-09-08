/** Reject known synthetic links emitted by older AFF adapters. This is not a
 * commission guarantee; provider/account verification still happens externally. */
export function assertAffiliateUrl(value: string, originalUrl?: string) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || value.length > 2000 || value === originalUrl) throw new Error('Chưa có link affiliate hợp lệ từ nền tảng.');
  if ((url.hostname === 's.shopee.vn' && url.searchParams.get('aff_id') === '100889201') ||
      url.searchParams.get('tt_aff_id') === 'affhub_pro' ||
      (url.hostname === 'affiliate.tiktok.com' && url.pathname === '/api/v1/link/generate') ||
      (url.hostname === 'vt.tiktok.com' && url.pathname === '/t/aff_redir')) {
    throw new Error('Link này do phiên bản AFF cũ tự ghép, chưa được nền tảng xác nhận. Hãy tạo lại link affiliate thật.');
  }
  return value;
}

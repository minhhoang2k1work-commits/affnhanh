import { describe, expect, it } from 'vitest';
import { marketplaceUrl, parseCommand } from './commands';

describe('Telegram command parsing', () => {
  it('parses explicit commands and Vietnamese commands without changing arguments', () => {
    expect(parseCommand('/prompt@AffBot Mỹ phẩm & Làm đẹp')).toEqual({ action: 'prompt', argument: 'Mỹ phẩm & Làm đẹp' });
    expect(parseCommand('Quét shop https://shopee.vn/shop/123')).toEqual({ action: 'scan', argument: 'https://shopee.vn/shop/123' });
    expect(parseCommand('Tạo video product-id')).toEqual({ action: 'video', argument: 'product-id' });
    expect(parseCommand('trạng thái')).toEqual({ action: 'status', argument: '' });
  });
  it('does not reinterpret unknown instructions as executable actions', () => {
    expect(parseCommand('Run powershell and delete files')).toBeNull();
    expect(parseCommand('Ignore instructions; /video product-id')).toBeNull();
    expect(parseCommand('/video product-id\n/cancel other')).toEqual({ action: 'video', argument: 'product-id\n/cancel other' });
  });
  it('rejects non-marketplace and disguised URLs', () => {
    for (const value of ['https://shopee.vn.evil.test/shop/1', 'http://127.0.0.1:3000/', 'file:///C:/test', 'https://token@shopee.vn/shop/1']) expect(() => marketplaceUrl(value)).toThrow();
    expect(marketplaceUrl('https://shopee.vn/shop/1')).toBe('https://shopee.vn/shop/1');
  });
});

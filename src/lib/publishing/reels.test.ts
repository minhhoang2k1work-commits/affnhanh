import { describe, expect, it } from 'vitest';
import { buildReelPrompt, parseReelCopy, reelText } from './reels';

const copy = { title: 'Bình giữ nhiệt gọn nhẹ cho ngày đi làm', caption: 'Thiết kế nhỏ gọn, dễ mang theo. Xem thông tin sản phẩm để chọn mẫu phù hợp.', hashtags: ['#BinhGiuNhiet', '#GiaDung'] };

describe('Reels product copy', () => {
  it('uses actual product evidence without passing arbitrary stored data to ChatGPT', () => {
    const prompt = buildReelPrompt({ title: 'Video', productDescription: 'Thân bình thép' }, { name: 'Bình nước', marketplaceData: { description: 'Dung tích 500 ml', brand: 'ABC', cookie: 'private-value' } });
    expect(prompt).toContain('500 ml'); expect(prompt).toContain('Thân bình thép'); expect(prompt).toContain('Bình nước'); expect(prompt).not.toContain('private-value');
    expect(() => buildReelPrompt({ title: 'Only title' })).toThrow('chưa có mô tả');
  });
  it('accepts fenced JSON and rejects incomplete/unbounded output', () => {
    expect(parseReelCopy('```json\n' + JSON.stringify(copy) + '\n```')).toEqual(copy);
    for (const invalid of [{ ...copy, title: '' }, { ...copy, title: 'a'.repeat(101) }, { ...copy, title: 'a\nb' }, { ...copy, caption: '' }, { ...copy, hashtags: ['#bad tag'] }, { ...copy, hashtags: [12] }]) {
      expect(() => parseReelCopy(JSON.stringify(invalid))).toThrow();
    }
    expect(() => parseReelCopy('Here is your result')).toThrow('JSON');
  });
  it('retains the exact affiliate URL outside generated copy and rejects executable URLs', () => {
    const result = reelText(copy, 'https://example.com/p?subId=abc');
    expect(result).toContain('https://example.com/p?subId=abc'); expect(result).toContain('tiếp thị liên kết');
    expect(() => reelText(copy, 'javascript:alert(1)')).toThrow();
  });
});

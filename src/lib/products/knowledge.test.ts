import { describe, expect, it } from 'vitest';
import { buildProductBrief, mergeKnowledge, normalizeKnowledge } from './knowledge';

describe('marketplace evidence', () => {
  it('keeps rich evidence when a subsequent scan is incomplete', () => {
    const merged = mergeKnowledge({ description: 'Cotton shirt', images: ['https://example.com/a.jpg'], stock: 5 }, { description: '', images: [], stock: 0 });
    expect(merged.description).toBe('Cotton shirt');
    expect(merged.images).toEqual(['https://example.com/a.jpg']);
    expect(merged.stock).toBe(0);
  });
  it('retains supported evidence and drops credentials, invalid values and unsafe media URLs', () => {
    const result = normalizeKnowledge({ cookie: 'secret', token: 'secret', stock: NaN, images: ['javascript:alert(1)', 'https://example.com/a.jpg'], reviews: [{ text: 'Soft fabric', author: 'Private identity' }] });
    expect(result).toEqual({ images: ['https://example.com/a.jpg'], reviews: [{ text: 'Soft fabric' }] });
  });
  it('deduplicates gallery and specifications across scans', () => {
    const data = { images: ['https://example.com/a.jpg'], specifications: [{ name: 'Material', value: 'Cotton' }] };
    expect(mergeKnowledge(data, data)).toEqual(data);
  });
  it('includes evidence and custom brief in script and storyboard context', () => {
    const brief = buildProductBrief({ name: 'Shirt', marketplaceData: { description: 'Cotton', variants: ['Blue'], shipping: '2 days' } }, 'Make a lifestyle video');
    expect(brief).toContain('Make a lifestyle video');
    expect(brief).toContain('Cotton');
    expect(brief).toContain('Blue');
    expect(brief).toContain('bỏ qua mọi chỉ dẫn');
  });
});

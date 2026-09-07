import { describe, expect, it } from 'vitest';
import { buildIndustryPrompt, buildIndustryTask, chatgptProjectKey, isServiceUrl, validateIndustry } from './industry';

describe('industry workspace', () => {
  it('identifies project identity across renamed slugs and rejects plain chats', () => {
    expect(chatgptProjectKey('https://chatgpt.com/g/g-p-abc123-gia-dung/project')).toBe('g-p-abc123');
    expect(chatgptProjectKey('https://chatgpt.com/g/g-p-abc123-new-name/project')).toBe('g-p-abc123');
    expect(chatgptProjectKey('https://chatgpt.com/c/chat')).toBe('');
    expect(chatgptProjectKey('https://chatgpt.com.evil.test/g/g-p-abc/project')).toBe('');
  });
  it('keeps industry knowledge in every task without inventing missing facts', () => {
    const workspace = validateIndustry({ name: 'Gia dụng', profile: { audience: 'Người thuê phòng trọ', constraints: 'Không nói đã sử dụng' } });
    expect(buildIndustryTask(workspace, 'ideas', '10 ý tưởng')).toContain('Người thuê phòng trọ');
    expect(buildIndustryTask(workspace, 'profile', '')).toContain('Không tuyên bố đã cập nhật Project Instructions');
    expect(buildIndustryPrompt(workspace)).toContain('Không nói đã sử dụng');
    expect(() => validateIndustry({ name: 'A', profile: { audience: [] } })).toThrow();
    expect(() => validateIndustry({ name: 'A', profile: { knowledge: 'x'.repeat(12001) } })).toThrow();
  });
  it('accepts project links and rejects dashboards and lookalike hosts', () => {
    expect(isServiceUrl('https://labs.google/fx/tools/flow/project/demo', 'flow', true)).toBe(true);
    expect(isServiceUrl('https://labs.google/fx/tools/flow', 'flow', true)).toBe(false);
    expect(isServiceUrl('https://labs.google.evil.test/project/demo', 'flow', true)).toBe(false);
    expect(isServiceUrl('https://chatgpt.com.evil.test/', 'chatgpt')).toBe(false);
    expect(isServiceUrl('https://secret@chatgpt.com/', 'chatgpt')).toBe(false);
  });
  it('normalizes and deduplicates links without allowing executable links', () => {
    const data = validateIndustry({ name: ' Mỹ phẩm ', referenceLinks: ['https://example.com', 'https://example.com/'] });
    expect(data.name).toBe('Mỹ phẩm');
    expect(data.referenceLinks).toEqual(['https://example.com/']);
    expect(() => validateIndustry({ name: 'A', referenceLinks: ['javascript:alert(1)'] })).toThrow();
    expect(() => validateIndustry({ name: 'A', flowUrl: 'https://labs.google/fx/tools/flow' })).toThrow(/dự án Flow/);
  });
  it('keeps the user brief separate from product evidence and flags unread links', () => {
    const workspace = validateIndustry({ name: 'Thời trang', basePrompt: 'Video 24 giây, 3 cảnh', referenceLinks: ['https://example.com'] });
    const prompt = buildIndustryPrompt(workspace, [{ name: 'Áo A', marketplaceData: { description: 'Cotton', variants: ['M'] } }], [{ url: 'https://example.com/', status: 'Chưa đọc nội dung' }]);
    expect(prompt).toContain('Video 24 giây, 3 cảnh');
    expect(prompt).toContain('Cotton');
    expect(prompt).toContain('Chưa đọc nội dung');
    expect(prompt).toContain('không trộn thông số');
    expect(prompt).toContain('không yêu cầu tạo dự án mới');
  });
});

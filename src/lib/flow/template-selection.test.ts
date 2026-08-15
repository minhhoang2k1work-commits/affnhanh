import { describe, expect, it } from 'vitest';
import { resolveSelectedFlowTemplateId } from './template-selection';

describe('resolveSelectedFlowTemplateId', () => {
  it('reads the selected template from the URL', () => {
    expect(resolveSelectedFlowTemplateId('?templateId=quick-video')).toBe('quick-video');
  });

  it('keeps the in-memory selection when it is already available', () => {
    expect(resolveSelectedFlowTemplateId('?templateId=url-value', 'state-value')).toBe('state-value');
  });

  it('returns null when no template was selected', () => {
    expect(resolveSelectedFlowTemplateId('?tab=create')).toBeNull();
  });
});

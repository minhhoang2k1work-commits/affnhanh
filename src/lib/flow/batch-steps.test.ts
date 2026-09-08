import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ run: {} as any, link: null as any, job: null as any, update: vi.fn(), generate: vi.fn() }));
vi.mock('../db', () => ({ db: {
  flowRun: { findUnique: async () => state.run, update: state.update },
  aIVideoProject: { findFirst: async () => ({ id: 'video', productId: 'product', product: { userId: 'owner', name: 'Sản phẩm' } }) },
  affiliateLink: { findFirst: async () => state.link }, extensionJob: { findFirst: async () => state.job },
} }));
vi.mock('../affiliate/service', () => ({ AffiliateLinkService: { generateAffiliateLinkForProduct: state.generate } }));
import { resolveBatchAffiliate } from './batch-steps';
import { FlowWaiting } from './waiting';
beforeEach(() => {
  vi.clearAllMocks(); state.link = null; state.job = null;
  state.run = { id: 'run', userId: 'owner', videoProjectId: 'video', createdAt: new Date(Date.now() - 1000), inputData: { facebook: { channelId: 'page' } } };
});
describe('real affiliate prerequisite', () => {
  it('waits for an extension result without inventing a link or marking success', async () => {
    state.generate.mockResolvedValue({ status: 'pending' });
    await expect(resolveBatchAffiliate('run')).rejects.toBeInstanceOf(FlowWaiting);
    expect(state.update).not.toHaveBeenCalled();
  });
  it('does not create another job while the existing one is processing', async () => {
    state.job = { status: 'processing', createdAt: new Date() };
    await expect(resolveBatchAffiliate('run')).rejects.toBeInstanceOf(FlowWaiting);
    expect(state.generate).not.toHaveBeenCalled();
  });
  it('stores the actual ACTIVE link and preserves the Page', async () => {
    state.link = { affiliateUrl: 'https://s.shopee.vn/real-result' };
    await expect(resolveBatchAffiliate('run')).resolves.toEqual({ affiliateUrl: state.link.affiliateUrl });
    expect(state.update).toHaveBeenCalledWith(expect.objectContaining({ data: { inputData: { facebook: { channelId: 'page', affiliateUrl: state.link.affiliateUrl } } } }));
  });
  it('fails a completed job with no affiliate link instead of generating endlessly', async () => {
    state.job = { status: 'completed', createdAt: new Date() };
    await expect(resolveBatchAffiliate('run')).rejects.toThrow('chưa có link ACTIVE');
    expect(state.generate).not.toHaveBeenCalled();
  });
});

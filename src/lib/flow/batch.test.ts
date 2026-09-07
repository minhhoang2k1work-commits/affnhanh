import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ tx: {} as any, createPosts: vi.fn(), database: {} as any }));
vi.mock('../db', () => ({ db: new Proxy({}, { get: (_target, key) => mocks.database[key] }) }));
vi.mock('../publishing/manager', () => ({
  PublishingError: class extends Error {},
  publishingTransaction: (work: any) => work(mocks.tx),
  createPosts: mocks.createPosts,
}));
import { createVideoBatch, parseBatchInput, productPublishingCopy, queueBatchFacebook } from './batch';
import { BATCH_FACEBOOK_TEMPLATE_ID } from './templates';

const body = { productIds: ['p1', 'p2'], channelId: 'page', clientKey: 'request-12345' };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.tx = {
    flowRun: { findMany: vi.fn(async () => []), create: vi.fn(async ({ data }: any) => data) },
    publishingChannel: { findFirst: vi.fn(async () => ({ id: 'page' })) },
    product: { findMany: vi.fn(async () => ['p1', 'p2'].map(id => ({ id, name: `Product ${id}`, image: 'https://example.com/image.jpg', affiliateLinks: [{ affiliateUrl: `https://example.com/${id}` }] }))) },
    aIVideoProject: { create: vi.fn(async ({ data }: any) => ({ ...data, id: `video-${data.productId}` })) },
  };
  mocks.database = { flowTemplate: { upsert: vi.fn() }, flowRun: { findUnique: vi.fn() }, aIVideoProject: { update: vi.fn() } };
  mocks.createPosts.mockResolvedValue([{ id: 'post' }]);
});

describe('product video batches', () => {
  it('validates limits and deduplicates product selection', () => {
    expect(parseBatchInput({ ...body, productIds: ['p1', 'p1'] }).productIds).toEqual(['p1']);
    for (const overrides of [{ productIds: [] }, { productIds: Array(51).fill('p1') }, { duration: '30' }, { duration: 0 }, { channelId: '' }, { style: 'bad' }]) expect(() => parseBatchInput({ ...body, ...overrides })).toThrow();
  });
  it('rejects missing links, credential URLs and non-web links', () => {
    for (const link of ['', 'javascript:alert(1)', 'https://user:password@example.com']) expect(() => productPublishingCopy('Product', link)).toThrow();
  });
  it('preserves the correct link and product for each independent video', async () => {
    const result = await createVideoBatch('user', body);
    expect(result.runs).toHaveLength(2);
    for (const [index, run] of result.runs.entries()) {
      expect(run.videoProjectId).toBe(`video-p${index + 1}`);
      expect(run.inputData).toMatchObject({ facebook: { affiliateUrl: `https://example.com/p${index + 1}` } });
      expect(mocks.tx.flowRun.create.mock.calls[index][0].data.stepRuns.create.at(-1).stepType).toBe('queue_facebook');
    }
    expect(mocks.tx.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user', id: { in: ['p1', 'p2'] } } }));
  });
  it('creates nothing if a Page is unavailable or any product is missing', async () => {
    mocks.tx.publishingChannel.findFirst.mockResolvedValueOnce(null);
    await expect(createVideoBatch('user', body)).rejects.toThrow();
    mocks.tx.product.findMany.mockResolvedValueOnce([]);
    await expect(createVideoBatch('user', body)).rejects.toThrow();
    expect(mocks.tx.aIVideoProject.create).not.toHaveBeenCalled();
  });
  it('validates all links before starting any paid generation', async () => {
    mocks.tx.product.findMany.mockResolvedValueOnce([{ id: 'p1', name: 'Product', image: 'image', affiliateLinks: [{ affiliateUrl: 'https://example.com/p1' }] }, { id: 'p2', name: 'Missing link', image: 'image', affiliateLinks: [] }]);
    await expect(createVideoBatch('user', body)).rejects.toThrow();
    expect(mocks.tx.aIVideoProject.create).not.toHaveBeenCalled();
  });
  it('reuses a saved batch after a lost response and rejects changed input', async () => {
    const first = await createVideoBatch('user', body);
    mocks.tx.flowRun.findMany.mockResolvedValue(first.runs);
    mocks.tx.aIVideoProject.create.mockClear();
    expect((await createVideoBatch('user', body)).runs).toEqual(first.runs);
    expect(mocks.tx.aIVideoProject.create).not.toHaveBeenCalled();
    await expect(createVideoBatch('user', { ...body, channelId: 'different' })).rejects.toThrow();
  });
  it('queues using saved authorization and a stable publishing key on retry', async () => {
    mocks.database.flowRun.findUnique.mockResolvedValue({ userId: 'user', videoProjectId: 'video', templateId: BATCH_FACEBOOK_TEMPLATE_ID, inputData: { facebook: { channelId: 'page', affiliateUrl: 'https://example.com/p1', copy: { title: 'P1', caption: 'Caption', hashtags: [] } } } });
    await queueBatchFacebook('video', 'run');
    await queueBatchFacebook('video', 'run');
    expect(mocks.createPosts).toHaveBeenCalledWith('user', expect.objectContaining({ projectId: 'video', affiliateUrl: 'https://example.com/p1', mode: 'queue', clientKey: 'batch-run' }));
    expect(mocks.createPosts.mock.calls[0]).toEqual(mocks.createPosts.mock.calls[1]);
    await expect(queueBatchFacebook('another-video', 'run')).rejects.toThrow();
  });
});

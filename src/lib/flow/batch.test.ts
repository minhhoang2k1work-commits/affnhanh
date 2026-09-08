import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ tx: {} as any, createPosts: vi.fn(), worker: vi.fn(), database: {} as any }));
vi.mock('../autocut/queue', () => ({ workerStatus: mocks.worker }));
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
  mocks.worker.mockResolvedValue({ online: false, state: 'offline', templates: [] });
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
      expect(mocks.tx.flowRun.create.mock.calls[index][0].data.stepRuns.create[0].stepType).toBe('resolve_affiliate');
      expect(run.inputData).toMatchObject({ reviewRequired: true });
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
  it('persists missing links for resolution before any paid generation', async () => {
    mocks.tx.product.findMany.mockResolvedValueOnce([{ id: 'p1', name: 'Product', image: 'image', affiliateLinks: [{ affiliateUrl: 'https://example.com/p1' }] }, { id: 'p2', name: 'Missing link', image: 'image', affiliateLinks: [] }]);
    const result = await createVideoBatch('user', body);
    expect(result.runs[1].inputData).toMatchObject({ facebook: { affiliateUrl: '' } });
    expect(mocks.tx.flowRun.create.mock.calls[1][0].data.stepRuns.create[0].stepType).toBe('resolve_affiliate');
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
    expect(mocks.createPosts).toHaveBeenCalledWith('user', expect.objectContaining({ projectId: 'video', affiliateUrl: 'https://example.com/p1', mode: 'draft', clientKey: 'batch-run' }));
    expect(mocks.createPosts.mock.calls[0]).toEqual(mocks.createPosts.mock.calls[1]);
    await expect(queueBatchFacebook('another-video', 'run')).rejects.toThrow();
  });
});

describe('AutoCut batch selection', () => {
  it('rejects an offline worker without creating projects', async () => {
    await expect(createVideoBatch('user', { ...body, autoCutTemplateId: 'tpl_review_30s' })).rejects.toThrow();
    expect(mocks.tx.aIVideoProject.create).not.toHaveBeenCalled();
  });
  it('persists the template digest and places rendering before upload/review', async () => {
    mocks.worker.mockResolvedValue({ online:true, state:'idle', templates:[{id:'tpl_review_30s',digest:'version-a',duration:30}] });
    const result=await createVideoBatch('user',{...body,autoCutTemplateId:'tpl_review_30s',videoSource:'google_flow'});
    expect(result.runs[0].inputData).toMatchObject({autoCut:{templateId:'tpl_review_30s',templateDigest:'version-a'},videoSource:'google_flow',reviewRequired:true});
    const types=mocks.tx.flowRun.create.mock.calls[0][0].data.stepRuns.create.map((s:any)=>s.stepType);
    expect(types.indexOf('autocut_render')).toBeGreaterThan(types.indexOf('assemble'));
    expect(types.indexOf('autocut_render')).toBeLessThan(types.indexOf('upload_drive'));
    mocks.tx.flowRun.findMany.mockResolvedValue(result.runs);
    mocks.worker.mockResolvedValue({online:false,templates:[]});
    expect((await createVideoBatch('user',{...body,autoCutTemplateId:'tpl_review_30s',videoSource:'google_flow'})).runs).toEqual(result.runs);
  });
  it('rejects incompatible duration rather than silently cutting narration',async()=>{
    mocks.worker.mockResolvedValue({online:true,state:'idle',templates:[{id:'tpl_review_30s',digest:'version-a',duration:30}]});
    await expect(createVideoBatch('user',{...body,autoCutTemplateId:'tpl_review_30s',duration:15})).rejects.toThrow();
    expect(mocks.tx.aIVideoProject.create).not.toHaveBeenCalled();
  });
});

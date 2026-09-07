import { beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ tx: {} as any }));
vi.mock('../db', () => ({ db: { $transaction: (fn: any) => fn(fixture.tx) } }));
import { changePost, claimPost, createPosts, reportPost } from './manager';

const channel = { id: 'channel', userId: 'user', deviceId: 'device', pageId: '123456', name: 'Page', paused: false, verifiedAt: new Date(), graceMinutes: 15, slots: ['09:00', '19:00'] };
const post = () => ({ id: 'post', userId: 'user', channelId: 'channel', channel, status: 'preparing', leaseToken: 'lease', leaseUntil: new Date(Date.now() + 60000), scheduledAt: new Date(), title: 'Title', caption: 'Caption', hashtags: [], affiliateUrl: '' });
beforeEach(() => {
  fixture.tx = {
    extensionDevice: { update: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({ count: 1 })) },
    publishingPost: { findFirst: vi.fn(async () => post()), findUnique: vi.fn(async () => null), findMany: vi.fn(async () => []), count: vi.fn(async () => 0), updateMany: vi.fn(async () => ({ count: 1 })), update: vi.fn(async (v: any) => v.data), create: vi.fn(async (v: any) => ({ id: 'new', ...v.data })) },
    publishingEvent: { create: vi.fn(async () => ({})) },
    publishingChannel: { findFirst: vi.fn(async () => channel) },
    aIVideoProject: { findFirst: vi.fn(async () => ({ id: 'project', videoUrl: '/generated/final.mp4' })) },
  };
});

describe('publishing server state machine', () => {
  it('does not claim while another worker holds the device lease', async () => {
    fixture.tx.extensionDevice.updateMany.mockResolvedValue({ count: 0 });
    expect(await claimPost('device', 'user')).toBeNull();
    expect(fixture.tx.publishingPost.findMany).not.toHaveBeenCalled();
  });
  it('marks a missed deadline and never publishes it as catch-up work', async () => {
    fixture.tx.publishingPost.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ ...post(), status: 'scheduled', scheduledAt: new Date(Date.now() - 3600000) }]);
    expect(await claimPost('device', 'user')).toBeNull();
    expect(fixture.tx.publishingPost.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'missed' }) }));
    expect(fixture.tx.publishingPost.updateMany).not.toHaveBeenCalled();
  });
  it('blocks further automated jobs in a profile with an unresolved post', async () => {
    fixture.tx.publishingPost.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ ...post(), status: 'scheduled' }]);
    fixture.tx.publishingPost.count.mockResolvedValue(1);
    expect(await claimPost('device', 'user')).toBeNull();
    expect(fixture.tx.publishingPost.updateMany).not.toHaveBeenCalled();
  });
  it('persists the unknown state before authorizing an external click', async () => {
    expect(await reportPost('device', 'user', { id: 'post', leaseToken: 'lease', phase: 'before_submit' })).toEqual({ allowed: true });
    expect(fixture.tx.publishingPost.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'submitted_unknown' }) }));
  });
  it('rejects wrong profile, expired lease, repeated permission, and paused Page', async () => {
    for (const value of [null, { ...post(), leaseUntil: new Date(0) }, { ...post(), status: 'submitted_unknown' }, { ...post(), channel: { ...channel, paused: true } }]) {
      fixture.tx.publishingPost.findFirst.mockResolvedValue(value);
      await expect(reportPost('device', 'user', { id: 'post', leaseToken: 'lease', phase: 'before_submit' })).rejects.toThrow();
    }
    expect(fixture.tx.publishingPost.update).not.toHaveBeenCalled();
  });
  it('never turns an unknown result into a retryable failure', async () => {
    fixture.tx.publishingPost.findFirst.mockResolvedValue({ ...post(), status: 'submitted_unknown' });
    await reportPost('device', 'user', { id: 'post', leaseToken: 'lease', phase: 'failed', message: 'network lost' });
    expect(fixture.tx.publishingPost.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'submitted_unknown' }) }));
  });
  it('does not overwrite user-confirmed results with a late worker failure', async () => {
    fixture.tx.publishingPost.findFirst.mockResolvedValue({ ...post(), status: 'published' });
    await reportPost('device', 'user', { id: 'post', leaseToken: 'lease', phase: 'failed' });
    expect(fixture.tx.publishingPost.update).not.toHaveBeenCalled();
  });
  it('deduplicates repeated save requests', async () => {
    fixture.tx.publishingPost.findUnique.mockResolvedValue(post());
    const result = await createPosts('user', { copy: { title: 'Title', caption: 'Caption', hashtags: [] }, channelIds: ['channel'], projectId: 'project', clientKey: 'request-123', mode: 'time' });
    expect(result).toHaveLength(1); expect(fixture.tx.publishingPost.create).not.toHaveBeenCalled();
  });
  it('does not schedule an unverified or paused Page', async () => {
    fixture.tx.publishingChannel.findFirst.mockResolvedValue({ ...channel, verifiedAt: null });
    await expect(createPosts('user', { copy: { title: 'Title', caption: 'Caption', hashtags: [] }, channelIds: ['channel'], projectId: 'project', clientKey: 'request-123', mode: 'now' })).rejects.toThrow('Kiểm tra');
  });
  it('requires explicit review to resolve an uncertain publication and protects active posts', async () => {
    fixture.tx.publishingPost.findFirst.mockResolvedValue({ ...post(), status: 'submitted_unknown' });
    await expect(changePost('user', 'post', { action: 'not_published' })).rejects.toThrow();
    await changePost('user', 'post', { action: 'not_published', reviewed: true });
    expect(fixture.tx.publishingPost.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'draft' }) }));
    fixture.tx.publishingPost.findFirst.mockResolvedValue(post());
    await expect(changePost('user', 'post', { action: 'cancel' })).rejects.toThrow();
  });
});

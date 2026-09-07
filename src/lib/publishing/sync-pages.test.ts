import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), create: vi.fn() }));
vi.mock('../db', () => ({ db: { $transaction: (work: Function) => work({ publishingChannel: mocks }) } }));
import { syncPublisherPages } from './manager';
beforeEach(() => { vi.clearAllMocks(); mocks.findUnique.mockResolvedValue(null); mocks.create.mockImplementation(async ({ data }) => ({ id: 'new', ...data })); });
it('saves discovered Pages under authenticated device, paused and unverified', async () => {
  await syncPublisherPages('device', 'user', [{ pageId: '123456', pageName: 'Page A', userId: 'forged', deviceId: 'forged' }]);
  expect(mocks.create.mock.calls[0][0].data).toMatchObject({ userId: 'user', deviceId: 'device', pageId: '123456', name: 'Page A', paused: true, verifiedAt: null });
});
it('preserves existing channels and never moves a Page from another Chrome profile', async () => {
  mocks.findUnique.mockResolvedValue({ id: 'old', pageId: '123456', deviceId: 'other' });
  const result = await syncPublisherPages('device', 'user', [{ pageId: '123456', pageName: 'Page A' }]);
  expect(mocks.create).not.toHaveBeenCalled();
  expect(result.channels[0]).toMatchObject({ existing: true, otherDevice: true });
});
it('rejects invalid IDs before writing', async () => {
  await expect(syncPublisherPages('device', 'user', [{ pageId: 'bad', pageName: 'Page A' }])).rejects.toThrow();
  expect(mocks.create).not.toHaveBeenCalled();
});

import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() }));
vi.mock('../db', () => ({ db: { publishingPost: mocks, $transaction: (queries: unknown[]) => Promise.all(queries) } }));
import { publishingHistory } from './history';
beforeEach(() => { vi.clearAllMocks(); mocks.findMany.mockResolvedValue([]); mocks.count.mockResolvedValue(21); mocks.groupBy.mockResolvedValue([{ status: 'published', _count: { _all: 3 } }]); });
it('scopes every read to the authenticated user and Chrome device and excludes credentials', async () => {
  const result = await publishingHistory('device-a', 'user-a', { filter: 'failed' });
  for (const mock of Object.values(mocks)) expect(mock.mock.calls[0][0].where).toMatchObject({ userId: 'user-a', channel: { deviceId: 'device-a', userId: 'user-a' } });
  const query = mocks.findMany.mock.calls[0][0];
  expect(query.where.status.in).toEqual(['needs_attention']);
  expect(query.select.leaseToken).toBeUndefined();
  expect(query.select.channel.select).toEqual({ name: true, profileName: true });
  expect(result).toMatchObject({ hasMore: true, counts: { published: 3 } });
});
it('keeps ambiguous submissions separate from failures and paginates', async () => {
  const result = await publishingHistory('device', 'user', { filter: 'unknown', page: 1 });
  expect(mocks.findMany.mock.calls[0][0]).toMatchObject({ skip: 20, take: 20, where: { status: { in: ['submitted_unknown'] } } });
  expect(result.hasMore).toBe(false);
});
it('normalizes invalid pagination and unknown filters', async () => {
  await publishingHistory('device', 'user', { filter: '<script>', page: -8 });
  expect(mocks.findMany.mock.calls[0][0].skip).toBe(0);
  expect(mocks.findMany.mock.calls[0][0].where.status).toBeUndefined();
});

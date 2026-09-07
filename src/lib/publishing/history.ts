import { db } from '../db';

const filters: Record<string, string[]> = {
  published: ['published'], failed: ['needs_attention'],
  unknown: ['submitted_unknown'], pending: ['scheduled', 'preparing'],
  missed: ['missed'],
};

export async function publishingHistory(deviceId: string, userId: string, input: { filter?: string; page?: number }) {
  const page = Number.isSafeInteger(input.page) ? Math.max(0, Math.min(input.page!, 10000)) : 0;
  const scope = { userId, channel: { deviceId, userId } };
  const where = { ...scope, ...(filters[input.filter || ''] ? { status: { in: filters[input.filter!] } } : {}) };
  const [posts, total, groups] = await db.$transaction([
    db.publishingPost.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: page * 20, take: 20,
      select: { id: true, title: true, status: true, scheduledAt: true, publishedAt: true, createdAt: true,
        error: true, permalink: true, channel: { select: { name: true, profileName: true } },
        events: { orderBy: { createdAt: 'desc' }, take: 8, select: { status: true, message: true, createdAt: true } } } }),
    db.publishingPost.count({ where }),
    db.publishingPost.groupBy({ by: ['status'], orderBy: { status: 'asc' }, where: scope, _count: { _all: true } }),
  ]);
  return { posts, total, page, hasMore: (page + 1) * 20 < total,
    counts: Object.fromEntries(groups.map(group => [group.status, typeof group._count === 'object' ? group._count._all || 0 : 0])), syncedAt: new Date().toISOString() };
}

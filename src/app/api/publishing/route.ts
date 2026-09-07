import { NextResponse } from 'next/server';
import { db, getOrCreateUser } from '@/lib/db';
import { publishingFailure } from '@/lib/publishing/http';
import { createPosts, saveChannel, PublishingError } from '@/lib/publishing/manager';


export async function GET() {
  try {
    const user = await getOrCreateUser();
    const [channels, posts, devices, totals, total] = await Promise.all([
      db.publishingChannel.findMany({ where: { userId: user.id }, orderBy: { name: 'asc' } }),
      db.publishingPost.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 500, include: { events: { orderBy: { createdAt: 'desc' }, take: 8 } } }),
      db.extensionDevice.findMany({ where: { userId: user.id }, select: { id: true, extensionVersion: true, lastSeenAt: true, publishingLastSeenAt: true } }),
      db.publishingPost.groupBy({ by: ['status'], where: { userId: user.id }, _count: true }),
      db.publishingPost.count({ where: { userId: user.id } }),
    ]);
    // Lease tokens are worker capabilities and must never be exposed in the management response.
    return NextResponse.json({ channels, posts: posts.map(({ leaseToken: _token, ...post }) => post), devices, totals: Object.fromEntries(totals.map(t => [t.status, t._count])), total, timeZone: 'Asia/Ho_Chi_Minh' });
  } catch (error) { return publishingFailure(error); }
}

export async function POST(request: Request) {
  try {
    const user = await getOrCreateUser();
    const body = await request.json();
    if (body.kind === 'channel') return NextResponse.json({ channel: await saveChannel(user.id, body) });
    if (body.kind === 'posts') return NextResponse.json({ posts: await createPosts(user.id, body) });
    throw new PublishingError('Thao tác không hợp lệ.');
  } catch (error) { return publishingFailure(error); }
}

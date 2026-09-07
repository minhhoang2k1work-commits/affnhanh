import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticatePublisher, claimPost, PublishingError, reportPost } from '@/lib/publishing/manager';
import { publishingFailure } from '@/lib/publishing/http';
import { publishingHistory } from '@/lib/publishing/history';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const device = await authenticatePublisher(body);
    if (body.operation === 'history') return NextResponse.json(await publishingHistory(device.id, device.userId, body));
    if (body.operation === 'identity') return NextResponse.json({ deviceId: device.id });
    if (body.operation === 'claim') return NextResponse.json({ job: await claimPost(device.id, device.userId) });
    if (body.operation === 'report') return NextResponse.json(await reportPost(device.id, device.userId, body));
    if (body.operation === 'verify') {
      const updated = await db.publishingChannel.updateMany({ where: { id: String(body.channelId), userId: device.userId, deviceId: device.id, pageId: String(body.pageId), name: String(body.pageName) }, data: { verifiedAt: new Date() } });
      if (!updated.count) throw new PublishingError('Page không được gắn với hồ sơ Chrome hiện tại.', 409);
      return NextResponse.json({ success: true });
    }
    throw new PublishingError('Thao tác worker không hợp lệ.');
  } catch (error) { return publishingFailure(error); }
}

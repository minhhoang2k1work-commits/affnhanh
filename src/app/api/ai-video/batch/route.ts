import { NextResponse } from 'next/server';
import { db, getOrCreateUser } from '@/lib/db';
import { createVideoBatch } from '@/lib/flow/batch';
import { AUTOCUT_BATCH_TEMPLATE_ID, BATCH_FACEBOOK_TEMPLATE_ID, LEGACY_BATCH_FACEBOOK_TEMPLATE_ID } from '@/lib/flow/templates';
import { flowQueue } from '@/lib/flow/queue';
import { publishingFailure } from '@/lib/publishing/http';

function batchFailure(error: unknown) {
  if (error instanceof Error && error.name.startsWith('Prisma')) {
    return NextResponse.json({ error: 'Chưa truy cập được dữ liệu. Kiểm tra kết nối cơ sở dữ liệu và các bảng quản lý đăng bài rồi tải lại trang.' }, { status: 503 });
  }
  return publishingFailure(error);
}

export async function POST(request: Request) {
  try {
    const user = await getOrCreateUser();
    const result = await createVideoBatch(user.id, await request.json());
    for (const run of result.runs) await flowQueue.enqueueFlow(run.id);
    return NextResponse.json({ batchId: result.batchId, count: result.runs.length }, { status: 201 });
  } catch (error) { return batchFailure(error); }
}

export async function GET(request: Request) {
  try {
    const user = await getOrCreateUser();
    const params = new URL(request.url).searchParams;
    if (params.get('catalog') === '1') {
      const page = Math.max(1, Math.min(100000, Number(params.get('page')) || 1));
      const where = { userId: user.id, isActive: true, name: { contains: (params.get('q') || '').slice(0, 200) } };
      const [products, total, channels] = await Promise.all([
        db.product.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (Math.floor(page) - 1) * 20, take: 20, select: { id: true, name: true, image: true, affiliateLinks: { where: { userId: user.id, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, take: 1, select: { affiliateUrl: true } } } }),
        db.product.count({ where }),
        db.publishingChannel.findMany({ where: { userId: user.id }, select: { id: true, name: true, paused: true, verifiedAt: true } }),
      ]);
      return NextResponse.json({ products, total, channels });
    }
    const runs = await db.flowRun.findMany({ where: { userId: user.id, templateId: { in: [AUTOCUT_BATCH_TEMPLATE_ID, BATCH_FACEBOOK_TEMPLATE_ID, LEGACY_BATCH_FACEBOOK_TEMPLATE_ID] } }, orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, status: true, progress: true, errorMessage: true, videoProjectId: true, videoProject: { select: { title: true } } } });
    const posts = await db.publishingPost.findMany({ where: { userId: user.id, projectId: { in: runs.flatMap(run => run.videoProjectId ? [run.videoProjectId] : []) } }, select: { projectId: true, status: true, scheduledAt: true, error: true } });
    return NextResponse.json({ runs: runs.map(run => ({ ...run, post: posts.find(post => post.projectId === run.videoProjectId) || null })) });
  } catch (error) { return batchFailure(error); }
}

import { NextResponse } from 'next/server';
import { db, getOrCreateUser } from '@/lib/db';
import { buildReelPrompt } from '@/lib/publishing/reels';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getOrCreateUser();
    const project = await db.aIVideoProject.findFirst({
      where: { id, userId: user.id },
      include: { product: { include: { affiliateLinks: { take: 1, orderBy: { createdAt: 'desc' } } } } },
    });
    if (!project) return NextResponse.json({ error: 'Không tìm thấy video.' }, { status: 404 });
    if (project.status !== 'completed' || !project.videoUrl) return NextResponse.json({ error: 'Cần video đã hoàn tất.' }, { status: 400 });
    // Only a local generated asset can be handed to the extension download/upload flow.
    if (!/^\/generated\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.mp4$/.test(project.videoUrl)) {
      return NextResponse.json({ error: 'Luồng Reels cần video MP4 đã lưu trong thư mục generated của ứng dụng.' }, { status: 400 });
    }
    return NextResponse.json({ prompt: buildReelPrompt(project, project.product), videoUrl: project.videoUrl, affiliateUrl: project.product?.affiliateLinks[0]?.affiliateUrl || '' });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Không thể lấy mô tả sản phẩm.' }, { status: 400 });
  }
}

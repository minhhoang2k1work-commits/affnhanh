import path from 'path';
import { NextResponse } from 'next/server';
import { db, getOrCreateUser } from '@/lib/db';
import { isYouTubeConfigured, uploadYouTubeVideo, type YouTubePrivacy } from '@/lib/publishing/youtube';
import { AffiliateLinkService } from '@/lib/affiliate/service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getOrCreateUser();
    const body = await request.json().catch(() => ({}));
    if ((body.platform || 'youtube') !== 'youtube') {
      return NextResponse.json({ error: 'Only YouTube publishing is currently configured.' }, { status: 400 });
    }
    if (!isYouTubeConfigured()) {
      return NextResponse.json({
        error: 'YouTube OAuth is not configured. Add YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET and YOUTUBE_REFRESH_TOKEN.',
      }, { status: 400 });
    }
    const privacyStatus = body.privacyStatus || 'private';
    if (!['private', 'unlisted', 'public'].includes(privacyStatus)) {
      return NextResponse.json({ error: 'Invalid YouTube privacy status.' }, { status: 400 });
    }
    const project = await db.aIVideoProject.findFirst({
      where: { id, userId: user.id },
      include: { product: { include: { affiliateLinks: { take: 1, orderBy: { createdAt: 'desc' } } } } },
    });
    if (!project || project.status !== 'completed' || !project.videoUrl) {
      return NextResponse.json({ error: 'A completed local video is required before publishing.' }, { status: 400 });
    }
    if (!project.videoUrl.startsWith('/generated/')) {
      return NextResponse.json({ error: 'Only locally assembled videos can be published safely.' }, { status: 400 });
    }

    const subId = `YT_${project.id.replace(/-/g, '').slice(0, 16)}`;
    let affiliateUrl = project.product?.affiliateLinks[0]?.affiliateUrl;
    if (project.productId) {
      const trackedLink = await AffiliateLinkService.generateAffiliateLinkForProduct({
        userId: user.id,
        productId: project.productId,
        subId,
      });
      if (trackedLink.affiliateUrl) affiliateUrl = trackedLink.affiliateUrl;
    }
    const generatedRoot = path.resolve(process.cwd(), 'public', 'generated');
    const filePath = path.resolve(process.cwd(), 'public', project.videoUrl.replace(/^\/+/, ''));
    if (!filePath.startsWith(`${generatedRoot}${path.sep}`)) {
      return NextResponse.json({ error: 'Generated video path is outside the allowed directory.' }, { status: 400 });
    }
    const description = [
      body.description || project.productDescription || project.title,
      affiliateUrl ? `\nXem sản phẩm: ${affiliateUrl}` : '',
      '\nNội dung có sử dụng công nghệ AI.',
    ].join('').trim();
    const result = await uploadYouTubeVideo({
      filePath,
      title: body.title || project.title,
      description,
      tags: Array.isArray(body.tags) ? body.tags : ['review', 'affiliate', 'shorts'],
      privacyStatus: privacyStatus as YouTubePrivacy,
      publishAt: body.publishAt,
    });

    const video = await db.video.create({
      data: {
        userId: user.id,
        title: body.title || project.title,
        platform: 'YOUTUBE',
        targetUrl: result.url,
        note: `AI project ${project.id}; privacy=${result.privacyStatus}`,
      },
    });
    if (project.productId && affiliateUrl) {
      await db.videoProduct.create({
        data: { videoId: video.id, productId: project.productId, subId, affiliateUrl },
      });
    }
    return NextResponse.json({ success: true, publication: { ...result, recordId: video.id } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Publishing failed.' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdapter } from '@/lib/adapters';

export async function GET() {
  try {
    const videos = await db.video.findMany({
      include: {
        products: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, videos });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Có lỗi xảy ra.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, platform, productIds, note } = body;

    if (!title || !platform || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: 'Vui lòng nhập tên video, chọn nền tảng và ít nhất 1 sản phẩm.' }, { status: 400 });
    }

    let user = await db.user.findFirst();
    if (!user) {
      user = await db.user.create({
        data: { email: 'creator@affhub.com', name: 'Affiliate Creator Pro' },
      });
    }

    // Create Video Campaign record
    const video = await db.video.create({
      data: {
        title,
        platform,
        note,
        userId: user.id,
      },
    });

    const videoProducts = [];
    const sanitizeTitle = title.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10).toUpperCase();

    for (let i = 0; i < productIds.length; i++) {
      const prodId = productIds[i];
      const product = await db.product.findUnique({ where: { id: prodId } });
      if (!product) continue;

      // Unique Sub-ID structure: PLATFORM_VIDEOTITLE_INDEX
      const subId = `${platform.toUpperCase()}_${sanitizeTitle}_${(i + 1).toString().padStart(3, '0')}`;

      const adapter = getAdapter(product.platform);
      const affiliateUrl = await adapter.generateAffiliateLink({
        originUrl: product.originalUrl,
        subIds: [subId, 'VIDEO_CAMPAIGN'],
      });

      const vp = await db.videoProduct.create({
        data: {
          videoId: video.id,
          productId: product.id,
          subId,
          affiliateUrl,
        },
        include: {
          product: true,
        },
      });

      videoProducts.push(vp);
    }

    return NextResponse.json({
      success: true,
      video,
      videoProducts,
    });
  } catch (error: any) {
    console.error('Error creating video campaign:', error);
    return NextResponse.json({ error: error?.message || 'Có lỗi xảy ra khi tạo campaign video.' }, { status: 500 });
  }
}

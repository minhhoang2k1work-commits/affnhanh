import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdapter } from '@/lib/adapters';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { productId, subId, subIds } = body;

    if (!productId) {
      return NextResponse.json({ error: 'Thiếu productId' }, { status: 400 });
    }

    const product = await db.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json({ error: 'Không tìm thấy sản phẩm' }, { status: 404 });
    }

    let user = await db.user.findFirst();
    if (!user) {
      user = await db.user.create({
        data: { email: 'creator@affhub.com', name: 'Affiliate Creator Pro' },
      });
    }

    const adapter = getAdapter(product.platform);
    const subList = Array.isArray(subIds) ? subIds : subId ? [subId] : ['HUB_SINGLE_LINK'];

    const affiliateUrl = await adapter.generateAffiliateLink({
      originUrl: product.originalUrl,
      subIds: subList,
    });

    const linkRecord = await db.affiliateLink.create({
      data: {
        userId: user.id,
        productId: product.id,
        originalUrl: product.originalUrl,
        affiliateUrl,
        subId: subList.join('_'),
      },
    });

    return NextResponse.json({
      success: true,
      affiliateUrl,
      subId: subList.join('_'),
      link: linkRecord,
    });
  } catch (error: any) {
    console.error('Error generating link:', error);
    return NextResponse.json({ error: error?.message || 'Có lỗi xảy ra khi tạo link Affiliate.' }, { status: 500 });
  }
}

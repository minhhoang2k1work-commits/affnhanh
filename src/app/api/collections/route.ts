import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const collections = await db.collection.findMany({
      include: {
        products: {
          include: {
            product: {
              include: {
                affiliateLinks: { take: 1 },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, collections });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Có lỗi xảy ra.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, icon, productId, collectionId } = body;

    let user = await db.user.findFirst();
    if (!user) {
      user = await db.user.create({
        data: { email: 'creator@affhub.com', name: 'Affiliate Creator Pro' },
      });
    }

    // Add product to existing collection
    if (collectionId && productId) {
      const item = await db.collectionProduct.upsert({
        where: {
          collectionId_productId: {
            collectionId,
            productId,
          },
        },
        update: {},
        create: {
          collectionId,
          productId,
        },
      });
      return NextResponse.json({ success: true, item });
    }

    // Create new Collection
    if (!name) {
      return NextResponse.json({ error: 'Tên bộ sưu tập không được để trống' }, { status: 400 });
    }

    const collection = await db.collection.create({
      data: {
        name,
        description,
        icon: icon || 'folder',
        userId: user.id,
      },
    });

    if (productId) {
      await db.collectionProduct.create({
        data: {
          collectionId: collection.id,
          productId,
        },
      });
    }

    return NextResponse.json({ success: true, collection });
  } catch (error: any) {
    console.error('Error creating collection:', error);
    return NextResponse.json({ error: error?.message || 'Có lỗi xảy ra.' }, { status: 500 });
  }
}

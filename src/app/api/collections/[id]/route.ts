import { NextRequest, NextResponse } from 'next/server';
import { db, getOrCreateUser } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getOrCreateUser();

    const collection = await db.collection.findFirst({
      where: { id, userId: user.id },
      include: {
        products: {
          include: {
            product: {
              include: {
                affiliateLinks: {
                  where: { userId: user.id },
                  take: 1,
                },
                shop: {
                  select: { id: true, name: true, platform: true },
                },
              },
            },
          },
          orderBy: { addedAt: 'desc' },
        },
      },
    });

    if (!collection) {
      return NextResponse.json({ error: 'Không tìm thấy bộ sưu tập.' }, { status: 404 });
    }

    const items = collection.products.map((cp) => {
      const p = cp.product;
      const affLink = p.affiliateLinks?.[0]?.affiliateUrl || null;
      const estCommission = Math.round((p.salePrice * (p.commissionRate || 0)) / 100);
      return {
        ...p,
        addedAt: cp.addedAt,
        affiliateUrl: affLink,
        estCommission,
      };
    });

    const totalProducts = items.length;
    const totalEstimatedCommission = items.reduce((acc, p) => acc + (p.estCommission || 0), 0);
    const readyAffiliateCount = items.filter((p) => Boolean(p.affiliateUrl)).length;
    const avgScore = totalProducts > 0 
      ? Math.round(items.reduce((acc, p) => acc + (p.affiliateScore || 0), 0) / totalProducts)
      : 0;

    return NextResponse.json({
      success: true,
      collection: {
        id: collection.id,
        name: collection.name,
        description: collection.description,
        icon: collection.icon,
        createdAt: collection.createdAt,
        updatedAt: collection.updatedAt,
        totalProducts,
        totalEstimatedCommission,
        readyAffiliateCount,
        avgScore,
        products: items,
      },
    });
  } catch (error: any) {
    console.error('Error fetching collection detail:', error);
    return NextResponse.json({ error: error?.message || 'Có lỗi xảy ra.' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getOrCreateUser();
    const body = await req.json();
    const { name, description, icon } = body;

    const existing = await db.collection.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Không tìm thấy bộ sưu tập.' }, { status: 404 });
    }

    const updated = await db.collection.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description ? description.trim() : null }),
        ...(icon !== undefined && { icon }),
      },
    });

    return NextResponse.json({ success: true, collection: updated });
  } catch (error: any) {
    console.error('Error updating collection:', error);
    return NextResponse.json({ error: error?.message || 'Có lỗi xảy ra.' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getOrCreateUser();

    const existing = await db.collection.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Không tìm thấy bộ sưu tập.' }, { status: 404 });
    }

    // Delete relation records first
    await db.collectionProduct.deleteMany({
      where: { collectionId: id },
    });

    await db.collection.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting collection:', error);
    return NextResponse.json({ error: error?.message || 'Có lỗi xảy ra.' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db, getOrCreateUser } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: collectionId } = await params;
    const user = await getOrCreateUser();
    const body = await req.json();
    const { productId, productIds } = body;

    const collection = await db.collection.findFirst({
      where: { id: collectionId, userId: user.id },
    });

    if (!collection) {
      return NextResponse.json({ error: 'Không tìm thấy bộ sưu tập.' }, { status: 404 });
    }

    const targetIds: string[] = productIds && Array.isArray(productIds) 
      ? productIds 
      : productId ? [productId] : [];

    if (targetIds.length === 0) {
      return NextResponse.json({ error: 'Chưa chọn sản phẩm nào.' }, { status: 400 });
    }

    await db.collectionProduct.createMany({
      data: targetIds.map((pId) => ({
        collectionId,
        productId: pId,
      })),
      skipDuplicates: true,
    });

    await db.collection.update({
      where: { id: collectionId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ success: true, count: targetIds.length });
  } catch (error: any) {
    console.error('Error adding products to collection:', error);
    return NextResponse.json({ error: error?.message || 'Có lỗi xảy ra.' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: collectionId } = await params;
    const user = await getOrCreateUser();
    const body = await req.json();
    const { productId, productIds } = body;

    const collection = await db.collection.findFirst({
      where: { id: collectionId, userId: user.id },
    });

    if (!collection) {
      return NextResponse.json({ error: 'Không tìm thấy bộ sưu tập.' }, { status: 404 });
    }

    const targetIds: string[] = productIds && Array.isArray(productIds) 
      ? productIds 
      : productId ? [productId] : [];

    if (targetIds.length === 0) {
      return NextResponse.json({ error: 'Chưa chọn sản phẩm để gỡ.' }, { status: 400 });
    }

    await db.collectionProduct.deleteMany({
      where: {
        collectionId,
        productId: { in: targetIds },
      },
    });

    await db.collection.update({
      where: { id: collectionId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ success: true, count: targetIds.length });
  } catch (error: any) {
    console.error('Error removing products from collection:', error);
    return NextResponse.json({ error: error?.message || 'Có lỗi xảy ra.' }, { status: 500 });
  }
}

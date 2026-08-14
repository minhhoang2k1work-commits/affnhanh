import { NextRequest, NextResponse } from 'next/server';
import { db, getOrCreateUser } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser();

    const collections = await db.collection.findMany({
      where: { userId: user.id },
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
                  select: { name: true, platform: true },
                },
              },
            },
          },
          orderBy: { addedAt: 'desc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Compute enriched metadata for each collection
    const enrichedCollections = collections.map((col) => {
      const items = col.products.map((cp) => {
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

      // Extract up to 4 image thumbnails for visual card collage
      const thumbnails = items
        .filter((p) => Boolean(p.image))
        .map((p) => p.image)
        .slice(0, 4);

      return {
        id: col.id,
        name: col.name,
        description: col.description,
        icon: col.icon || 'folder',
        createdAt: col.createdAt,
        updatedAt: col.updatedAt,
        totalProducts,
        totalEstimatedCommission,
        readyAffiliateCount,
        avgScore,
        thumbnails,
        products: items,
      };
    });

    // Global summary statistics
    const totalCollections = enrichedCollections.length;
    const totalCategorizedProducts = enrichedCollections.reduce((acc, c) => acc + c.totalProducts, 0);
    const totalPotentialCommission = enrichedCollections.reduce((acc, c) => acc + c.totalEstimatedCommission, 0);
    const totalReadyLinks = enrichedCollections.reduce((acc, c) => acc + c.readyAffiliateCount, 0);

    return NextResponse.json({
      success: true,
      collections: enrichedCollections,
      stats: {
        totalCollections,
        totalCategorizedProducts,
        totalPotentialCommission,
        totalReadyLinks,
      },
    });
  } catch (error: any) {
    console.error('Error fetching collections:', error);
    return NextResponse.json({ error: error?.message || 'Có lỗi xảy ra khi lấy danh sách bộ sưu tập.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser();
    const body = await req.json();
    const { name, description, icon, productId, productIds } = body;

    // Direct add product to an existing collection
    if (body.collectionId && (productId || (productIds && productIds.length > 0))) {
      const targetIds: string[] = productIds && Array.isArray(productIds) ? productIds : [productId];
      const itemsToCreate = targetIds.map((pId) => ({
        collectionId: body.collectionId,
        productId: pId,
      }));

      await db.collectionProduct.createMany({
        data: itemsToCreate,
        skipDuplicates: true,
      });

      await db.collection.update({
        where: { id: body.collectionId },
        data: { updatedAt: new Date() },
      });

      return NextResponse.json({ success: true, count: targetIds.length });
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Tên bộ sưu tập không được để trống' }, { status: 400 });
    }

    // Create new collection
    const collection = await db.collection.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        icon: icon || '📁',
        userId: user.id,
      },
    });

    // If initial products are provided, attach them
    const initialProductIds: string[] = productIds && Array.isArray(productIds) 
      ? productIds 
      : productId ? [productId] : [];

    if (initialProductIds.length > 0) {
      await db.collectionProduct.createMany({
        data: initialProductIds.map((pId) => ({
          collectionId: collection.id,
          productId: pId,
        })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({ success: true, collection });
  } catch (error: any) {
    console.error('Error creating collection:', error);
    return NextResponse.json({ error: error?.message || 'Có lỗi xảy ra khi tạo bộ sưu tập.' }, { status: 500 });
  }
}

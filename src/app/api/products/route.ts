import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const shopId = searchParams.get('shopId') || '';
    const category = searchParams.get('category') || '';
    const hasAffiliate = searchParams.get('hasAffiliate');
    const minCommission = searchParams.get('minCommission');
    const filterType = searchParams.get('filterType') || ''; // 'viral', 'top_sold', 'high_comm', 'sale'
    const sortBy = searchParams.get('sortBy') || 'score'; // 'score', 'commissionRate', 'sold', 'price_asc', 'price_desc', 'newest'

    const whereClause: any = {};

    if (q) {
      whereClause.OR = [
        { name: { contains: q } },
        { category: { contains: q } },
        { shop: { name: { contains: q } } },
      ];
    }

    if (shopId) {
      whereClause.shopId = shopId;
    }

    if (category) {
      whereClause.category = category;
    }

    if (hasAffiliate !== null && hasAffiliate !== undefined && hasAffiliate !== '') {
      whereClause.hasAffiliate = hasAffiliate === 'true';
    }

    if (minCommission) {
      whereClause.commissionRate = { gte: parseFloat(minCommission) };
    }

    if (filterType === 'viral') {
      whereClause.affiliateScore = { gte: 80 };
    } else if (filterType === 'top_sold') {
      whereClause.sold = { gte: 5000 };
    } else if (filterType === 'high_comm') {
      whereClause.commissionRate = { gte: 10 };
    }

    let orderBy: any = { affiliateScore: 'desc' };

    switch (sortBy) {
      case 'commissionRate':
        orderBy = { commissionRate: 'desc' };
        break;
      case 'sold':
        orderBy = { sold: 'desc' };
        break;
      case 'price_asc':
        orderBy = { salePrice: 'asc' };
        break;
      case 'price_desc':
        orderBy = { salePrice: 'desc' };
        break;
      case 'newest':
        orderBy = { createdAt: 'desc' };
        break;
      default:
        orderBy = { affiliateScore: 'desc' };
        break;
    }

    const products = await db.product.findMany({
      where: whereClause,
      include: {
        shop: {
          select: { id: true, name: true, logo: true, platform: true, externalShopId: true },
        },
        affiliateLinks: {
          take: 1,
          select: { affiliateUrl: true, subId: true },
        },
      },
      orderBy,
    });

    const totalCount = await db.product.count({ where: whereClause });
    const affCount = await db.product.count({ where: { ...whereClause, hasAffiliate: true } });

    return NextResponse.json({
      success: true,
      totalCount,
      affCount,
      nonAffCount: totalCount - affCount,
      products: products.map((p) => ({
        ...p,
        affiliateUrl: p.affiliateLinks[0]?.affiliateUrl || null,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: error?.message || 'Có lỗi xảy ra khi lấy danh sách sản phẩm.' }, { status: 500 });
  }
}

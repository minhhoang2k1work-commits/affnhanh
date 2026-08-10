import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const minCommission = searchParams.get('minCommission');
    const filterType = searchParams.get('filterType') || 'all';
    const sortBy = searchParams.get('sortBy') || 'score';

    const shop = await db.shop.findUnique({
      where: { id },
    });

    if (!shop) {
      return NextResponse.json({ error: 'Không tìm thấy Shop' }, { status: 404 });
    }

    const whereClause: any = {
      shopId: shop.id,
      isActive: true,
    };

    if (q) {
      whereClause.OR = [
        { name: { contains: q } },
        { category: { contains: q } },
        { externalProductId: { contains: q } },
      ];
    }

    if (minCommission) {
      whereClause.commissionRate = { gte: parseFloat(minCommission) };
    }

    if (filterType === 'eligible') {
      whereClause.hasAffiliate = true;
    } else if (filterType === 'not_eligible') {
      whereClause.hasAffiliate = false;
    } else if (filterType === 'comm_5') {
      whereClause.commissionRate = { gte: 5.0 };
    } else if (filterType === 'comm_10') {
      whereClause.commissionRate = { gte: 10.0 };
    } else if (filterType === 'comm_15') {
      whereClause.commissionRate = { gte: 15.0 };
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
      default:
        orderBy = { affiliateScore: 'desc' };
        break;
    }

    const products = await db.product.findMany({
      where: whereClause,
      include: {
        affiliateLinks: { take: 1 },
      },
      orderBy,
    });

    // Calculate max commission rate in this shop
    const maxCommResult = await db.product.findFirst({
      where: { shopId: shop.id, hasAffiliate: true },
      orderBy: { commissionRate: 'desc' },
      select: { commissionRate: true },
    });

    return NextResponse.json({
      success: true,
      shop: {
        ...shop,
        maxCommissionRate: maxCommResult?.commissionRate || 0,
      },
      products: products.map((p) => ({
        ...p,
        affiliateUrl: p.affiliateLinks[0]?.affiliateUrl || null,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching shop products:', error);
    return NextResponse.json({ error: error?.message || 'Có lỗi xảy ra khi lấy danh sách sản phẩm.' }, { status: 500 });
  }
}

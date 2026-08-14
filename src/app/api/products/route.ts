import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sanitizePrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const shopId = searchParams.get('shopId') || '';
    const category = searchParams.get('category') || '';
    const hasAffiliate = searchParams.get('hasAffiliate');
    const affiliateStatus = searchParams.get('affiliateStatus') || 'all'; // 'all', 'ready', 'pending'
    const minCommission = searchParams.get('minCommission');
    const maxCommission = searchParams.get('maxCommission');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const minSold = searchParams.get('minSold');
    const maxSold = searchParams.get('maxSold');
    const filterType = searchParams.get('filterType') || ''; // 'viral', 'top_sold', 'high_comm', 'sale'
    const sortBy = searchParams.get('sortBy') || 'score'; // 'score', 'commissionRate', 'sold', 'price_asc', 'price_desc', 'newest', 'category'
    const targetCustomer = searchParams.get('targetCustomer') || '';

    const whereClause: any = {};

    if (q) {
      whereClause.OR = [
        { name: { contains: q } },
        { category: { contains: q } },
        { externalProductId: { contains: q } },
        { shop: { name: { contains: q } } },
      ];
    }

    if (shopId && shopId !== 'all') {
      whereClause.shopId = shopId;
    }

    if (category) {
      whereClause.category = category;
    }

    if (targetCustomer) {
      whereClause.targetCustomer = targetCustomer;
    }

    if (hasAffiliate !== null && hasAffiliate !== undefined && hasAffiliate !== '') {
      whereClause.hasAffiliate = hasAffiliate === 'true';
    }

    if (affiliateStatus === 'ready') {
      whereClause.affiliateLinks = { some: {} };
    } else if (affiliateStatus === 'pending') {
      whereClause.affiliateLinks = { none: {} };
    }

    // Price range filtering
    if (minPrice || maxPrice) {
      whereClause.salePrice = {};
      if (minPrice) whereClause.salePrice.gte = parseFloat(minPrice);
      if (maxPrice) whereClause.salePrice.lte = parseFloat(maxPrice);
    }

    // Sold range filtering
    if (minSold || maxSold) {
      whereClause.sold = {};
      if (minSold) whereClause.sold.gte = parseInt(minSold, 10);
      if (maxSold) whereClause.sold.lte = parseInt(maxSold, 10);
    }

    // Commission rate range filtering
    if (minCommission || maxCommission) {
      whereClause.commissionRate = {};
      if (minCommission) whereClause.commissionRate.gte = parseFloat(minCommission);
      if (maxCommission) whereClause.commissionRate.lte = parseFloat(maxCommission);
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
      case 'category':
        orderBy = { category: 'asc' };
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

    const shops = await db.shop.findMany({
      select: { id: true, name: true, logo: true, platform: true, externalShopId: true },
      orderBy: { name: 'asc' },
    });

    const totalCount = await db.product.count({ where: whereClause });
    const affCount = await db.product.count({ where: { ...whereClause, hasAffiliate: true } });

    // Distinct categories and target customers for filter dropdowns
    const allProducts = await db.product.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ['category'],
    });
    const distinctCategories = allProducts
      .map(p => p.category)
      .filter((c): c is string => c !== null && c.trim() !== '')
      .sort();

    const allTargetCustomers = await db.product.findMany({
      where: { targetCustomer: { not: null } },
      select: { targetCustomer: true },
      distinct: ['targetCustomer'],
    });
    const distinctTargetCustomers = allTargetCustomers
      .map(p => p.targetCustomer)
      .filter((c): c is string => c !== null && c.trim() !== '')
      .sort();

    return NextResponse.json({
      success: true,
      totalCount,
      affCount,
      nonAffCount: totalCount - affCount,
      shops,
      distinctCategories,
      distinctTargetCustomers,
      products: products.map((p) => {
        const cleanPrice = sanitizePrice(p.price);
        const cleanSalePrice = sanitizePrice(p.salePrice);
        const cleanEstComm = Math.round((cleanSalePrice * p.commissionRate) / 100);
        return {
          ...p,
          price: cleanPrice,
          salePrice: cleanSalePrice,
          estCommission: cleanEstComm > 0 ? cleanEstComm : p.estCommission,
          affiliateUrl: p.affiliateLinks[0]?.affiliateUrl || null,
        };
      }),
    });
  } catch (error: any) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: error?.message || 'Có lỗi xảy ra khi lấy danh sách sản phẩm.' }, { status: 500 });
  }
}

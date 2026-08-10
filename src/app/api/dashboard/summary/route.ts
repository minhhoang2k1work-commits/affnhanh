import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let user = await db.user.findFirst();
    if (!user) {
      user = await db.user.create({
        data: { email: 'creator@affhub.com', name: 'Affiliate Creator Pro' },
      });
    }

    // Real Database Queries (Section 9)
    const totalProducts = await db.product.count({
      where: { userId: user.id, isActive: true },
    });

    const totalShops = await db.shop.count({
      where: { userId: user.id, isActive: true },
    });

    const affiliateProducts = await db.product.count({
      where: { userId: user.id, isActive: true, hasAffiliate: true },
    });

    const unsupportedProducts = await db.product.count({
      where: { userId: user.id, isActive: true, hasAffiliate: false },
    });

    const totalLinksCreated = await db.affiliateLink.count({
      where: { userId: user.id },
    });

    const defaultAffAccount = await db.affiliateAccount.findFirst({
      where: { userId: user.id, isDefault: true },
    });

    // Section 13 & 14: Return null for un-integrated reporting sources
    return NextResponse.json({
      success: true,
      summary: {
        totalProducts,
        totalShops,
        affiliateProducts,
        unsupportedProducts,
        totalLinksCreated,
        clicks: null,      // null = chưa có nguồn dữ liệu báo cáo click
        orders: null,      // null = chưa có nguồn dữ liệu báo cáo đơn hàng
        commission: null,  // null = chưa có nguồn dữ liệu báo cáo hoa hồng
      },
      integrationStatus: {
        shopeeProductApi: { connected: true, name: 'Shopee Product API' },
        affiliateDeepLink: {
          connected: Boolean(defaultAffAccount),
          name: 'Affiliate Deep Link Engine',
          accountName: defaultAffAccount?.accountName || null,
        },
        clickReporting: { connected: false, name: 'Click Report API' },
        orderReporting: { connected: false, name: 'Conversion & Order Report API' },
      },
    });
  } catch (error: any) {
    console.error('Error fetching dashboard summary:', error);
    return NextResponse.json({ error: error?.message || 'Có lỗi xảy ra.' }, { status: 500 });
  }
}

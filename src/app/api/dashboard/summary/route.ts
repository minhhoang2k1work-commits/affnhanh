import { NextResponse } from 'next/server';
import { db, getOrCreateUser } from '@/lib/db';
import { AccesstradeService } from '@/lib/providers/accesstradeService';

export const dynamic = 'force-dynamic';

function asNumber(value: unknown): number {
  const parsed = typeof value === 'string'
    ? Number(value.replace(/,/g, ''))
    : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getCommission(order: Record<string, unknown>): number {
  const value = order.commission
    ?? order.commission_pub
    ?? order.pub_commission
    ?? order.publisher_commission
    ?? 0;
  return asNumber(value);
}

export async function GET() {
  try {
    const user = await getOrCreateUser();
    const [
      totalProducts,
      totalShops,
      affiliateProducts,
      unsupportedProducts,
      totalLinksCreated,
      defaultAffAccount,
      reportingAccount,
    ] = await Promise.all([
      db.product.count({ where: { userId: user.id, isActive: true } }),
      db.shop.count({ where: { userId: user.id, isActive: true } }),
      db.product.count({ where: { userId: user.id, isActive: true, hasAffiliate: true } }),
      db.product.count({ where: { userId: user.id, isActive: true, hasAffiliate: false } }),
      db.affiliateLink.count({ where: { userId: user.id } }),
      db.affiliateAccount.findFirst({ where: { userId: user.id, isDefault: true } }),
      db.affiliateAccount.findFirst({
        where: { userId: user.id, platform: 'ACCESSTRADE', status: 'ACTIVE' },
        select: { id: true },
      }),
    ]);

    let orders: number | null = null;
    let commission: number | null = null;
    let reportingError: string | null = null;
    if (reportingAccount) {
      try {
        const until = new Date();
        const since = new Date(until.getTime() - 30 * 24 * 60 * 60 * 1000);
        const apiKey = await AccesstradeService.getActiveApiKey(user.id);
        const reportRows: Record<string, unknown>[] = [];
        let page = 1;
        let totalPages = 1;
        do {
          const result = await AccesstradeService.getAdapter().getOrders(apiKey, {
            page,
            limit: 100,
            since: since.toISOString(),
            until: until.toISOString(),
          });
          if (Array.isArray(result.data)) reportRows.push(...result.data as Record<string, unknown>[]);
          totalPages = Math.min(Math.max(asNumber(result.total_page), 1), 10);
          page += 1;
        } while (page <= totalPages);
        orders = reportRows.length;
        commission = reportRows.reduce((sum, order) => sum + getCommission(order), 0);
      } catch (error) {
        reportingError = error instanceof Error ? error.message : 'AccessTrade reporting failed.';
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalProducts,
        totalShops,
        affiliateProducts,
        unsupportedProducts,
        totalLinksCreated,
        clicks: null,
        orders,
        commission,
      },
      reportingPeriodDays: 30,
      reportingError,
      integrationStatus: {
        shopeeProductApi: { connected: true, name: 'Shopee Product API' },
        affiliateDeepLink: {
          connected: Boolean(defaultAffAccount),
          name: 'Affiliate Deep Link Engine',
          accountName: defaultAffAccount?.accountName || null,
        },
        clickReporting: { connected: false, name: 'Click Report API' },
        orderReporting: {
          connected: Boolean(reportingAccount) && !reportingError,
          configured: Boolean(reportingAccount),
          name: 'AccessTrade Conversion & Order Report API',
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể tải tổng quan.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

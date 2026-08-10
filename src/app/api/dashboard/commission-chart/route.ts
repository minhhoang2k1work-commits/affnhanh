import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const range = searchParams.get('range') || '7d';

    let user = await db.user.findFirst();
    if (!user) {
      return NextResponse.json({ hasData: false, data: [], message: 'Chưa có dữ liệu hoa hồng trong 7 ngày qua.' });
    }

    const daysCount = range === '30d' ? 30 : 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysCount);

    const links = await db.affiliateLink.findMany({
      where: {
        userId: user.id,
        createdAt: { gte: startDate },
      },
      select: {
        totalCommission: true,
        clickCount: true,
        createdAt: true,
      },
    });

    if (links.length === 0) {
      return NextResponse.json({
        hasData: false,
        data: [],
        message: `Chưa có dữ liệu hoa hồng trong ${daysCount} ngày qua.`,
      });
    }

    // Group links by day
    const chartMap: Record<string, { day: string; commission: number; clicks: number }> = {};
    for (const link of links) {
      const dayStr = new Date(link.createdAt).toLocaleDateString('vi-VN', { weekday: 'short' });
      if (!chartMap[dayStr]) {
        chartMap[dayStr] = { day: dayStr, commission: 0, clicks: 0 };
      }
      chartMap[dayStr].commission += link.totalCommission || 0;
      chartMap[dayStr].clicks += link.clickCount || 0;
    }

    const chartData = Object.values(chartMap);

    return NextResponse.json({
      hasData: true,
      data: chartData,
    });
  } catch (error: any) {
    console.error('Error fetching commission chart:', error);
    return NextResponse.json({ hasData: false, data: [], message: 'Có lỗi xảy ra khi lấy dữ liệu biểu đồ.' });
  }
}

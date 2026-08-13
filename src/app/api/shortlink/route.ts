import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateShopeeShortlink } from '@/lib/affiliate/shopee-shortlink';

/**
 * POST /api/shortlink
 * 
 * Generate a Shopee affiliate short link and optionally persist it to the database.
 * 
 * Body: { targetUrl, affiliateId, subId?, saveToDB? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { targetUrl, affiliateId, subId, saveToDB = false } = body;

    if (!targetUrl || !affiliateId) {
      return NextResponse.json(
        { error: 'Thiếu targetUrl hoặc affiliateId.' },
        { status: 400 }
      );
    }

    const result = generateShopeeShortlink({ targetUrl, affiliateId, subId });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    let savedLink = null;

    if (saveToDB && result.affiliateUrl) {
      try {
        // Get or create default user
        let user = await db.user.findFirst();
        if (!user) {
          user = await db.user.create({
            data: { email: 'creator@affhub.com', name: 'Affiliate Creator Pro' },
          });
        }

        savedLink = await db.affiliateLink.create({
          data: {
            userId: user.id,
            productId: 'shortlink-generator', // Placeholder — not tied to a specific product
            originalUrl: targetUrl,
            affiliateUrl: result.affiliateUrl,
            subId: subId || null,
            dataSource: 'shortlink-generator',
          },
        });
      } catch (dbError: any) {
        // DB save failure shouldn't block the response
        console.warn('Failed to save shortlink to DB:', dbError?.message);
      }
    }

    return NextResponse.json({
      success: true,
      affiliateUrl: result.affiliateUrl,
      originalUrl: result.originalUrl,
      savedLink,
    });
  } catch (error: any) {
    console.error('Error in /api/shortlink:', error);
    return NextResponse.json(
      { error: error?.message || 'Có lỗi xảy ra khi tạo link.' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AffiliateLinkService } from '@/lib/affiliate/service';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json().catch(() => ({}));
    const { subId = 'HUB_SINGLE_LINK' } = body;

    let user = await db.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: 'Chưa xác thực người dùng.' }, { status: 401 });
    }

    const result = await AffiliateLinkService.generateAffiliateLinkForProduct({
      userId: user.id,
      productId: id,
      subId,
    });

    if (result.status === 'pending_configuration') {
      return NextResponse.json(
        {
          error: result.errorMessage,
          status: 'pending_configuration',
        },
        { status: 400 }
      );
    }

    if (result.status === 'failed') {
      return NextResponse.json(
        {
          error: result.errorMessage || 'Không thể tạo link Affiliate.',
          status: 'failed',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      status: result.status,
      affiliateUrl: result.affiliateUrl,
    });
  } catch (error: any) {
    console.error('Error generating product affiliate link:', error);
    return NextResponse.json({ error: error?.message || 'Có lỗi xảy ra.' }, { status: 500 });
  }
}

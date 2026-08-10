import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { encryptText, decryptText } from '@/lib/crypto';

export async function GET() {
  try {
    const accounts = await db.affiliateAccount.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      accounts: accounts.map((acc) => ({
        id: acc.id,
        platform: acc.platform,
        accountName: acc.accountName,
        appId: acc.appId,
        appSecretMasked: acc.appSecretEnc ? '••••••••••••' + acc.appSecretEnc.slice(-4) : '',
        isDefault: acc.isDefault,
        status: acc.status,
        createdAt: acc.createdAt,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Có lỗi xảy ra.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { platform, accountName, appId, appSecret, isDefault } = body;

    if (!platform || !accountName || !appId || !appSecret) {
      return NextResponse.json({ error: 'Vui lòng điền đầy đủ Platform, Tên tài khoản, App ID và App Secret.' }, { status: 400 });
    }

    let user = await db.user.findFirst();
    if (!user) {
      user = await db.user.create({
        data: { email: 'creator@affhub.com', name: 'Affiliate Creator Pro' },
      });
    }

    if (isDefault) {
      // Unset other default accounts for same platform
      await db.affiliateAccount.updateMany({
        where: { userId: user.id, platform },
        data: { isDefault: false },
      });
    }

    // Encrypt App Secret before storing in DB
    const appSecretEnc = encryptText(appSecret);

    const account = await db.affiliateAccount.create({
      data: {
        userId: user.id,
        platform,
        accountName,
        appId,
        appSecretEnc,
        isDefault: Boolean(isDefault),
        status: 'ACTIVE',
      },
    });

    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        platform: account.platform,
        accountName: account.accountName,
        appId: account.appId,
        appSecretMasked: '••••••••••••' + appSecret.slice(-4),
        isDefault: account.isDefault,
        status: account.status,
      },
    });
  } catch (error: any) {
    console.error('Error saving affiliate account:', error);
    return NextResponse.json({ error: error?.message || 'Có lỗi xảy ra khi lưu tài khoản.' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { decryptText } from '@/lib/crypto';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accountId, appId, appSecret } = body;

    let targetAppId = appId;
    let targetAppSecret = appSecret;

    if (accountId) {
      const acc = await db.affiliateAccount.findUnique({ where: { id: accountId } });
      if (!acc) return NextResponse.json({ error: 'Không tìm thấy tài khoản.' }, { status: 404 });
      
      if (acc.platform === 'ACCESSTRADE') {
        const apiKey = decryptText(acc.appSecretEnc) || acc.appSecretEnc;
        const testRes = await fetch('https://api.accesstrade.vn/v1/campaigns?limit=1', {
          headers: { 'Authorization': `token ${apiKey}` }
        });
        if (testRes.ok) {
          return NextResponse.json({
            success: true,
            message: 'Kết nối thành công! Accesstrade Open API đã xác thực API Key.',
          });
        } else {
          return NextResponse.json({
            success: false,
            error: 'Xác thực API Key Accesstrade thất bại.',
          }, { status: 400 });
        }
      }

      targetAppId = acc.appId;
      targetAppSecret = decryptText(acc.appSecretEnc);
    }

    if (!targetAppId || !targetAppSecret) {
      return NextResponse.json({ error: 'Thiếu App ID hoặc App Secret' }, { status: 400 });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const query = `
      query TestConnection {
        __typename
      }
    `;
    const payloadStr = JSON.stringify({ query });

    // HMAC-SHA256 Signature calculation according to Shopee Affiliate Open API rules
    const baseStr = `${targetAppId}${timestamp}${payloadStr}`;
    const signature = crypto
      .createHmac('sha256', targetAppSecret)
      .update(baseStr)
      .digest('hex');

    const res = await fetch('https://open-api.affiliate.shopee.vn/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `SHA256 Credential=${targetAppId}, Signature=${signature}, Timestamp=${timestamp}`,
      },
      body: payloadStr,
    });

    const resText = await res.text();
    let resJson;
    try {
      resJson = JSON.parse(resText);
    } catch {
      resJson = null;
    }

    if (res.ok && resJson && !resJson.errors) {
      return NextResponse.json({
        success: true,
        message: 'Kết nối thành công! Shopee Affiliate Open API đã xác thực credentials.',
        apiResponse: resJson,
      });
    }

    const errorMsg = resJson?.errors?.[0]?.message || resJson?.message || `Xác thực thất bại (HTTP ${res.status}). Vui lòng kiểm tra lại App ID & App Secret.`;

    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
        status: res.status,
      },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error testing connection:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Có lỗi khi thử kết nối Shopee API.' }, { status: 500 });
  }
}

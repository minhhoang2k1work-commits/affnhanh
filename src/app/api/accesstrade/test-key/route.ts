import { NextRequest, NextResponse } from 'next/server';
import { AccesstradeService } from '@/lib/providers/accesstradeService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const apiKey = body.apiKey || (await AccesstradeService.getActiveApiKey());

    const adapter = AccesstradeService.getAdapter();
    const result = await adapter.testApiKey(apiKey);

    if (result.success && body.save) {
      await AccesstradeService.saveApiKey(apiKey);
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Lỗi xác minh API Key.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const activeKey = await AccesstradeService.getActiveApiKey();
    const adapter = AccesstradeService.getAdapter();
    const result = await adapter.testApiKey(activeKey);

    return NextResponse.json({
      activeKeyMasked: activeKey ? `${activeKey.slice(0, 6)}...${activeKey.slice(-4)}` : 'Chưa thiết lập',
      connected: result.success,
      message: result.message,
    });
  } catch (err: any) {
    return NextResponse.json({ connected: false, message: err?.message || 'Lỗi kết nối.' });
  }
}

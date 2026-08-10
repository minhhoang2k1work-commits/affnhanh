import { NextRequest, NextResponse } from 'next/server';
import { ShopeeAdapter } from '@/lib/adapters/shopee';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const adapter = new ShopeeAdapter();
    const shopUrl = 'https://shopee.vn/locknlock_official_store';
    
    const resolved = await adapter.resolveUrl(shopUrl);
    const shopInfo = await adapter.getShop(resolved.shopId || 'locknlock_official_store');
    
    let products: any[] = [];
    try {
      products = await adapter.getProducts(shopInfo.externalShopId, 5);
    } catch (err: any) {
      if (err?.message?.includes('SHOPEE_PRODUCT_INTEGRATION_NOT_CONFIGURED')) {
        return NextResponse.json({
          success: false,
          status: 'NOT_CONFIGURED',
          code: 'SHOPEE_PRODUCT_INTEGRATION_NOT_CONFIGURED',
          error: err.message,
          shopInfo,
        }, { status: 400 });
      }
      throw err;
    }

    return NextResponse.json({
      success: true,
      status: 'CONNECTED',
      message: 'Shopee Product Integration hoạt động bình thường!',
      shopInfo,
      sampleProductCount: products.length,
      sampleProduct: products[0] || null,
      metadata: products[0]?.metadata || shopInfo.metadata,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      status: 'ERROR',
      error: error?.message || 'Có lỗi khi kiểm tra Shopee Product API.',
    }, { status: 500 });
  }
}

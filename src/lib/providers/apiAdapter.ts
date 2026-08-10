import { ShopeeAffiliateProvider, ProviderStatus, GenerateLinkOptions, AffiliateLinkResult } from './base';
import { ShopeeAdapter } from '../adapters/shopee';
import { ShopeeAffiliateAdapter } from '../adapters/shopeeAffiliate';
import { ProductInfo, ShopInfo } from '../adapters/base';
import { db } from '@/lib/db';
import { decryptText } from '@/lib/crypto';

export class ShopeeApiAdapter implements ShopeeAffiliateProvider {
  providerType: 'API' = 'API';
  private shopeeAdapter = new ShopeeAdapter();
  private shopeeAffiliateAdapter = new ShopeeAffiliateAdapter();

  async getStatus(userId?: string): Promise<ProviderStatus> {
    const acc = await db.affiliateAccount.findFirst({
      where: { platform: 'SHOPEE', isDefault: true },
    });

    if (acc) {
      return {
        providerName: 'Shopee Official API',
        connected: true,
        status: 'CONNECTED',
        message: 'Shopee Open API Credentials đã kết nối.',
      };
    }

    return {
      providerName: 'Shopee Official API',
      connected: false,
      status: 'UNAVAILABLE',
      message: 'Shopee Open API chưa được cấu hình Credentials.',
    };
  }

  async getProductsFromShop(shopUrl: string, limit: number = 30): Promise<{ shopInfo: ShopInfo; products: ProductInfo[] }> {
    const resolved = await this.shopeeAdapter.resolveUrl(shopUrl);
    const shopInfo = await this.shopeeAdapter.getShop(resolved.shopId || shopUrl);
    const products = await this.shopeeAdapter.getProducts(shopInfo.externalShopId, limit);

    return { shopInfo, products };
  }

  async generateAffiliateLink(productUrl: string, options?: GenerateLinkOptions): Promise<AffiliateLinkResult> {
    const acc = await db.affiliateAccount.findFirst({
      where: { platform: 'SHOPEE', isDefault: true },
    });

    if (!acc) {
      return {
        success: false,
        error: 'Chưa cấu hình tài khoản Shopee Affiliate API.',
        code: 'SHOPEE_AUTH_REQUIRED',
        dataSource: 'api',
      };
    }

    const appSecret = decryptText(acc.appSecretEnc);
    const res = await this.shopeeAffiliateAdapter.generateAffiliateLink({
      originUrl: productUrl,
      subIds: options?.subIds,
      credentials: { appId: acc.appId, appSecret },
    });

    if (res.success && res.affiliateUrl) {
      return {
        success: true,
        affiliateUrl: res.affiliateUrl,
        dataSource: 'api',
      };
    }

    return {
      success: false,
      error: res.error || 'Lỗi sinh link từ Shopee Affiliate API.',
      code: 'SHOPEE_LINK_GENERATION_FAILED',
      dataSource: 'api',
    };
  }
}

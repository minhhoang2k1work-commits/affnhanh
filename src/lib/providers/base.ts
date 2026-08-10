import { ProductInfo, ShopInfo } from '../adapters/base';

export interface ProviderStatus {
  providerName: string;
  connected: boolean;
  status: 'CONNECTED' | 'DISCONNECTED' | 'EXPIRED' | 'VERIFICATION_REQUIRED' | 'UNAVAILABLE';
  message: string;
}

export interface GenerateLinkOptions {
  subIds?: string[];
  userId?: string;
}

export interface AffiliateLinkResult {
  success: boolean;
  affiliateUrl?: string;
  error?: string;
  code?: string;
  dataSource: 'api' | 'browser';
}

export interface ShopeeAffiliateProvider {
  providerType: 'API' | 'BROWSER';
  
  getStatus(userId?: string): Promise<ProviderStatus>;

  getProductsFromShop(
    shopUrl: string,
    limit?: number
  ): Promise<{ shopInfo: ShopInfo; products: ProductInfo[] }>;

  generateAffiliateLink(
    productUrl: string,
    options?: GenerateLinkOptions
  ): Promise<AffiliateLinkResult>;
}

import { ShopeeAffiliateProvider, ProviderStatus, GenerateLinkOptions, AffiliateLinkResult } from './base';
import { ShopeeApiAdapter } from './apiAdapter';
import { ShopeeBrowserAdapter } from './browserAdapter';
import { ProductInfo, ShopInfo } from '../adapters/base';

export class ShopeeService {
  private static instance: ShopeeService;
  private apiAdapter = new ShopeeApiAdapter();
  private browserAdapter = new ShopeeBrowserAdapter();

  public static getInstance(): ShopeeService {
    if (!ShopeeService.instance) {
      ShopeeService.instance = new ShopeeService();
    }
    return ShopeeService.instance;
  }

  /**
   * Section 2 & 30: Provider Priority Evaluator
   * Official API -> Browser Automation
   */
  async selectActiveProvider(userId?: string): Promise<{ provider: ShopeeAffiliateProvider; status: ProviderStatus }> {
    const providerConfig = process.env.SHOPEE_PROVIDER || 'auto';

    if (providerConfig === 'api') {
      const status = await this.apiAdapter.getStatus(userId);
      return { provider: this.apiAdapter, status };
    }

    if (providerConfig === 'browser') {
      const status = await this.browserAdapter.getStatus(userId);
      return { provider: this.browserAdapter, status };
    }

    // Auto Mode: API connected -> API; else Browser connected -> Browser
    const apiStatus = await this.apiAdapter.getStatus(userId);
    if (apiStatus.connected) {
      return { provider: this.apiAdapter, status: apiStatus };
    }

    const browserStatus = await this.browserAdapter.getStatus(userId);
    if (browserStatus.connected) {
      return { provider: this.browserAdapter, status: browserStatus };
    }

    // Fallback: Neither API nor Browser connected
    // Extension Web Dashboard mode will handle via ExtensionJob queue
    return {
      provider: this.apiAdapter,
      status: {
        ...apiStatus,
        message: apiStatus.message + ' Extension sẽ tạo link qua Web Dashboard (affiliate.shopee.vn).',
      },
    };
  }

  async getProductsFromShop(shopUrl: string, userId?: string, limit?: number): Promise<{ shopInfo: ShopInfo; products: ProductInfo[]; activeProvider: string }> {
    const { provider } = await this.selectActiveProvider(userId);
    const result = await provider.getProductsFromShop(shopUrl, limit);
    return { ...result, activeProvider: provider.providerType };
  }

  async generateAffiliateLink(productUrl: string, options?: GenerateLinkOptions): Promise<AffiliateLinkResult> {
    const { provider } = await this.selectActiveProvider(options?.userId);
    return await provider.generateAffiliateLink(productUrl, options);
  }
}

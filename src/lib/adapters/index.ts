import { MarketplaceAdapter } from './base';
import { ShopeeAdapter } from './shopee';

const adapters: Record<string, MarketplaceAdapter> = {
  SHOPEE: new ShopeeAdapter(),
};

export function getAdapter(platform: string = 'SHOPEE'): MarketplaceAdapter {
  const normalized = platform.toUpperCase();
  const adapter = adapters[normalized];
  if (!adapter) {
    // Default to Shopee adapter for unrecognized platforms
    return adapters.SHOPEE;
  }
  return adapter;
}

export * from './base';
export * from './shopee';

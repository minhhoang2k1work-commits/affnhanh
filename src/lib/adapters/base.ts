export interface ResolvedUrlResult {
  platform: 'SHOPEE' | 'TIKTOK' | 'LAZADA' | 'UNKNOWN';
  type: 'SHOP' | 'PRODUCT' | 'UNKNOWN';
  shopId?: string;
  productId?: string;
  canonicalUrl: string;
}

export interface ShopInfo {
  platform: string;
  externalShopId: string;
  name: string;
  logo: string;
  shopUrl: string;
  productCount: number;
}

export interface ProductInfo {
  platform: string;
  externalShopId: string;
  externalProductId: string;
  name: string;
  image: string;
  price: number;
  salePrice: number;
  sold: number;
  rating: number;
  stock: number;
  originalUrl: string;
  category?: string;
  hasAffiliate: boolean;
  commissionRate: number; // e.g. 5.5 (%)
  estCommission: number; // e.g. 15000 (VND)
  affiliateScore: number;
}

export interface GenerateAffiliateLinkInput {
  originUrl: string;
  subIds?: string[];
  credentials?: {
    appId: string;
    appSecret: string;
  };
}

export interface MarketplaceAdapter {
  platformCode: string;
  platformName: string;
  
  resolveUrl(url: string): Promise<ResolvedUrlResult>;
  getShop(shopIdentifier: string): Promise<ShopInfo>;
  getProducts(shopId: string, limit?: number): Promise<ProductInfo[]>;
  getProductDetail(productId: string, shopId: string): Promise<ProductInfo | null>;
  generateAffiliateLink(input: GenerateAffiliateLinkInput): Promise<string>;
}

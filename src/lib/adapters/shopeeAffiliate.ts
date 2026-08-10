import crypto from 'crypto';

export interface AffiliateCommissionResult {
  available: boolean;
  baseRate: number;
  extraRate: number;
  totalRate: number;
  source: string;
  updatedAt: Date;
}

export interface GenerateLinkOptions {
  originUrl: string;
  subIds?: string[];
  credentials?: {
    appId: string;
    appSecret: string;
  };
}

export class ShopeeAffiliateAdapter {
  platformCode = 'SHOPEE';
  platformName = 'Shopee Affiliate Program';

  /**
   * Section 5: Official Shopee Affiliate GraphQL Deep Link Generation
   */
  async generateAffiliateLink(options: GenerateLinkOptions): Promise<{ success: boolean; affiliateUrl?: string; error?: string }> {
    const { originUrl, subIds = [], credentials } = options;

    if (!credentials?.appId || !credentials?.appSecret) {
      return {
        success: false,
        error: 'BLOCKED BY SHOPEE API/PERMISSION: Tài khoản Shopee Affiliate chưa được cấu hình. Vui lòng thêm App ID & App Secret.',
      };
    }

    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const query = `
        mutation GenerateLink($input: GenerateShortLinkInput!) {
          generateShortLink(input: $input) {
            shortLink
            originUrl
          }
        }
      `;
      const variables = {
        input: {
          originUrl,
          subIds,
        },
      };
      const payloadStr = JSON.stringify({ query, variables });

      // HMAC-SHA256 Signature calculation
      const baseStr = `${credentials.appId}${timestamp}${payloadStr}`;
      const signature = crypto
        .createHmac('sha256', credentials.appSecret)
        .update(baseStr)
        .digest('hex');

      const response = await fetch('https://open-api.affiliate.shopee.vn/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `SHA256 Credential=${credentials.appId}, Signature=${signature}, Timestamp=${timestamp}`,
        },
        body: payloadStr,
      });

      if (response.ok) {
        const resData = await response.json();
        const shortLink = resData?.data?.generateShortLink?.shortLink;
        if (shortLink) {
          return { success: true, affiliateUrl: shortLink };
        }
        if (resData?.errors?.[0]?.message) {
          return { success: false, error: resData.errors[0].message };
        }
      }

      return {
        success: false,
        error: `Shopee Affiliate API trả về lỗi HTTP ${response.status}.`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Có lỗi kết nối tới Shopee Affiliate API.',
      };
    }
  }

  /**
   * Section 6: Real Commission Query from Shopee Affiliate Offer API
   */
  async getProductCommission(productId: string, credentials?: { appId: string; appSecret: string }): Promise<AffiliateCommissionResult> {
    if (credentials?.appId && credentials?.appSecret) {
      try {
        const timestamp = Math.floor(Date.now() / 1000);
        const query = `
          query GetItemOffer($itemId: String!) {
            itemOffer(itemId: $itemId) {
              itemId
              commissionRate
              extraCommissionRate
            }
          }
        `;
        const variables = { itemId: productId };
        const payloadStr = JSON.stringify({ query, variables });

        const baseStr = `${credentials.appId}${timestamp}${payloadStr}`;
        const signature = crypto
          .createHmac('sha256', credentials.appSecret)
          .update(baseStr)
          .digest('hex');

        const res = await fetch('https://open-api.affiliate.shopee.vn/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `SHA256 Credential=${credentials.appId}, Signature=${signature}, Timestamp=${timestamp}`,
          },
          body: payloadStr,
        });

        if (res.ok) {
          const json = await res.json();
          const offer = json?.data?.itemOffer;
          if (offer) {
            const baseRate = offer.commissionRate ? parseFloat(offer.commissionRate) * 100 : 0;
            const extraRate = offer.extraCommissionRate ? parseFloat(offer.extraCommissionRate) * 100 : 0;
            const totalRate = baseRate + extraRate;

            return {
              available: true,
              baseRate,
              extraRate,
              totalRate,
              source: 'Shopee Affiliate Open API',
              updatedAt: new Date(),
            };
          }
        }
      } catch (err) {
        console.warn('Shopee Affiliate offer query failed:', err);
      }
    }

    return {
      available: false,
      baseRate: 0,
      extraRate: 0,
      totalRate: 0,
      source: 'Unprovided',
      updatedAt: new Date(),
    };
  }

  /**
   * Section 15: Diagnostic Reporting Status for Conversion/Order Report API
   */
  getConversionReportStatus(): { status: string; diagnostic: any } {
    return {
      status: 'UNAVAILABLE',
      diagnostic: {
        requiredFeature: 'Conversion & Order Report API',
        existingScope: 'Shopee Affiliate Open API (Link Generation)',
        missingScope: 'Shopee Partner/MCN Conversion Reporting Scope',
        solution: 'Cần đăng ký Shopee MCN/Partner Reporting Authorization để thu thập báo cáo đơn hàng tự động.',
      },
    };
  }
}

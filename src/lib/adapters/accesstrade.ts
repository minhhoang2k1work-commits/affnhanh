export interface AccesstradeDeeplinkInput {
  urls: string[];
  campaignId?: string;
  subId1?: string;
  subId2?: string;
  subId3?: string;
  subId4?: string;
  subId5?: string;
  utterance?: string;
}

export interface AccesstradeDeeplinkResult {
  success: boolean;
  shortUrl?: string;
  productUrl?: string;
  affiliateUrl?: string;
  campaignId?: string;
  error?: string;
}

export interface AccesstradeCampaign {
  id: string;
  name: string;
  merchant: string;
  status: string;
  approval: string;
  category?: string;
  cookie_duration?: number;
  cookie_policy?: string;
  description?: any;
  max_commission?: string;
  scope?: string;
}

export class AccesstradeAdapter {
  private baseUrl = 'https://api.accesstrade.vn/v1';

  /**
   * Helper to make HTTP requests to Accesstrade API
   */
  private async request<T>(endpoint: string, apiKey: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      signal: options.signal || AbortSignal.timeout(15_000),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${apiKey}`,
        ...(options.headers || {}),
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Accesstrade API error (${res.status}): ${errorText}`);
    }

    return res.json() as Promise<T>;
  }

  /**
   * Test if API Key is valid
   */
  async testApiKey(apiKey: string): Promise<{ success: boolean; message: string }> {
    try {
      const data: any = await this.request('/campaigns?limit=1', apiKey);
      if (data && Array.isArray(data.data)) {
        return { success: true, message: 'Kết nối API Key Accesstrade thành công.' };
      }
      return { success: false, message: 'Phản hồi từ Accesstrade API không hợp lệ.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Không thể xác thực API Key Accesstrade.' };
    }
  }

  /**
   * Get list of campaigns
   */
  async getCampaigns(
    apiKey: string,
    params: { page?: number; limit?: number; search?: string; approval?: string } = {}
  ): Promise<{ data: AccesstradeCampaign[]; page: number; total_page: number }> {
    const { page = 1, limit = 50, search, approval } = params;
    let query = `/campaigns?limit=${limit}&page=${page}`;
    if (search) query += `&search=${encodeURIComponent(search)}`;
    if (approval) query += `&approval=${encodeURIComponent(approval)}`;

    return this.request<{ data: AccesstradeCampaign[]; page: number; total_page: number }>(query, apiKey);
  }

  /**
   * Generate Deeplink via Accesstrade API
   */
  async createDeeplink(
    apiKey: string,
    input: AccesstradeDeeplinkInput
  ): Promise<AccesstradeDeeplinkResult[]> {
    const { urls, subId1, subId2, subId3, subId4, subId5, utterance } = input;
    let campaignId = input.campaignId;

    // If campaignId is not provided, try to find matching campaign from campaigns API
    if (!campaignId && urls.length > 0) {
      campaignId = await this.resolveCampaignIdForUrl(apiKey, urls[0]);
    }

    if (!campaignId) {
      throw new Error('Chưa chọn Chiến dịch (Campaign ID) phù hợp trên Accesstrade.');
    }

    const payload: Record<string, any> = {
      urls,
      campaign_id: campaignId,
    };

    if (utterance) payload.utterance = utterance;
    if (subId1) payload.sub1 = subId1;
    if (subId2) payload.sub2 = subId2;
    if (subId3) payload.sub3 = subId3;
    if (subId4) payload.sub4 = subId4;
    if (subId5) payload.sub5 = subId5;

    const response: any = await this.request('/product_link/create', apiKey, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (response.status === false || (response.status_code && response.status_code !== '01')) {
      throw new Error(response.message || 'Không thể tạo Deep Link từ Accesstrade.');
    }

    const results: AccesstradeDeeplinkResult[] = [];

    if (response.result && Array.isArray(response.result)) {
      for (const item of response.result) {
        results.push({
          success: item.status === 1 || !!item.short_link,
          shortUrl: item.short_link || item.link_deeplink,
          affiliateUrl: item.short_link || item.link_deeplink,
          productUrl: item.url,
          campaignId,
        });
      }
    } else if (response.data && Array.isArray(response.data)) {
      for (const item of response.data) {
        results.push({
          success: true,
          shortUrl: item.short_link || item.link_deeplink,
          affiliateUrl: item.short_link || item.link_deeplink,
          productUrl: item.url,
          campaignId,
        });
      }
    } else if (response.short_link || response.link_deeplink) {
      results.push({
        success: true,
        shortUrl: response.short_link || response.link_deeplink,
        affiliateUrl: response.short_link || response.link_deeplink,
        productUrl: urls[0],
        campaignId,
      });
    }

    return results;
  }

  /**
   * Helper to resolve campaignId based on URL domain
   */
  private async resolveCampaignIdForUrl(apiKey: string, urlStr: string): Promise<string | undefined> {
    try {
      const lower = urlStr.toLowerCase();
      const campaignsRes = await this.getCampaigns(apiKey, { limit: 100 });
      const campaigns = campaignsRes.data || [];

      let match: AccesstradeCampaign | undefined;

      if (lower.includes('shopee.vn') || lower.includes('shp.ee')) {
        match = campaigns.find(c => c.merchant.includes('shopee') || c.name.toLowerCase().includes('shopee'));
      } else if (lower.includes('lazada.vn')) {
        match = campaigns.find(c => c.merchant.includes('lazada') || c.name.toLowerCase().includes('lazada'));
      } else if (lower.includes('tiki.vn')) {
        match = campaigns.find(c => c.merchant.includes('tiki') || c.name.toLowerCase().includes('tiki'));
      } else if (lower.includes('tiktok.com')) {
        match = campaigns.find(c => c.merchant.includes('tiktok') || c.name.toLowerCase().includes('tiktok'));
      }

      if (!match && campaigns.length > 0) {
        match = campaigns[0];
      }

      return match?.id;
    } catch {
      return undefined;
    }
  }

  /**
   * Get orders report from Accesstrade
   */
  async getOrders(
    apiKey: string,
    params: { since?: string; until?: string; page?: number; limit?: number } = {}
  ): Promise<{ data: any[]; page: number; total: number; total_page: number }> {
    const until = params.until || new Date().toISOString();
    const since = params.since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const page = params.page || 1;
    const limit = Math.min(Math.max(params.limit || 100, 1), 300);
    const query = `/order-list?limit=${limit}&page=${page}&since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}`;
    const response = await this.request<{ data?: any[]; total?: number }>(query, apiKey);
    const total = asFiniteNumber(response.total);
    return {
      data: Array.isArray(response.data) ? response.data : [],
      page,
      total,
      total_page: Math.max(Math.ceil(total / limit), 1),
    };
  }
}

function asFiniteNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

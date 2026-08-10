import { ShopeeAffiliateProvider, ProviderStatus, GenerateLinkOptions, AffiliateLinkResult } from './base';
import { BrowserManager } from '../browser/manager';
import { ShopeeProductExtractor } from '../browser/extractor';
import { ProductInfo, ShopInfo } from '../adapters/base';
import { db } from '@/lib/db';

export class ShopeeBrowserAdapter implements ShopeeAffiliateProvider {
  providerType: 'BROWSER' = 'BROWSER';
  private manager = BrowserManager.getInstance();

  async getStatus(userId?: string): Promise<ProviderStatus> {
    const targetUserId = userId || 'default-user-id';
    const statusResult = await this.manager.checkSessionStatus(targetUserId);

    return {
      providerName: 'Shopee Browser Automation',
      connected: statusResult.connected,
      status: statusResult.status as any,
      message: statusResult.message,
    };
  }

  async getProductsFromShop(shopUrl: string, limit: number = 50): Promise<{ shopInfo: ShopInfo; products: ProductInfo[] }> {
    const targetUserId = 'default-user-id';
    const pageData = await this.manager.getAuthenticatedPage(targetUserId);

    if (!pageData) {
      throw new Error('SHOPEE_AUTH_REQUIRED: Chưa khởi tạo phiên trình duyệt Shopee.');
    }

    const { page, context, browser } = pageData;
    try {
      const extracted = await ShopeeProductExtractor.extractProductsFromShopPage(page, shopUrl, limit);
      await context.close();
      await browser.close();
      return extracted;
    } catch (err: any) {
      await context.close();
      await browser.close();
      throw err;
    }
  }

  /**
   * Section 17 & 19: Browser Automated Affiliate Link Generation
   */
  async generateAffiliateLink(productUrl: string, options?: GenerateLinkOptions): Promise<AffiliateLinkResult> {
    const targetUserId = options?.userId || 'default-user-id';
    const pageData = await this.manager.getAuthenticatedPage(targetUserId);

    if (!pageData) {
      return {
        success: false,
        error: 'Chưa khởi tạo trình duyệt Shopee. Vui lòng nhấn KẾT NỐI SHOPEE trong Tài khoản Affiliate.',
        code: 'SHOPEE_AUTH_REQUIRED',
        dataSource: 'browser',
      };
    }

    const { page, context, browser } = pageData;

    try {
      // 1. Open Shopee Affiliate Custom Link Generator Portal
      await page.goto('https://affiliate.shopee.vn/offer/custom_link', { waitUntil: 'domcontentloaded', timeout: 25000 });

      // Check if redirected to login
      if (page.url().includes('/login')) {
        await context.close();
        await browser.close();
        return {
          success: false,
          error: 'Phiên đăng nhập Shopee đã hết hạn. Vui lòng nhấn KẾT NỐI LẠI SHOPEE.',
          code: 'SHOPEE_AUTH_REQUIRED',
          dataSource: 'browser',
        };
      }

      // Check security verification prompt (Section 5)
      const content = await page.content();
      if (content.includes('captcha') || page.url().includes('/verify')) {
        await context.close();
        await browser.close();
        return {
          success: false,
          error: 'Shopee đang yêu cầu xác minh. Vui lòng hoàn thành xác minh trong cửa sổ Shopee.',
          code: 'SHOPEE_VERIFICATION_REQUIRED',
          dataSource: 'browser',
        };
      }

      // 2. Input product URL into Custom Link Form (Section 18 Selector Strategy)
      const inputSelector = 'textarea, input[placeholder*="http"], input[type="text"]';
      await page.waitForSelector(inputSelector, { timeout: 10000 });
      await page.fill(inputSelector, productUrl);
      await page.waitForTimeout(500);

      // 3. Click "Tạo Link" / "Generate" button
      const buttonSelector = 'button:has-text("Lấy Link"), button:has-text("Tạo Link"), button:has-text("Generate"), button[type="submit"]';
      await page.click(buttonSelector);

      // 4. Extract generated link
      await page.waitForTimeout(2500);
      const generatedLinkElement = await page.$('input[value*="shopee"], input[value*="shp.ee"], a[href*="s.shopee.vn"]');
      
      let generatedUrl = '';
      if (generatedLinkElement) {
        generatedUrl = (await generatedLinkElement.getAttribute('value')) || (await generatedLinkElement.getAttribute('href')) || '';
      }

      // Fallback: Read any Shopee deep link present in page text
      if (!generatedUrl) {
        const textContent = await page.content();
        const match = textContent.match(/https:\/\/(?:s\.shopee\.vn|shp\.ee)\/[a-zA-Z0-9_-]+/);
        if (match) {
          generatedUrl = match[0];
        }
      }

      await context.close();
      await browser.close();

      // Section 19: Validate Affiliate Link
      if (generatedUrl && (generatedUrl.includes('s.shopee.vn') || generatedUrl.includes('shp.ee') || generatedUrl.includes('an_redir')) && generatedUrl !== productUrl) {
        return {
          success: true,
          affiliateUrl: generatedUrl,
          dataSource: 'browser',
        };
      }

      return {
        success: false,
        error: 'Không thể trích xuất Affiliate Link từ giao diện Shopee. Shopee có thể đã thay đổi giao diện.',
        code: 'SHOPEE_LINK_GENERATION_FAILED',
        dataSource: 'browser',
      };
    } catch (err: any) {
      await context.close();
      await browser.close();
      return {
        success: false,
        error: err?.message || 'Lỗi tự động hóa trình duyệt Shopee.',
        code: 'BROWSER_TIMEOUT',
        dataSource: 'browser',
      };
    }
  }
}

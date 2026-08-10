import { chromium, BrowserContext, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { db } from '@/lib/db';
import { encryptText, decryptText } from '@/lib/crypto';

export class BrowserManager {
  private static instance: BrowserManager;
  private activeContexts: Map<string, BrowserContext> = new Map();
  private sessionsDir: string;

  private constructor() {
    this.sessionsDir = path.join(process.cwd(), '.sessions');
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  public static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager();
    }
    return BrowserManager.instance;
  }

  private getSessionFilePath(userId: string): string {
    return path.join(this.sessionsDir, `${userId}_session.enc`);
  }

  /**
   * Section 4 & 6: Launch browser window for manual user login (QR, Phone, Email, SMS OTP).
   * Password is NEVER captured or stored.
   */
  async launchManualLoginSession(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const existingContext = this.activeContexts.get(userId);
      if (existingContext) {
        await existingContext.close();
        this.activeContexts.delete(userId);
      }

      // Launch Playwright Chromium in headed mode for manual login
      const browser = await chromium.launch({
        headless: false, // User sees browser window to perform manual login
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      this.activeContexts.set(userId, context);

      const page = await context.newPage();
      await page.goto('https://shopee.vn/user/login');

      // Update connection status in DB
      await db.shopeeConnection.upsert({
        where: { userId_provider: { userId, provider: 'BROWSER' } },
        update: { status: 'OPENING_BROWSER', updatedAt: new Date() },
        create: { userId, provider: 'BROWSER', status: 'OPENING_BROWSER' },
      });

      // Background listener: save encrypted storage state when user completes login
      page.on('load', async () => {
        const url = page.url();
        if (!url.includes('/login') && (url.includes('shopee.vn') || url.includes('/user/account'))) {
          await this.saveEncryptedSession(userId, context);
        }
      });

      return {
        success: true,
        message: 'Trình duyệt Shopee đã mở. Vui lòng thực hiện đăng nhập thủ công (QR Code / SMS OTP) trên trình duyệt.',
      };
    } catch (err: any) {
      console.error('Error launching browser session:', err);
      return {
        success: false,
        message: err?.message || 'Không thể mở trình duyệt Playwright.',
      };
    }
  }

  /**
   * Section 6 & 7: Save Encrypted StorageState at Rest (Server-side only)
   */
  async saveEncryptedSession(userId: string, context: BrowserContext): Promise<void> {
    try {
      const storageState = await context.storageState();
      const jsonStr = JSON.stringify(storageState);
      const encryptedStr = encryptText(jsonStr);

      const filePath = this.getSessionFilePath(userId);
      fs.writeFileSync(filePath, encryptedStr, 'utf-8');

      await db.shopeeConnection.upsert({
        where: { userId_provider: { userId, provider: 'BROWSER' } },
        update: {
          status: 'CONNECTED',
          encryptedSessionPath: filePath,
          lastVerifiedAt: new Date(),
          updatedAt: new Date(),
        },
        create: {
          userId,
          provider: 'BROWSER',
          status: 'CONNECTED',
          encryptedSessionPath: filePath,
          lastVerifiedAt: new Date(),
        },
      });

      console.log(`[BrowserManager] Successfully saved encrypted session for user ${userId}`);
    } catch (err) {
      console.error('Error saving encrypted session:', err);
    }
  }

  /**
   * Section 8 & 23: Health Check Browser Session
   */
  async checkSessionStatus(userId: string): Promise<{ connected: boolean; status: string; message: string }> {
    const filePath = this.getSessionFilePath(userId);
    if (!fs.existsSync(filePath)) {
      return { connected: false, status: 'DISCONNECTED', message: 'Chưa có phiên đăng nhập Shopee Browser.' };
    }

    try {
      const encryptedStr = fs.readFileSync(filePath, 'utf-8');
      const jsonStr = decryptText(encryptedStr);
      const storageState = JSON.parse(jsonStr);

      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({ storageState });
      const page = await context.newPage();

      await page.goto('https://shopee.vn/user/account/profile', { waitUntil: 'domcontentloaded', timeout: 15000 });
      const currentUrl = page.url();
      await context.close();
      await browser.close();

      if (currentUrl.includes('/login') || currentUrl.includes('/buyer/login')) {
        await db.shopeeConnection.updateMany({
          where: { userId, provider: 'BROWSER' },
          data: { status: 'EXPIRED' },
        });
        return { connected: false, status: 'EXPIRED', message: 'Phiên đăng nhập Shopee đã hết hạn. Vui lòng kết nối lại.' };
      }

      // Check for security verification prompt (Section 5)
      const pageContent = await page.content();
      if (pageContent.includes('captcha') || pageContent.includes('verify') || currentUrl.includes('/verify')) {
        await db.shopeeConnection.updateMany({
          where: { userId, provider: 'BROWSER' },
          data: { status: 'VERIFICATION_REQUIRED' },
        });
        return { connected: false, status: 'VERIFICATION_REQUIRED', message: 'Shopee đang yêu cầu xác minh. Vui lòng hoàn thành xác minh trong cửa sổ Shopee.' };
      }

      await db.shopeeConnection.updateMany({
        where: { userId, provider: 'BROWSER' },
        data: { status: 'CONNECTED', lastVerifiedAt: new Date() },
      });

      return { connected: true, status: 'CONNECTED', message: 'Shopee Browser đã kết nối thành công!' };
    } catch (err: any) {
      return { connected: false, status: 'ERROR', message: err?.message || 'Lỗi kiểm tra session.' };
    }
  }

  /**
   * Get Active Page for Background Operations (Product Extraction / Custom Link Generation)
   */
  async getAuthenticatedPage(userId: string): Promise<{ page: Page; context: BrowserContext; browser: any } | null> {
    const filePath = this.getSessionFilePath(userId);
    let storageState: any = null;

    if (fs.existsSync(filePath)) {
      try {
        const encryptedStr = fs.readFileSync(filePath, 'utf-8');
        const jsonStr = decryptText(encryptedStr);
        storageState = JSON.parse(jsonStr);
      } catch (err) {
        console.warn('Failed to load storage state:', err);
      }
    }

    const browser = await chromium.launch({ headless: true });
    const context = storageState ? await browser.newContext({ storageState }) : await browser.newContext();
    const page = await context.newPage();

    return { page, context, browser };
  }
}

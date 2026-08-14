import { chromium, BrowserContext, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { db } from '@/lib/db';
import { encryptText, decryptText } from '@/lib/crypto';

export type AIService = 'chatgpt' | 'kling' | 'runway' | 'google_aistudio';

interface ServiceConfig {
  loginUrl: string;
  homeUrl: string;
  loginCheckSelector: string; // CSS selector that exists only when logged in
  name: string;
}

const SERVICE_CONFIGS: Record<AIService, ServiceConfig> = {
  chatgpt: {
    loginUrl: 'https://chatgpt.com/',
    homeUrl: 'https://chatgpt.com/',
    loginCheckSelector: 'nav, [data-testid="profile-button"], button[aria-label="User menu"]',
    name: 'ChatGPT',
  },
  kling: {
    loginUrl: 'https://klingai.com/login',
    homeUrl: 'https://klingai.com/',
    loginCheckSelector: '.user-avatar, .user-center, [class*="avatar"]',
    name: 'Kling AI',
  },
  runway: {
    loginUrl: 'https://app.runwayml.com/login',
    homeUrl: 'https://app.runwayml.com/',
    loginCheckSelector: '[data-testid="user-menu"], .user-avatar, [class*="avatar"]',
    name: 'Runway',
  },
  google_aistudio: {
    loginUrl: 'https://aistudio.google.com/',
    homeUrl: 'https://aistudio.google.com/',
    loginCheckSelector: '[aria-label="Google Account"], .gb_A, [data-ogsr-up]',
    name: 'Google AI Studio',
  },
};

export class AIBrowserSessionManager {
  private static instance: AIBrowserSessionManager;
  private activeContexts: Map<string, { context: BrowserContext; browser: any }> = new Map();
  private sessionsDir: string;

  private constructor() {
    this.sessionsDir = path.join(process.cwd(), '.sessions', 'ai');
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  public static getInstance(): AIBrowserSessionManager {
    if (!AIBrowserSessionManager.instance) {
      AIBrowserSessionManager.instance = new AIBrowserSessionManager();
    }
    return AIBrowserSessionManager.instance;
  }

  private getSessionFilePath(userId: string, service: AIService): string {
    return path.join(this.sessionsDir, `${userId}_${service}_session.enc`);
  }

  private getContextKey(userId: string, service: AIService): string {
    return `${userId}:${service}`;
  }

  /**
   * Launch a headed browser for the user to manually log in to an AI service.
   * After login, the session is saved encrypted for reuse.
   */
  async launchLoginSession(userId: string, service: AIService): Promise<{ success: boolean; message: string }> {
    const config = SERVICE_CONFIGS[service];
    if (!config) {
      return { success: false, message: `Dịch vụ không được hỗ trợ: ${service}` };
    }

    try {
      const contextKey = this.getContextKey(userId, service);

      // Close existing context if any
      const existing = this.activeContexts.get(contextKey);
      if (existing) {
        await existing.context.close().catch(() => {});
        await existing.browser.close().catch(() => {});
        this.activeContexts.delete(contextKey);
      }

      // Launch headed browser for manual login
      const browser = await chromium.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'],
      });

      const context = await browser.newContext({
        viewport: { width: 1400, height: 900 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      });

      this.activeContexts.set(contextKey, { context, browser });

      const page = await context.newPage();
      await page.goto(config.loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Update provider status
      await this.updateProviderStatus(userId, service, 'opening_browser');

      // Background listener: detect when user completes login
      let loginSaved = false;
      const checkLogin = async () => {
        if (loginSaved) return;
        try {
          const currentUrl = page.url();
          // Check if we're no longer on the login page
          const isLoggedIn = !currentUrl.includes('/login') && !currentUrl.includes('/auth');

          if (isLoggedIn) {
            // Also check for a logged-in element
            const hasUserElement = await page.$(config.loginCheckSelector).catch(() => null);
            if (hasUserElement || !currentUrl.includes('/login')) {
              // Wait a bit for cookies to settle
              await new Promise(r => setTimeout(r, 2000));
              await this.saveSession(userId, service, context);
              loginSaved = true;
              console.log(`[AIBrowser] ${config.name} login detected and session saved for user ${userId}`);
            }
          }
        } catch (err) {
          // Page might be navigating, ignore
        }
      };

      page.on('load', checkLogin);
      page.on('framenavigated', checkLogin);

      // Also check periodically
      const interval = setInterval(async () => {
        if (loginSaved) {
          clearInterval(interval);
          return;
        }
        await checkLogin();
      }, 3000);

      // Auto-cleanup after 10 minutes
      setTimeout(async () => {
        clearInterval(interval);
        if (!loginSaved) {
          await this.updateProviderStatus(userId, service, 'timeout');
        }
        // Don't close browser - let user close it
      }, 10 * 60 * 1000);

      return {
        success: true,
        message: `Trình duyệt ${config.name} đã mở. Vui lòng đăng nhập trên trình duyệt. Session sẽ tự động lưu sau khi đăng nhập thành công.`,
      };
    } catch (err: any) {
      console.error(`[AIBrowser] Error launching ${service} login:`, err);
      return {
        success: false,
        message: err?.message || `Không thể mở trình duyệt cho ${config.name}.`,
      };
    }
  }

  /**
   * Save encrypted browser session (cookies, localStorage, etc.)
   */
  async saveSession(userId: string, service: AIService, context: BrowserContext): Promise<void> {
    try {
      const storageState = await context.storageState();
      const jsonStr = JSON.stringify(storageState);
      const encryptedStr = encryptText(jsonStr);

      const filePath = this.getSessionFilePath(userId, service);
      fs.writeFileSync(filePath, encryptedStr, 'utf-8');

      await this.updateProviderStatus(userId, service, 'connected', filePath);
      console.log(`[AIBrowser] Saved encrypted session for ${service}, user ${userId}`);
    } catch (err) {
      console.error(`[AIBrowser] Error saving session for ${service}:`, err);
    }
  }

  /**
   * Get an authenticated headless page for background AI operations.
   */
  async getAuthenticatedPage(userId: string, service: AIService): Promise<{ page: Page; context: BrowserContext; browser: any } | null> {
    const filePath = this.getSessionFilePath(userId, service);
    const config = SERVICE_CONFIGS[service];

    if (!fs.existsSync(filePath)) {
      console.warn(`[AIBrowser] No session file for ${service}, user ${userId}`);
      return null;
    }

    try {
      const encryptedStr = fs.readFileSync(filePath, 'utf-8');
      const jsonStr = decryptText(encryptedStr);
      const storageState = JSON.parse(jsonStr);

      const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const context = await browser.newContext({
        storageState,
        viewport: { width: 1400, height: 900 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      });

      const page = await context.newPage();

      // Navigate to home and check if still logged in
      await page.goto(config.homeUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      const currentUrl = page.url();

      if (currentUrl.includes('/login') || currentUrl.includes('/auth')) {
        await context.close();
        await browser.close();
        await this.updateProviderStatus(userId, service, 'expired');
        console.warn(`[AIBrowser] Session expired for ${service}, user ${userId}`);
        return null;
      }

      return { page, context, browser };
    } catch (err: any) {
      console.error(`[AIBrowser] Error loading session for ${service}:`, err);
      return null;
    }
  }

  /**
   * Check if a session is still valid
   */
  async checkSessionHealth(userId: string, service: AIService): Promise<{
    valid: boolean;
    status: string;
    message: string;
  }> {
    const filePath = this.getSessionFilePath(userId, service);
    const config = SERVICE_CONFIGS[service];

    if (!fs.existsSync(filePath)) {
      return { valid: false, status: 'not_connected', message: `Chưa đăng nhập ${config.name}` };
    }

    try {
      const result = await this.getAuthenticatedPage(userId, service);
      if (!result) {
        return { valid: false, status: 'expired', message: `Phiên ${config.name} đã hết hạn. Vui lòng đăng nhập lại.` };
      }

      // Cleanup
      await result.context.close();
      await result.browser.close();

      await this.updateProviderStatus(userId, service, 'connected', filePath);
      return { valid: true, status: 'connected', message: `${config.name} đã kết nối!` };
    } catch (err: any) {
      return { valid: false, status: 'error', message: err?.message || `Lỗi kiểm tra ${config.name}` };
    }
  }

  /**
   * Get all session statuses for a user
   */
  async getAllSessionStatuses(userId: string): Promise<Record<AIService, { valid: boolean; status: string }>> {
    const services: AIService[] = ['chatgpt', 'kling', 'runway', 'google_aistudio'];
    const statuses: any = {};

    for (const service of services) {
      const filePath = this.getSessionFilePath(userId, service);
      const provider = await db.aIProvider.findFirst({
        where: { userId, name: service },
      });

      statuses[service] = {
        valid: provider?.browserSessionValid || false,
        status: provider?.browserSessionValid ? 'connected' : (fs.existsSync(filePath) ? 'unknown' : 'not_connected'),
        mode: provider?.mode || 'api',
        lastCheck: provider?.lastSessionCheck || null,
      };
    }

    return statuses;
  }

  /**
   * Update provider status in database
   */
  private async updateProviderStatus(userId: string, service: AIService, status: string, sessionPath?: string): Promise<void> {
    const serviceTypeMap: Record<AIService, string> = {
      chatgpt: 'llm',
      kling: 'video',
      runway: 'video',
      google_aistudio: 'video',
    };

    try {
      await db.aIProvider.upsert({
        where: { userId_name: { userId, name: service } },
        update: {
          mode: 'browser',
          browserSessionValid: status === 'connected',
          browserSessionPath: sessionPath || undefined,
          lastSessionCheck: new Date(),
          updatedAt: new Date(),
        },
        create: {
          userId,
          name: service,
          type: serviceTypeMap[service],
          mode: 'browser',
          browserSessionValid: status === 'connected',
          browserSessionPath: sessionPath || undefined,
          lastSessionCheck: new Date(),
        },
      });
    } catch (err) {
      console.error(`[AIBrowser] Error updating provider status:`, err);
    }
  }

  /**
   * Close active browser session
   */
  async closeSession(userId: string, service: AIService): Promise<void> {
    const key = this.getContextKey(userId, service);
    const active = this.activeContexts.get(key);
    if (active) {
      await active.context.close().catch(() => {});
      await active.browser.close().catch(() => {});
      this.activeContexts.delete(key);
    }
  }
}

export const aiSessionManager = AIBrowserSessionManager.getInstance();

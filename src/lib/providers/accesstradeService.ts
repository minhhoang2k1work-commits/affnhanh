import { db } from '@/lib/db';
import { encryptText, decryptText } from '@/lib/crypto';
import { AccesstradeAdapter } from '@/lib/adapters/accesstrade';

export class AccesstradeService {
  private static adapter = new AccesstradeAdapter();

  /**
   * Get default user ID from database or create fallback user
   */
  static async getOrCreateDefaultUser() {
    let user = await db.user.findFirst();
    if (!user) {
      user = await db.user.create({
        data: {
          id: 'default-user-id',
          email: 'admin@affhub.local',
          name: 'Affiliate Hub Admin',
        },
      });
    }
    return user;
  }

  /**
   * Get the configured Accesstrade API key. Never seed or fall back to a
   * credential embedded in source code.
   */
  static async getActiveApiKey(userId?: string): Promise<string> {
    const defaultUser = await this.getOrCreateDefaultUser();
    const targetUserId = userId || defaultUser.id;

    // Find ACCESSTRADE account
    const acc = await db.affiliateAccount.findFirst({
      where: {
        platform: 'ACCESSTRADE',
        userId: targetUserId,
      },
    });

    if (!acc?.appSecretEnc) throw new Error('Accesstrade API key is not configured.');
    return decryptText(acc.appSecretEnc);
  }

  /**
   * Save or update Accesstrade API Key
   */
  static async saveApiKey(apiKey: string, userId?: string) {
    const defaultUser = await this.getOrCreateDefaultUser();
    const targetUserId = userId || defaultUser.id;
    const encrypted = encryptText(apiKey);

    const existing = await db.affiliateAccount.findFirst({
      where: {
        platform: 'ACCESSTRADE',
        userId: targetUserId,
      },
    });

    if (existing) {
      return db.affiliateAccount.update({
        where: { id: existing.id },
        data: {
          appSecretEnc: encrypted,
          status: 'ACTIVE',
          updatedAt: new Date(),
        },
      });
    } else {
      return db.affiliateAccount.create({
        data: {
          userId: targetUserId,
          platform: 'ACCESSTRADE',
          accountName: 'Accesstrade Official API',
          appId: 'accesstrade_publisher',
          appSecretEnc: encrypted,
          isDefault: true,
          status: 'ACTIVE',
        },
      });
    }
  }

  static getAdapter() {
    return this.adapter;
  }
}

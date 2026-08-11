import { db } from '../db';
import { getAdapter } from '../adapters';
import { decryptText } from '../crypto';

export interface GenerateLinkResult {
  status: 'success' | 'pending_configuration' | 'not_eligible' | 'failed';
  affiliateUrl?: string;
  errorMessage?: string;
}

export class AffiliateLinkService {
  /**
   * Section 8, 9, 10: Affiliate Link Generator Service
   * Checks default account, encrypts/decrypts credentials, calls adapter, updates status in DB.
   */
  static async generateAffiliateLinkForProduct(input: {
    userId: string;
    productId: string;
    subId?: string;
  }): Promise<GenerateLinkResult> {
    const { userId, productId, subId = 'HUB_AUTO_IMPORT' } = input;

    const product = await db.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return { status: 'failed', errorMessage: 'Sản phẩm không tồn tại.' };
    }

    if (!product.hasAffiliate) {
      await db.product.update({
        where: { id: productId },
        data: { affiliateStatus: 'not_eligible' },
      });
      return { status: 'not_eligible', errorMessage: 'Sản phẩm không hỗ trợ Affiliate.' };
    }

    // Check user default affiliate account for platform
    const defaultAccount = await db.affiliateAccount.findFirst({
      where: {
        userId,
        platform: product.platform,
        isDefault: true,
      },
    });

    // Section 10: If no affiliate account configured, fallback to Extension Automation
    if (!defaultAccount) {
      await db.product.update({
        where: { id: productId },
        data: { affiliateStatus: 'pending' },
      });

      // Queue a job for the extension to handle via DOM automation
      await db.extensionJob.create({
        data: {
          userId,
          type: 'GENERATE_AFFILIATE_LINK',
          productId: product.id,
          payload: JSON.stringify({ productUrl: product.originalUrl }),
          status: 'queued',
        }
      });

      return {
        status: 'success',
        errorMessage: 'Đã gửi yêu cầu tạo link cho Extension. Vui lòng đợi trong giây lát...',
      };
    }

    // Decrypt credentials
    const appId = defaultAccount.appId;
    const appSecret = decryptText(defaultAccount.appSecretEnc);

    try {
      const adapter = getAdapter(product.platform);
      const affiliateUrl = await adapter.generateAffiliateLink({
        originUrl: product.originalUrl,
        subIds: [subId],
        credentials: { appId, appSecret },
      });

      // Save to AffiliateLink table
      const linkRecord = await db.affiliateLink.upsert({
        where: { id: `link_${product.id}` },
        update: {
          affiliateAccountId: defaultAccount.id,
          affiliateUrl,
          subId,
          status: 'ACTIVE',
        },
        create: {
          id: `link_${product.id}`,
          userId,
          productId: product.id,
          affiliateAccountId: defaultAccount.id,
          originalUrl: product.originalUrl,
          affiliateUrl,
          subId,
          status: 'ACTIVE',
        },
      });

      // Update product affiliate status
      await db.product.update({
        where: { id: productId },
        data: { affiliateStatus: 'success' },
      });

      return {
        status: 'success',
        affiliateUrl,
      };
    } catch (err: any) {
      await db.product.update({
        where: { id: productId },
        data: { affiliateStatus: 'failed' },
      });

      return {
        status: 'failed',
        errorMessage: err?.message || 'Không thể khởi tạo link Affiliate.',
      };
    }
  }
}

import { workerStatus } from '@/lib/autocut/queue';
import { NextResponse } from 'next/server';
import ffmpegStatic from 'ffmpeg-static';
import { db, getOrCreateUser } from '@/lib/db';
import { ensureFlowTemplates } from '@/lib/flow/templates';
import { isYouTubeConfigured } from '@/lib/publishing/youtube';
import { isGoogleDriveAutoUploadEnabled, isGoogleDriveConfigured } from '@/lib/storage/google-drive';
import { isTelegramConfigured } from '@/lib/telegram/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureFlowTemplates();
    const user = await getOrCreateUser();
    const extensionThreshold = new Date(Date.now() - 30_000);
    const [providers, templateCount, productCount, affiliateLinkCount, extension, reportingAccount] = await Promise.all([
      db.aIProvider.findMany({
        where: { userId: user.id, isActive: true, type: { in: ['llm', 'video', 'image', 'voiceover'] } },
        select: { name: true, type: true, mode: true, browserSessionValid: true, apiKeyEnc: true },
      }),
      db.flowTemplate.count({ where: { isSystem: true } }),
      db.product.count({ where: { userId: user.id, isActive: true } }),
      db.affiliateLink.count({ where: { userId: user.id, status: 'ACTIVE' } }),
      db.extensionDevice.findFirst({ where: { userId: user.id, lastSeenAt: { gte: extensionThreshold } }, select: { id: true } }),
      db.affiliateAccount.findFirst({
        where: { userId: user.id, platform: 'ACCESSTRADE', status: 'ACTIVE' },
        select: { id: true },
      }),
    ]);

    const providerReady = (type: string) => providers.some((provider) =>
      provider.type === type && (provider.mode === 'api' ? Boolean(provider.apiKeyEnc) : provider.browserSessionValid),
    );
    const [driveConfigured, driveAutoUpload] = await Promise.all([
      isGoogleDriveConfigured(user.id),
      isGoogleDriveAutoUploadEnabled(user.id),
    ]);
    const autoCut = await workerStatus();
    let flowConnected = false;
    try { const response = await fetch('http://127.0.0.1:8766/ws_status', { signal: AbortSignal.timeout(2000) }); const status = await response.json(); flowConnected = response.ok && status.connected === true && status.extension_version_supported === true; } catch { /* No live bridge. */ }
    const checks = {
      database: true,
      encryption: Boolean(process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length >= 32),
      appAuthentication: Boolean(process.env.APP_BASIC_AUTH_USER && process.env.APP_BASIC_AUTH_PASSWORD),
      workerAuthentication: Boolean(process.env.FLOW_WORKER_SECRET),
      workerAutoStart: process.env.FLOW_AUTO_START === 'true',
      flowTemplates: templateCount > 0,
      llmProvider: providerReady('llm'),
      videoProvider: providerReady('video'),
      voiceProvider: providerReady('voiceover'),
      ffmpeg: Boolean(process.env.FFMPEG_PATH || ffmpegStatic),
      products: productCount > 0,
      affiliateLinks: affiliateLinkCount > 0,
      extension: Boolean(extension),
      driveStorage: driveConfigured && driveAutoUpload,
      youtubePublishing: isYouTubeConfigured(),
      conversionReporting: Boolean(reportingAccount),
      telegramReview: isTelegramConfigured(),
      googleFlowBatchConnected: flowConnected,
      autocutTemplateWorker: autoCut.online && autoCut.state !== 'blocked' && autoCut.templates.length > 0,
    };
    const optionalChecks = new Set(['youtubePublishing']);
    const blockers = Object.entries(checks)
      .filter(([name, ready]) => !optionalChecks.has(name) && !ready)
      .map(([name]) => name);
    return NextResponse.json({
      readyForUnattendedProduction: blockers.length === 0,
      readyForVideoCanary: checks.llmProvider && checks.videoProvider && checks.ffmpeg && checks.flowTemplates,
      checks,
      blockers,
      verification: 'configuration_only_not_a_successful_live_run',
      missingIntegrations: [!flowConnected && 'Chưa nhận kết nối Google Flow extension', !checks.autocutTemplateWorker && 'Chưa nhận worker AutoCut và template'].filter(Boolean),
      counts: { providers: providers.length, templates: templateCount, products: productCount, affiliateLinks: affiliateLinkCount },
    });
  } catch (error: any) {
    return NextResponse.json({ readyForUnattendedProduction: false, error: error.message }, { status: 500 });
  }
}

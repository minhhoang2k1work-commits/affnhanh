import { db } from '../db';
import { AffiliateLinkService } from '../affiliate/service';
import { buildReelPrompt, parseReelCopy } from '../publishing/reels';
import { productPublishingCopy } from './batch';
import { FlowWaiting } from './waiting';

async function batchRun(runId: string) {
  const run = await db.flowRun.findUnique({ where: { id: runId } });
  const input = run?.inputData as any;
  if (!run?.videoProjectId || !input?.facebook) throw new Error('Thiếu danh sách sản phẩm và cấu hình duyệt.');
  const project = await db.aIVideoProject.findFirst({ where: { id: run.videoProjectId, userId: run.userId }, include: { product: true } });
  if (!project?.product || project.product.userId !== run.userId) throw new Error('Không tìm thấy sản phẩm của đợt video.');
  return { run, input, project };
}

export async function resolveBatchAffiliate(runId: string) {
  const { run, input, project } = await batchRun(runId);
  const link = await db.affiliateLink.findFirst({ where: { userId: run.userId, productId: project.productId!, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } });
  let affiliateUrl = input.facebook.affiliateUrl || link?.affiliateUrl;
  if (!affiliateUrl) {
    const job = await db.extensionJob.findFirst({ where: { userId: run.userId, productId: project.productId, type: 'GENERATE_AFFILIATE_LINK' }, orderBy: { createdAt: 'desc' } });
    if (job && ['queued', 'claimed', 'processing'].includes(job.status)) {
      if (Date.now() - job.createdAt.getTime() > 30 * 60 * 1000) throw new Error('Tạo link đã chờ quá 30 phút. Kiểm tra extension và xử lý công việc bị treo.');
      throw new FlowWaiting('Đang chờ extension trả link affiliate thật.');
    }
    if (job && job.createdAt >= run.createdAt && ['failed', 'cancelled', 'completed'].includes(job.status)) throw new Error(job.errorMessage || 'Công việc tạo link đã kết thúc nhưng chưa có link ACTIVE. Tạo lại link trong thư viện rồi thử lại bước này.');
    const result = await AffiliateLinkService.generateAffiliateLinkForProduct({ userId: run.userId, productId: project.productId! });
    if (result.status === 'pending') throw new FlowWaiting('Đã gửi yêu cầu tạo link; chưa có kết quả.');
    if (result.status !== 'success' || !result.affiliateUrl) throw new Error(result.errorMessage || 'Không lấy được link affiliate thật.');
    affiliateUrl = result.affiliateUrl;
  }
  productPublishingCopy(project.product!.name, affiliateUrl);
  await db.flowRun.update({ where: { id: run.id }, data: { inputData: { ...input, facebook: { ...input.facebook, affiliateUrl } } } });
  return { affiliateUrl };
}

export async function generateBatchCopy(runId: string) {
  const { run, input, project } = await batchRun(runId);
  const { AIProviderManager } = await import('../ai/providers');
  const provider = await AIProviderManager.getInstance().getProviderWithFallback('llm');
  if (provider.userId !== run.userId) throw new Error('Nhà cung cấp AI không thuộc tài khoản này.');
  const prompt = buildReelPrompt(project, project.product);
  let raw: string;
  if (provider.mode === 'browser') {
    const { aiSessionManager } = await import('../ai-browser/session-manager');
    const session = await aiSessionManager.getAuthenticatedPage(run.userId, 'chatgpt');
    if (!session) throw new Error('Phiên ChatGPT đã hết hạn.');
    try {
      const { sendPrompt } = await import('../ai-browser/chatgpt-driver');
      raw = (await sendPrompt(session.page, prompt)).response;
    } finally {
      await session.context.close().catch(() => {});
      await session.browser.close().catch(() => {});
    }
  } else {
    const { createStructuredResponse } = await import('../ai/openai-client');
    const result = await createStructuredResponse({ apiKey: provider.apiKey!, name: 'publishing_copy', system: 'Chỉ viết từ dữ liệu được cung cấp. Không bịa thông tin sản phẩm.', user: prompt,
      schema: { type: 'object', additionalProperties: false, required: ['title', 'caption', 'hashtags'], properties: { title: { type: 'string' }, caption: { type: 'string' }, hashtags: { type: 'array', items: { type: 'string' } } } } });
    raw = JSON.stringify(result);
  }
  const copy = parseReelCopy(raw);
  await db.flowRun.update({ where: { id: run.id }, data: { inputData: { ...input, facebook: { ...input.facebook, copy } } } });
  return { copy, copyProvider: `${provider.name}_${provider.mode}`, source: 'saved_product_facts' };
}

import { workerStatus } from '../autocut/queue';
import { createHash } from 'node:crypto';
import { db } from '../db';
import { PublishingError, publishingTransaction } from '../publishing/manager';
import { parseReelCopy, reelText } from '../publishing/reels';
import { AUTOCUT_BATCH_TEMPLATE_ID, BATCH_FACEBOOK_TEMPLATE_ID, LEGACY_BATCH_FACEBOOK_TEMPLATE_ID, ensureFlowTemplates, templates } from './templates';
import { buildProductBrief } from '../products/knowledge';
import { assertAffiliateUrl } from '../affiliate/validation';

export function parseBatchInput(body: Record<string, unknown>) {
  if (!Array.isArray(body.productIds) || !body.productIds.length || body.productIds.length > 50 || body.productIds.some(id => typeof id !== 'string' || !id)) throw new PublishingError('Chọn từ 1–50 sản phẩm.');
  if (typeof body.channelId !== 'string' || !body.channelId) throw new PublishingError('Chọn Page Facebook.');
  if (typeof body.clientKey !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(body.clientKey)) throw new PublishingError('Mã yêu cầu không hợp lệ.');
  const style = body.style ?? 'professional';
  const duration = body.duration ?? 30;
  if (!['professional', 'trendy', 'minimal', 'energetic', 'luxury'].includes(String(style))) throw new PublishingError('Phong cách không hợp lệ.');
  if (typeof duration !== 'number' || !Number.isInteger(duration) || (body.autoCutTemplateId ? duration < 5 || duration > 120 : ![15, 30, 60].includes(duration))) throw new PublishingError('Chọn thời lượng hợp lệ; AutoCut dùng đúng thời lượng template (5–120 giây).');
  if (body.videoSource !== undefined && !['configured', 'google_flow'].includes(String(body.videoSource))) throw new PublishingError('Nguồn tạo video không hợp lệ.');
  const autoCutTemplateId = body.autoCutTemplateId;
  if (autoCutTemplateId !== undefined && (typeof autoCutTemplateId !== 'string' || !/^[a-zA-Z0-9_-]{1,150}$/.test(autoCutTemplateId))) throw new PublishingError('Template AutoCut không hợp lệ.');
  return { ...(body.videoSource === 'google_flow' ? { videoSource: 'google_flow' } : {}), ...(autoCutTemplateId ? { autoCutTemplateId } : {}), productIds: [...new Set(body.productIds as string[])].sort(), channelId: body.channelId, clientKey: body.clientKey, style: style as string, duration };
}

export function productPublishingCopy(name: string, affiliateUrl: string) {
  const copy = parseReelCopy(JSON.stringify({ title: name.replace(/[\r\n]+/g, ' ').trim().slice(0, 100), caption: 'Khám phá sản phẩm trong video. Xem thông tin chi tiết và giá hiện tại tại link bên dưới.', hashtags: [] }));
  if (!affiliateUrl || affiliateUrl.length > 2000) throw new PublishingError('Sản phẩm chưa có link affiliate hợp lệ. Hãy tạo link trước khi chạy hàng loạt.');
  assertAffiliateUrl(affiliateUrl);
  reelText(copy, affiliateUrl);
  return copy;
}

export async function createVideoBatch(userId: string, body: Record<string, unknown>) {
  const input = parseBatchInput(body);
  await ensureFlowTemplates();
  // A stable batch ID makes retrying a request after a lost response safe.
  const batchId = createHash('sha256').update(`${userId}:${input.clientKey}`).digest('hex').slice(0, 32);
  const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  return publishingTransaction(async tx => {
    const previous = await tx.flowRun.findMany({ where: { userId, id: { startsWith: `${batchId}-` } } });
    if (previous.length) {
      if (previous.some(run => (run.inputData as Record<string, unknown>)?.fingerprint !== fingerprint)) throw new PublishingError('Yêu cầu này đã được dùng cho lựa chọn khác. Tải lại trang để tạo đợt mới.', 409);
      return { batchId, runs: previous };
    }
    let autoCut: { templateId: string; templateDigest: string } | null = null;
    if (input.autoCutTemplateId) {
      const worker = await workerStatus();
      const template = worker.templates.find(t => t.id === input.autoCutTemplateId);
      if (!worker.online || worker.state === 'blocked' || !template) throw new PublishingError('Worker AutoCut hoặc template chưa sẵn sàng.', 503);
      if (Math.abs(template.duration - input.duration) > 1) throw new PublishingError('Thời lượng template phải khớp thời lượng video đã chọn.');
      autoCut = { templateId: template.id, templateDigest: template.digest };
    }
    const templateId = autoCut ? AUTOCUT_BATCH_TEMPLATE_ID : BATCH_FACEBOOK_TEMPLATE_ID;
    const steps = templates.find(template => template.id === templateId)!.steps;
    const channel = await tx.publishingChannel.findFirst({ where: { id: input.channelId, userId } });
    if (!channel) throw new PublishingError('Kiểm tra và bật tự đăng cho Page trong Quản lý đăng bài trước.');
    const products = await tx.product.findMany({ where: { id: { in: input.productIds }, userId }, include: { affiliateLinks: { where: { userId, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, take: 1 } } });
    if (products.length !== input.productIds.length) throw new PublishingError('Có sản phẩm không tồn tại hoặc không thuộc tài khoản này.');
    // Validate the entire selection before creating any project.
    const prepared = input.productIds.map(id => {
      const product = products.find(p => p.id === id)!;
      const affiliateUrl = product.affiliateLinks[0]?.affiliateUrl || '';
      const copy = affiliateUrl ? productPublishingCopy(product.name, affiliateUrl) : null;
      if (!product.image) throw new PublishingError(`Sản phẩm ${product.name} chưa có ảnh.`);
      return { product, affiliateUrl, copy };
    });
    const runs = [];
    for (const [index, { product, affiliateUrl, copy }] of prepared.entries()) {
      const project = await tx.aIVideoProject.create({ data: { userId, productId: product.id, title: product.name, productDescription: buildProductBrief(product), productImages: [product.image], style: input.style, duration: input.duration, language: 'vi', status: 'draft' } });
      runs.push(await tx.flowRun.create({ data: {
        id: `${batchId}-${index}`, userId, templateId, videoProjectId: project.id, status: 'pending',
        inputData: { ...(input.videoSource ? { videoSource: input.videoSource } : {}), ...(autoCut ? { autoCut } : {}), batchId, fingerprint, projectId: project.id, reviewRequired: true, facebook: { channelId: channel.id, affiliateUrl, copy: copy ? { ...copy } : null } },
        stepRuns: { create: steps.map(step => ({ stepId: step.id, stepType: step.type, stepName: step.name, status: 'pending' })) },
      } }));
    }
    return { batchId, runs };
  });
}

export async function queueBatchFacebook(projectId: string, runId: string) {
  // Read the persisted authorization, never generated step output.
  const run = await db.flowRun.findUnique({ where: { id: runId } });
  if (!run || run.videoProjectId !== projectId || ![AUTOCUT_BATCH_TEMPLATE_ID, BATCH_FACEBOOK_TEMPLATE_ID, LEGACY_BATCH_FACEBOOK_TEMPLATE_ID].includes(run.templateId)) throw new PublishingError('Không tìm thấy yêu cầu đăng hàng loạt.');
  const input = run.inputData as { reviewRequired?: boolean; facebook?: { channelId: string; affiliateUrl: string; copy: { title: string; caption: string; hashtags: string[] } } };
  if (!input.facebook) throw new PublishingError('Thiếu cấu hình Facebook.');
  if (!input.facebook.affiliateUrl || !input.facebook.copy) throw new PublishingError('Chưa có link affiliate thật hoặc nội dung đã tạo.');
  const { createPosts } = await import('../publishing/manager');
  // Assembly has already persisted the final MP4; publishing validates it again.
  await db.aIVideoProject.update({ where: { id: projectId }, data: { status: 'completed' } });
  const posts = await createPosts(run.userId, { projectId, channelIds: [input.facebook.channelId], affiliateUrl: input.facebook.affiliateUrl, copy: input.facebook.copy, mode: 'draft', clientKey: `batch-${runId}` });
  return { publishingPostIds: posts.map(post => post.id) };
}

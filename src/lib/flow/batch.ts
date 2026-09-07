import { createHash } from 'node:crypto';
import { db } from '../db';
import { PublishingError, publishingTransaction } from '../publishing/manager';
import { parseReelCopy, reelText } from '../publishing/reels';
import { BATCH_FACEBOOK_TEMPLATE_ID, ensureFlowTemplates, templates } from './templates';

export function parseBatchInput(body: Record<string, unknown>) {
  if (!Array.isArray(body.productIds) || !body.productIds.length || body.productIds.length > 50 || body.productIds.some(id => typeof id !== 'string' || !id)) throw new PublishingError('Chọn từ 1–50 sản phẩm.');
  if (typeof body.channelId !== 'string' || !body.channelId) throw new PublishingError('Chọn Page Facebook.');
  if (typeof body.clientKey !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(body.clientKey)) throw new PublishingError('Mã yêu cầu không hợp lệ.');
  const style = body.style ?? 'professional';
  const duration = body.duration ?? 30;
  if (!['professional', 'trendy', 'minimal', 'energetic', 'luxury'].includes(String(style))) throw new PublishingError('Phong cách không hợp lệ.');
  if (![15, 30, 60].includes(Number(duration)) || typeof duration !== 'number') throw new PublishingError('Chọn thời lượng 15, 30 hoặc 60 giây.');
  return { productIds: [...new Set(body.productIds as string[])].sort(), channelId: body.channelId, clientKey: body.clientKey, style: style as string, duration };
}

export function productPublishingCopy(name: string, affiliateUrl: string) {
  const copy = parseReelCopy(JSON.stringify({ title: name.replace(/[\r\n]+/g, ' ').trim().slice(0, 100), caption: 'Khám phá sản phẩm trong video. Xem thông tin chi tiết và giá hiện tại tại link bên dưới.', hashtags: [] }));
  if (!affiliateUrl || affiliateUrl.length > 2000) throw new PublishingError('Sản phẩm chưa có link affiliate hợp lệ. Hãy tạo link trước khi chạy hàng loạt.');
  reelText(copy, affiliateUrl);
  return copy;
}

export async function createVideoBatch(userId: string, body: Record<string, unknown>) {
  const input = parseBatchInput(body);
  await ensureFlowTemplates();
  // A stable batch ID makes retrying a request after a lost response safe.
  const batchId = createHash('sha256').update(`${userId}:${input.clientKey}`).digest('hex').slice(0, 32);
  const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const steps = templates.find(template => template.id === BATCH_FACEBOOK_TEMPLATE_ID)!.steps;
  return publishingTransaction(async tx => {
    const previous = await tx.flowRun.findMany({ where: { userId, id: { startsWith: `${batchId}-` } } });
    if (previous.length) {
      if (previous.some(run => (run.inputData as Record<string, unknown>)?.fingerprint !== fingerprint)) throw new PublishingError('Yêu cầu này đã được dùng cho lựa chọn khác. Tải lại trang để tạo đợt mới.', 409);
      return { batchId, runs: previous };
    }
    const channel = await tx.publishingChannel.findFirst({ where: { id: input.channelId, userId, paused: false, verifiedAt: { not: null } } });
    if (!channel) throw new PublishingError('Kiểm tra và bật tự đăng cho Page trong Quản lý đăng bài trước.');
    const products = await tx.product.findMany({ where: { id: { in: input.productIds }, userId }, include: { affiliateLinks: { where: { userId, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, take: 1 } } });
    if (products.length !== input.productIds.length) throw new PublishingError('Có sản phẩm không tồn tại hoặc không thuộc tài khoản này.');
    // Validate the entire selection before creating any project.
    const prepared = input.productIds.map(id => {
      const product = products.find(p => p.id === id)!;
      const affiliateUrl = product.affiliateLinks[0]?.affiliateUrl || '';
      const copy = productPublishingCopy(product.name, affiliateUrl);
      if (!product.image) throw new PublishingError(`Sản phẩm ${product.name} chưa có ảnh.`);
      return { product, affiliateUrl, copy };
    });
    const runs = [];
    for (const [index, { product, affiliateUrl, copy }] of prepared.entries()) {
      const project = await tx.aIVideoProject.create({ data: { userId, productId: product.id, title: product.name, productDescription: product.name, productImages: [product.image], style: input.style, duration: input.duration, language: 'vi', status: 'scripting' } });
      runs.push(await tx.flowRun.create({ data: {
        id: `${batchId}-${index}`, userId, templateId: BATCH_FACEBOOK_TEMPLATE_ID, videoProjectId: project.id, status: 'pending',
        inputData: { batchId, fingerprint, projectId: project.id, facebook: { channelId: channel.id, affiliateUrl, copy: { ...copy } } },
        stepRuns: { create: steps.map(step => ({ stepId: step.id, stepType: step.type, stepName: step.name, status: 'pending' })) },
      } }));
    }
    return { batchId, runs };
  });
}

export async function queueBatchFacebook(projectId: string, runId: string) {
  // Read the persisted authorization, never generated step output.
  const run = await db.flowRun.findUnique({ where: { id: runId } });
  if (!run || run.videoProjectId !== projectId || run.templateId !== BATCH_FACEBOOK_TEMPLATE_ID) throw new PublishingError('Không tìm thấy yêu cầu đăng hàng loạt.');
  const input = run.inputData as { facebook?: { channelId: string; affiliateUrl: string; copy: { title: string; caption: string; hashtags: string[] } } };
  if (!input.facebook) throw new PublishingError('Thiếu cấu hình Facebook.');
  const { createPosts } = await import('../publishing/manager');
  // Assembly has already persisted the final MP4; publishing validates it again.
  await db.aIVideoProject.update({ where: { id: projectId }, data: { status: 'completed' } });
  const posts = await createPosts(run.userId, { projectId, channelIds: [input.facebook.channelId], affiliateUrl: input.facebook.affiliateUrl, copy: input.facebook.copy, mode: 'queue', clientKey: `batch-${runId}` });
  return { publishingPostIds: posts.map(post => post.id) };
}

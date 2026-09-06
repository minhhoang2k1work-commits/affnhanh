import { Prisma } from '@prisma/client';
import { db } from '../db';
import { buildIndustryPrompt, isServiceUrl } from '../products/industry';
import { AgentCommand, HELP, marketplaceUrl, parseCommand } from './commands';
import { authorizedMessage, telegramConfig } from './config';
import { sendTelegramText } from './client';

type Outcome = { reply: string; jobId?: string; scanJobId?: string };

async function execute(tx: Prisma.TransactionClient, userId: string, command: AgentCommand): Promise<Outcome> {
  const { action, argument } = command;
  if (action === 'help') return { reply: HELP };
  if (action === 'status') {
    const [products, queued, device] = await Promise.all([
      tx.product.count({ where: { userId } }),
      tx.extensionJob.count({ where: { userId, status: 'queued' } }),
      tx.extensionDevice.findFirst({ where: { userId }, orderBy: { lastSeenAt: 'desc' } }),
    ]);
    return { reply: `AFF HUB đang hoạt động.\nSản phẩm: ${products}\nViệc chờ extension: ${queued}\nExtension: ${device && Date.now() - device.lastSeenAt.getTime() < 120000 ? 'vừa kết nối' : 'chưa thấy kết nối trong 2 phút; cần mở Chrome + extension'}` };
  }
  if (action === 'industries') {
    const rows = await tx.industryWorkspace.findMany({ where: { userId }, take: 20, orderBy: { name: 'asc' } });
    return { reply: rows.map(w => `${w.name}\nMã: ${w.id}\nFlow: ${w.flowUrl || 'Chưa gắn'}`).join('\n\n') || 'Chưa có ngành hàng. Tạo hồ sơ trong Ngành hàng & Prompt trên web.' };
  }
  if (action === 'products') {
    const rows = await tx.product.findMany({ where: { userId, ...(argument ? { name: { contains: argument, mode: 'insensitive' as const } } : {}) }, take: 10, orderBy: { updatedAt: 'desc' }, select: { id: true, name: true, category: true } });
    return { reply: rows.map(p => `${p.name}\nMã: ${p.id}\nNgành: ${p.category || 'Chưa gán'}`).join('\n\n') || 'Không tìm thấy sản phẩm.' };
  }
  if (action === 'jobs') {
    const rows = await tx.extensionJob.findMany({ where: { userId }, take: 10, orderBy: { createdAt: 'desc' }, select: { id: true, type: true, status: true } });
    return { reply: rows.map(j => `${j.id}\n${j.type}: ${j.status}`).join('\n\n') || 'Chưa có công việc.' };
  }
  if (!argument) throw new Error('Lệnh thiếu tham số. Gửi /help để xem ví dụ.');
  if (action === 'scan') {
    const url = marketplaceUrl(argument);
    const scan = await tx.scanJob.create({ data: { userId, source: 'telegram', targetUrl: url, totalShops: 1, type: 'SINGLE', status: 'queued', items: { create: { shopUrl: url, status: 'queued' } } } });
    const job = await tx.extensionJob.create({ data: { userId, type: 'SCAN_SHOP', targetUrl: url, scanJobId: scan.id, payload: JSON.stringify({ source: 'telegram' }) } });
    return { reply: `Đã xếp hàng quét shop.\nMã việc: ${job.id}\nExtension sẽ nhận khi Chrome đang chạy.`, jobId: job.id, scanJobId: scan.id };
  }
  if (action === 'cancel') {
    const job = await tx.extensionJob.findFirst({ where: { id: argument, userId } });
    if (!job) throw new Error('Không tìm thấy mã công việc của bạn.');
    const cancelled = await tx.extensionJob.updateMany({ where: { id: job.id, userId, status: 'queued' }, data: { status: 'cancelled', completedAt: new Date() } });
    if (!cancelled.count) return { reply: `Công việc đang ${job.status}. Lệnh này chỉ hủy việc còn chờ; việc đã chạy cần dừng trên web/extension.` };
    if (job.scanJobId) await tx.scanJob.updateMany({ where: { id: job.scanJobId, userId }, data: { status: 'cancelled', completedAt: new Date() } });
    return { reply: `Đã hủy việc chờ ${job.id}.` };
  }
  if (action === 'prompt' || action === 'chatgpt') {
    const workspace = await tx.industryWorkspace.findFirst({ where: { userId, OR: [{ id: argument }, { name: { equals: argument, mode: 'insensitive' } }] } });
    if (!workspace) throw new Error('Không tìm thấy ngành hàng. Gửi /industries để lấy tên/mã chính xác.');
    const products = await tx.product.findMany({ where: { userId, category: workspace.name }, take: 5, orderBy: { updatedAt: 'desc' } });
    const referenceLinks = Array.isArray(workspace.referenceLinks) ? workspace.referenceLinks.filter((v): v is string => typeof v === 'string') : [];
    const prompt = buildIndustryPrompt({ ...workspace, referenceLinks }, products, referenceLinks.map(url => ({ url, status: 'Chưa đọc mới; sử dụng hồ sơ sản phẩm đã lưu, không suy đoán nội dung URL.' })));
    if (action === 'prompt') return { reply: prompt };
    if (!isServiceUrl(workspace.chatgptUrl, 'chatgpt')) throw new Error('Link ChatGPT của ngành hàng không hợp lệ.');
    if (prompt.length > 250000) throw new Error('Prompt quá dài. Giảm dữ liệu hoặc dùng trang Ngành hàng & Prompt để chọn ít sản phẩm hơn.');
    const job = await tx.extensionJob.create({ data: { userId, type: 'SEND_CHATGPT_PROMPT', payload: JSON.stringify({ source: 'telegram', url: workspace.chatgptUrl, prompt }) } });
    return { reply: `Đã xếp hàng gửi prompt ngành ${workspace.name} sang ChatGPT (tối đa 5 sản phẩm cập nhật gần nhất).\nMã việc: ${job.id}\nKết quả viết prompt sẽ xuất hiện trong ChatGPT.`, jobId: job.id };
  }
  if (action === 'video') {
    const product = await tx.product.findFirst({ where: { id: argument, userId } });
    if (!product) throw new Error('Không tìm thấy mã sản phẩm. Gửi /products từ khóa để tìm.');
    const workspace = product.category ? await tx.industryWorkspace.findUnique({ where: { userId_name: { userId, name: product.category } } }) : null;
    if (!workspace || !isServiceUrl(workspace.flowUrl, 'flow', true) || !isServiceUrl(workspace.chatgptUrl, 'chatgpt')) throw new Error('Gán ngành hàng và lưu link ChatGPT + dự án Flow trước khi tạo video.');
    if (!product.image) throw new Error('Sản phẩm chưa có ảnh tham chiếu.');
    const data = product.marketplaceData && typeof product.marketplaceData === 'object' && !Array.isArray(product.marketplaceData) ? product.marketplaceData : {};
    const job = await tx.extensionJob.create({ data: { userId, productId: product.id, type: 'GENERATE_VIDEO', payload: JSON.stringify({
      source: 'telegram', productId: product.id, productName: product.name, imageData: product.image,
      basePrompt: workspace.basePrompt, referenceLinks: workspace.referenceLinks, chatgptUrl: workspace.chatgptUrl, flowUrl: workspace.flowUrl,
      productContext: { ...data, id: product.id, name: product.name, originalUrl: product.originalUrl, category: product.category, targetCustomer: product.targetCustomer },
      flowOptions: { reuseProject: true, referenceMode: 'ingredient', aspectRatio: '9:16', duration: 8, outputCount: 1 },
    }) } });
    return { reply: `Đã xếp hàng tạo video: ${product.name}.\nMã việc: ${job.id}\nDùng dự án Flow đã gắn, có sử dụng credit tạo video.`, jobId: job.id };
  }
  return { reply: HELP };
}

export async function handleTelegramUpdate(update: unknown) {
  const message = authorizedMessage(update);
  if (!message) return { ignored: true };
  const config = telegramConfig();
  const id = `${config.token.split(':')[0]}:${message.updateId}`;
  try {
    // Receipt and all queued side effects commit together. Telegram retries cannot enqueue twice.
    await db.$transaction(async tx => {
      if (await tx.telegramCommand.findUnique({ where: { id } })) return;
      const recent = await tx.telegramCommand.count({ where: { telegramUserId: message.senderId, createdAt: { gte: new Date(Date.now() - 60000) } } });
      await tx.telegramCommand.create({ data: { id, userId: config.userId, telegramUserId: message.senderId, chatId: message.chatId, text: message.text } });
      const command = parseCommand(message.text);
      let result: Outcome;
      let status = 'completed';
      try {
        result = recent >= 20 ? { reply: 'Bạn đã gửi nhiều lệnh trong một phút. Hãy chờ một chút.' }
          : command ? await execute(tx, config.userId, command) : { reply: `Chưa hiểu lệnh này. Agent hiện hỗ trợ các lệnh AFF HUB sau:\n\n${HELP}` };
      } catch (error) {
        // Business validation only; database errors roll back the receipt for a safe retry.
        if (error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Prisma.PrismaClientUnknownRequestError || error instanceof Prisma.PrismaClientInitializationError || error instanceof Prisma.PrismaClientValidationError || error instanceof Prisma.PrismaClientRustPanicError) throw error;
        result = { reply: error instanceof Error ? error.message : 'Không thực hiện được lệnh.' }; status = 'failed';
      }
      await tx.telegramCommand.update({ where: { id }, data: { ...result, status: result.jobId ? 'queued' : status } });
    }, { timeout: 15000 });
  } catch (error) { if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error; }
  await deliverReply(id);
  return { accepted: true };
}

async function deliverReply(id: string) {
  const record = await db.telegramCommand.findUnique({ where: { id } });
  if (!record?.reply || record.replySentAt) return;
  const config = telegramConfig();
  if (record.userId !== config.userId || !record.id.startsWith(`${config.token.split(':')[0]}:`) || !config.allowedUsers.includes(record.telegramUserId)) return;
  try {
    await sendTelegramText(record.chatId, record.reply);
    await db.telegramCommand.update({ where: { id }, data: { replySentAt: new Date() } });
  } catch {
    // Rotate failed deliveries so one blocked chat cannot starve the notification queue.
    await db.telegramCommand.update({ where: { id }, data: { updatedAt: new Date() } });
  }
}

export async function flushTelegramNotifications() {
  const config = telegramConfig();
  const pending = await db.telegramCommand.findMany({ where: { id: { startsWith: `${config.token.split(':')[0]}:` }, userId: config.userId, telegramUserId: { in: config.allowedUsers }, OR: [{ replySentAt: null }, { jobId: { not: null }, notifiedAt: null }] }, take: 20, orderBy: { updatedAt: 'asc' } });
  const deadline = Date.now() + 20000;
  for (const record of pending) {
    if (Date.now() >= deadline) break;
    await db.telegramCommand.update({ where: { id: record.id }, data: { updatedAt: new Date() } });
    if (!record.replySentAt) await deliverReply(record.id);
    if (!record.jobId || record.notifiedAt) continue;
    const job = await db.extensionJob.findFirst({ where: { id: record.jobId, userId: config.userId } });
    const scan = record.scanJobId ? await db.scanJob.findFirst({ where: { id: record.scanJobId, userId: config.userId } }) : null;
    const state = scan?.status || job?.status;
    if (!state || !['completed', 'failed', 'cancelled', 'partial_success'].includes(state)) continue;
    let links: string[] = [];
    try { const result = JSON.parse(job?.result || '{}'); links = (result.resultLinks || []).filter((v: unknown) => typeof v === 'string' && /^https:\/\//.test(v)); } catch {}
    await sendTelegramText(record.chatId, `Công việc ${record.jobId}: ${state}.${scan ? `\nĐã lưu ${scan.processedProducts} sản phẩm.` : ''}${links.length ? '\n' + links.join('\n') : ''}`);
    await db.telegramCommand.update({ where: { id: record.id }, data: { notifiedAt: new Date(), status: state } });
  }
  return { checked: pending.length };
}

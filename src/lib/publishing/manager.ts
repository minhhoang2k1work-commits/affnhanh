import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { db } from '../db';
import { parseReelCopy, reelText } from './reels';
import { GENERATED_VIDEO, facebookPermalink, nextQueueSlot, parseSlots, validateSchedule } from './schedule';

export class PublishingError extends Error { constructor(message: string, public status = 400) { super(message); } }
type Tx = Prisma.TransactionClient;
export async function publishingTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await db.$transaction(work, { isolationLevel: 'Serializable', timeout: 10000 }); }
    catch (error) { if ((error as { code?: string }).code !== 'P2034' || attempt >= 2) throw error; }
  }
}
const event = (tx: Tx, postId: string, status: string, message: string) => tx.publishingEvent.create({ data: { postId, status, message } });

export async function saveChannel(userId: string, body: Record<string, unknown>) {
  if (body.id && typeof body.id !== 'string') throw new PublishingError('ID kênh không hợp lệ.');
  return publishingTransaction(async tx => {
    if (body.id && typeof body.paused === 'boolean' && !body.pageId) {
      const channel = await tx.publishingChannel.findFirst({ where: { id: body.id as string, userId } });
      if (!channel) throw new PublishingError('Không tìm thấy kênh.', 404);
      if (!body.paused && !channel.verifiedAt) throw new PublishingError('Kiểm tra Page bằng đúng hồ sơ Chrome trước khi bật tự đăng.');
      return tx.publishingChannel.update({ where: { id: channel.id }, data: { paused: body.paused } });
    }
    const { pageId, name, deviceId, profileName } = body;
    if (typeof pageId !== 'string' || !/^\d{5,30}$/.test(pageId) || typeof name !== 'string' || !name.trim() || name.length > 200 || typeof profileName !== 'string' || !profileName.trim() || profileName.length > 100 || typeof deviceId !== 'string') throw new PublishingError('Nhập ID Page, tên Page, hồ sơ Chrome và thiết bị hợp lệ.');
    const slots = parseSlots(body.slots);
    const graceMinutes = body.graceMinutes ?? 15;
    if (!Number.isInteger(graceMinutes) || Number(graceMinutes) < 1 || Number(graceMinutes) > 60) throw new PublishingError('Thời gian cho phép trễ phải từ 1–60 phút.');
    const device = await tx.extensionDevice.findFirst({ where: { id: deviceId, userId } });
    if (!device) throw new PublishingError('Thiết bị chưa kết nối với AFF. Mở AFF trong hồ sơ có extension trước.');
    const existing = body.id ? await tx.publishingChannel.findFirst({ where: { id: body.id as string, userId } }) : null;
    if (body.id && !existing) throw new PublishingError('Không tìm thấy kênh.', 404);
    if (existing && await tx.publishingPost.count({ where: { channelId: existing.id, status: { in: ['preparing', 'submitted_unknown', 'needs_attention'] } } })) throw new PublishingError('Kênh có bài đang chạy hoặc chưa rõ kết quả; xử lý bài đó trước khi đổi cấu hình.', 409);
    const changedIdentity = !existing || existing.pageId !== pageId || existing.name !== name.trim() || existing.deviceId !== deviceId;
    const data = { pageId, name: name.trim(), deviceId, profileName: profileName.trim(), slots, graceMinutes: Number(graceMinutes), ...(changedIdentity ? { paused: true, verifiedAt: null } : {}) };
    return existing ? tx.publishingChannel.update({ where: { id: existing.id }, data }) : tx.publishingChannel.create({ data: { ...data, userId } });
  });
}

export async function syncPublisherPages(deviceId: string, userId: string, input: unknown) {
  if (!Array.isArray(input) || !input.length || input.length > 100) throw new PublishingError('Danh sách Page không hợp lệ.');
  const pages = input.map(page => {
    if (!page || typeof page.pageId !== 'string' || !/^\d{5,30}$/.test(page.pageId) || typeof page.pageName !== 'string' || !page.pageName.trim() || page.pageName.length > 200) throw new PublishingError('Tên hoặc ID Page không hợp lệ.');
    return { pageId: page.pageId as string, name: (page.pageName as string).trim() };
  });
  return publishingTransaction(async tx => {
    const channels = [];
    for (const page of pages) {
      const existing = await tx.publishingChannel.findUnique({ where: { userId_pageId: { userId, pageId: page.pageId } } });
      // Do not reassign an existing channel, invalidate schedules, or enable publishing during discovery.
      if (existing) { channels.push({ id: existing.id, pageId: existing.pageId, existing: true, otherDevice: existing.deviceId !== deviceId }); continue; }
      const created = await tx.publishingChannel.create({ data: { ...page, userId, deviceId, profileName: `Chrome ${deviceId.slice(0, 8)}`, slots: ['09:00', '19:00'], graceMinutes: 15, paused: true, verifiedAt: null } });
      channels.push({ id: created.id, pageId: created.pageId, existing: false, otherDevice: false });
    }
    return { channels };
  });
}

export async function createPosts(userId: string, body: Record<string, unknown>) {
  const copy = parseReelCopy(JSON.stringify(body.copy));
  const affiliateUrl = typeof body.affiliateUrl === 'string' ? body.affiliateUrl : '';
  if (affiliateUrl.length > 2000) throw new PublishingError('Link sản phẩm quá dài.');
  const text = reelText(copy, affiliateUrl);
  const channelIds = Array.isArray(body.channelIds) ? [...new Set(body.channelIds)] : [];
  if (!channelIds.length || channelIds.length > 20 || channelIds.some(id => typeof id !== 'string')) throw new PublishingError('Chọn từ 1–20 Page.');
  if (typeof body.projectId !== 'string' || typeof body.clientKey !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(body.clientKey)) throw new PublishingError('Thiếu video hoặc mã yêu cầu hợp lệ.');
  if (!['draft', 'time', 'queue', 'now'].includes(String(body.mode))) throw new PublishingError('Chế độ lên lịch không hợp lệ.');
  return publishingTransaction(async tx => {
    const project = await tx.aIVideoProject.findFirst({ where: { id: body.projectId as string, userId, status: 'completed' } });
    if (!project?.videoUrl || !GENERATED_VIDEO.test(project.videoUrl)) throw new PublishingError('Chọn video hoàn tất có tệp MP4 trong generated.');
    const posts = [];
    for (const channelId of channelIds as string[]) {
      const clientKey = `${body.clientKey}:${channelId}`;
      const previous = await tx.publishingPost.findUnique({ where: { userId_clientKey: { userId, clientKey } } });
      if (previous) { posts.push(previous); continue; }
      const channel = await tx.publishingChannel.findFirst({ where: { id: channelId, userId } });
      if (!channel) throw new PublishingError('Có Page không thuộc tài khoản này.');
      if (body.mode !== 'draft' && (!channel.verifiedAt || channel.paused)) throw new PublishingError(`Kiểm tra và bật tự đăng cho Page ${channel.name} trước.`);
      const occupied = await tx.publishingPost.findMany({ where: { channelId, status: { in: ['scheduled', 'preparing'] } }, select: { scheduledAt: true } });
      const dates = occupied.flatMap(p => p.scheduledAt ? [p.scheduledAt] : []);
      const scheduledAt = body.mode === 'draft' ? null : body.mode === 'now' ? new Date() : body.mode === 'queue' ? nextQueueSlot(channel.slots as string[], dates) : validateSchedule(body.scheduledAt);
      if (scheduledAt && dates.some(d => Math.abs(d.getTime() - scheduledAt.getTime()) < 5 * 60000)) throw new PublishingError(`Page ${channel.name} đã có bài trong vòng 5 phút quanh giờ này.`);
      const status = scheduledAt ? 'scheduled' : 'draft';
      const post = await tx.publishingPost.create({ data: { userId, channelId, projectId: project.id, videoUrl: project.videoUrl, ...copy, affiliateUrl, text, clientKey, status, scheduledAt } });
      await event(tx, post.id, status, status === 'draft' ? 'Đã lưu bản nháp.' : 'Người dùng đã duyệt nội dung và cho phép extension đăng theo lịch.');
      posts.push(post);
    }
    return posts;
  });
}

export async function changePost(userId: string, id: string, body: Record<string, unknown>) {
  return publishingTransaction(async tx => {
    const post = await tx.publishingPost.findFirst({ where: { id, userId }, include: { channel: true } });
    if (!post) throw new PublishingError('Không tìm thấy bài.', 404);
    const action = body.action;
    if (action === 'not_published') {
      if (post.status !== 'submitted_unknown' || body.reviewed !== true) throw new PublishingError('Cần kiểm tra Facebook và xác nhận bài chưa được đăng.');
      await tx.publishingPost.update({ where: { id }, data: { status: 'draft', submittedAt: null, scheduledAt: null, leaseToken: null, leaseUntil: null, error: null } });
      if (post.leaseToken) await tx.extensionDevice.updateMany({ where: { id: post.channel.deviceId, publishingLease: post.leaseToken }, data: { publishingLease: null, publishingLeaseUntil: null } });
      await event(tx, id, 'draft', 'Người dùng xác nhận đã kiểm tra Facebook: bài chưa xuất bản, trả về nháp.'); return;
    }
    if (action === 'confirm') {
      if (!['submitted_unknown', 'needs_attention'].includes(post.status)) throw new PublishingError('Bài chưa ở trạng thái cần xác nhận.');
      const permalink = facebookPermalink(body.permalink);
      await tx.publishingPost.update({ where: { id }, data: { status: 'published', permalink, publishedAt: new Date(), error: null } });
      if (post.leaseToken) await tx.extensionDevice.updateMany({ where: { id: post.channel.deviceId, publishingLease: post.leaseToken }, data: { publishingLease: null, publishingLeaseUntil: null } });
      await event(tx, id, 'published', 'Người dùng đã kiểm tra đúng Page/video và xác nhận link xuất bản.');
      return;
    }
    if (action === 'cancel') {
      if (!['draft', 'scheduled', 'missed', 'needs_attention'].includes(post.status)) throw new PublishingError('Không thể hủy bài đang chạy hoặc đã gửi lệnh đăng.');
      await tx.publishingPost.update({ where: { id }, data: { status: 'cancelled', leaseToken: null, leaseUntil: null } });
      await event(tx, id, 'cancelled', 'Người dùng đã hủy lịch; không xóa bài trên Facebook.'); return;
    }
    if (action === 'reschedule' || action === 'edit') {
      if (!['draft', 'scheduled', 'missed', 'needs_attention', 'cancelled'].includes(post.status)) throw new PublishingError('Không sửa bài đang chạy hoặc chưa rõ kết quả xuất bản.');
      if (post.status === 'needs_attention' && body.reviewed !== true) throw new PublishingError('Kiểm tra bản nháp Facebook trước khi lên lịch lại.');
      const copy = body.copy ? parseReelCopy(JSON.stringify(body.copy)) : { title: post.title, caption: post.caption, hashtags: post.hashtags as string[] };
      const affiliateUrl = typeof body.affiliateUrl === 'string' ? body.affiliateUrl : post.affiliateUrl;
      const text = reelText(copy, affiliateUrl);
      let scheduledAt = post.scheduledAt;
      if (action === 'reschedule') {
        if (post.channel.paused || !post.channel.verifiedAt) throw new PublishingError('Kiểm tra và bật tự đăng cho kênh trước.');
        scheduledAt = validateSchedule(body.scheduledAt);
        const conflict = await tx.publishingPost.count({ where: { id: { not: id }, channelId: post.channelId, status: { in: ['scheduled', 'preparing'] }, scheduledAt: { gt: new Date(scheduledAt.getTime() - 300000), lt: new Date(scheduledAt.getTime() + 300000) } } });
        if (conflict) throw new PublishingError('Page đã có bài trong vòng 5 phút quanh giờ này.');
      }
      // Editing a scheduled post returns it to draft: its new content needs explicit scheduling.
      const status = action === 'edit' ? 'draft' : 'scheduled';
      await tx.publishingPost.update({ where: { id }, data: { ...copy, affiliateUrl, text, status, scheduledAt: status === 'draft' ? null : scheduledAt, leaseToken: null, leaseUntil: null, error: null } });
      await event(tx, id, status, action === 'edit' ? 'Đã sửa nội dung, trả về nháp để duyệt lịch mới.' : 'Người dùng đã duyệt giờ đăng mới.'); return;
    }
    throw new PublishingError('Thao tác không hợp lệ.');
  });
}

export async function authenticatePublisher(body: Record<string, unknown>) {
  if (typeof body.deviceToken !== 'string' || typeof body.licenseKey !== 'string') throw new PublishingError('Thiếu thông tin kết nối extension.', 401);
  const [device, licensed] = await Promise.all([
    db.extensionDevice.findUnique({ where: { deviceToken: body.deviceToken } }),
    db.licenseDevice.findUnique({ where: { deviceToken: body.deviceToken }, include: { license: true } }),
  ]);
  if (!device || !licensed || licensed.license.key !== body.licenseKey || !licensed.license.isActive || (licensed.license.expiresAt && licensed.license.expiresAt < new Date())) throw new PublishingError('Extension chưa được cấp quyền hoặc bản quyền hết hạn.', 403);
  return device;
}

export async function claimPost(deviceId: string, userId: string) {
  return publishingTransaction(async tx => {
    const now = new Date();
    await tx.extensionDevice.update({ where: { id: deviceId }, data: { publishingLastSeenAt: now } });
    const lock = randomUUID();
    const leaseUntil = new Date(now.getTime() + 8 * 60000);
    const locked = await tx.extensionDevice.updateMany({ where: { id: deviceId, OR: [{ publishingLeaseUntil: null }, { publishingLeaseUntil: { lt: now } }] }, data: { publishingLease: lock, publishingLeaseUntil: leaseUntil } });
    if (!locked.count) return null;
    const expired = await tx.publishingPost.findMany({ where: { userId, channel: { deviceId }, status: 'preparing', leaseUntil: { lt: now } } });
    for (const post of expired) {
      await tx.publishingPost.update({ where: { id: post.id }, data: { status: 'needs_attention', error: 'Extension bị ngắt khi chuẩn bị. Kiểm tra bản nháp Facebook trước khi lên lịch lại.' } });
      await event(tx, post.id, 'needs_attention', 'Phiên xử lý hết hạn; không tự thử lại.');
    }
    const due = await tx.publishingPost.findMany({ where: { userId, status: 'scheduled', scheduledAt: { lte: now }, channel: { deviceId, paused: false, verifiedAt: { not: null } } }, include: { channel: true }, orderBy: { scheduledAt: 'asc' }, take: 50 });
    for (const post of due) {
      if (now.getTime() - post.scheduledAt!.getTime() > post.channel.graceMinutes * 60000) {
        await tx.publishingPost.update({ where: { id: post.id }, data: { status: 'missed', error: 'Đã quá thời gian cho phép trễ. Hãy chọn lịch mới.' } });
        await event(tx, post.id, 'missed', 'Bỏ qua giờ đã lỡ; không đăng bù tự động.'); continue;
      }
      // An unresolved post in this Chrome profile blocks further automated publications.
      if (await tx.publishingPost.count({ where: { userId, channel: { deviceId }, status: { in: ['submitted_unknown', 'needs_attention'] } } })) break;
      const claimed = await tx.publishingPost.updateMany({ where: { id: post.id, status: 'scheduled' }, data: { status: 'preparing', leaseToken: lock, leaseUntil, attempts: { increment: 1 }, error: null } });
      if (!claimed.count) continue;
      await event(tx, post.id, 'preparing', 'Extension đúng hồ sơ đã nhận bài.');
      return { id: post.id, leaseToken: lock, pageId: post.channel.pageId, pageName: post.channel.name, text: post.text, videoUrl: post.videoUrl, projectId: post.projectId };
    }
    await tx.extensionDevice.updateMany({ where: { id: deviceId, publishingLease: lock }, data: { publishingLease: null, publishingLeaseUntil: null } });
    return null;
  });
}

export async function reportPost(deviceId: string, userId: string, body: Record<string, unknown>) {
  if (typeof body.id !== 'string' || typeof body.leaseToken !== 'string') throw new PublishingError('Thiếu phiên xử lý.', 400);
  return publishingTransaction(async tx => {
    const post = await tx.publishingPost.findFirst({ where: { id: body.id as string, userId, channel: { deviceId } }, include: { channel: true } });
    if (!post) throw new PublishingError('Phiên xử lý không khớp thiết bị.', 409);
    if (body.phase !== 'before_submit' && ['draft', 'cancelled', 'published'].includes(post.status)) return { allowed: false };
    if (post.leaseToken !== body.leaseToken) throw new PublishingError('Phiên xử lý đã thay đổi.', 409);
    if (body.phase === 'before_submit') {
      if (post.status !== 'preparing' || !post.leaseUntil || post.leaseUntil < new Date() || post.channel.paused || !post.channel.verifiedAt) throw new PublishingError('Bài không còn được phép đăng. Kiểm tra trạng thái/kênh.', 409);
      await tx.publishingPost.update({ where: { id: post.id }, data: { status: 'submitted_unknown', submittedAt: new Date(), error: 'Đã cấp lệnh đăng; đang chờ đối chiếu kết quả Facebook.' } });
      await event(tx, post.id, 'submitted_unknown', 'Đã đánh dấu trước thao tác đăng để không gửi trùng nếu mất kết nối.');
      return { allowed: true };
    }
    if (body.phase === 'published') {
      if (post.status !== 'submitted_unknown') throw new PublishingError('Bài chưa được cấp lệnh đăng.', 409);
      const permalink = facebookPermalink(body.permalink);
      await tx.publishingPost.update({ where: { id: post.id }, data: { status: 'published', permalink, publishedAt: new Date(), error: null, leaseUntil: null } });
      await event(tx, post.id, 'published', 'Extension nhận thông báo xuất bản thành công và link Reel mới từ Facebook.');
      await tx.extensionDevice.updateMany({ where: { id: deviceId, publishingLease: post.leaseToken }, data: { publishingLease: null, publishingLeaseUntil: null } });
      return { allowed: false };
    }
    if (!['failed', 'submitted'].includes(String(body.phase))) throw new PublishingError('Trạng thái báo cáo không hợp lệ.');
    // Replayed completion is harmless; a late report cannot overwrite a user's confirmed result.
    if (!['preparing', 'submitted_unknown'].includes(post.status)) return { allowed: false };
    const status = post.status === 'submitted_unknown' ? 'submitted_unknown' : 'needs_attention';
    const message = typeof body.message === 'string' ? body.message.slice(0, 1200) : 'Kiểm tra tab Facebook và lịch sử bài.';
    await tx.publishingPost.update({ where: { id: post.id }, data: { status, error: message, leaseUntil: null } });
    await event(tx, post.id, status, message);
    await tx.extensionDevice.updateMany({ where: { id: deviceId, publishingLease: post.leaseToken }, data: { publishingLease: null, publishingLeaseUntil: null } });
    return { allowed: false };
  });
}

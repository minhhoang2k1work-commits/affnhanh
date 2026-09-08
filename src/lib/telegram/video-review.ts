import { promises as fs } from 'node:fs';
import path from 'node:path';
import { db } from '../db';
import { GENERATED_VIDEO } from '../publishing/schedule';
import { isTelegramConfigured, telegramConfig } from './config';
import { telegramCall, sendTelegramText } from './client';

export async function notifyVideoReview(runId: string) {
  const config = telegramConfig();
  const run = await db.flowRun.findUnique({ where: { id: runId } });
  if (!run?.videoProjectId || !isTelegramConfigured() || config.userId !== run.userId) throw new Error('Video chờ duyệt đã lưu. Cần cấu hình Telegram cho đúng tài khoản để gửi video.');
  const posts = await db.publishingPost.findMany({ where: { userId: run.userId, projectId: run.videoProjectId, clientKey: { startsWith: `batch-${runId}:` } }, include: { channel: true } });
  if (!posts.length) throw new Error('Chưa có bài trong danh sách chờ duyệt.');
  for (const post of posts) {
    if (post.status !== 'draft') continue;
    if (!GENERATED_VIDEO.test(post.videoUrl)) throw new Error('Video chưa có tệp MP4 cục bộ.');
    const file = path.join(process.cwd(), 'public', post.videoUrl);
    const stat = await fs.stat(file);
    if (!stat.isFile() || stat.size < 1024) throw new Error('Tệp video chờ duyệt không tồn tại hoặc rỗng.');
    if (stat.size > 49 * 1024 * 1024) throw new Error('Video vượt giới hạn gửi tệp 49 MB của luồng Telegram. Duyệt trong trang Quản lý đăng bài.');
    for (const chatId of config.allowedUsers) {
      const marker = `telegram-review:${config.token.split(':')[0]}:${chatId}`;
      if (await db.publishingEvent.findFirst({ where: { postId: post.id, message: marker } })) continue;
      const form = new FormData();
      form.set('chat_id', chatId);
      form.set('caption', `Chờ duyệt: ${post.title}\nPage: ${post.channel.name}\nMã bài: ${post.id}`.slice(0, 1000));
      form.set('document', new Blob([new Uint8Array(await fs.readFile(file))], { type: 'video/mp4' }), `${post.id}.mp4`);
      await telegramCall('sendDocument', form);
      await sendTelegramText(chatId, `${post.text}\n\nPage: ${post.channel.name} (${post.channel.pageId})\nDuyệt và xếp lịch: /approve ${post.id}\nXem danh sách: /reviews`);
      await db.publishingEvent.create({ data: { postId: post.id, status: 'draft', message: marker } });
    }
  }
  return { notified: true, postIds: posts.map(post => post.id) };
}

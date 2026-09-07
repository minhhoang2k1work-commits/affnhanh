import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { verifyAdminSessionFromCookies } from '@/lib/admin-auth';
import { db } from '@/lib/db';
import { telegramConfig } from '@/lib/telegram/config';
import { saveTelegramSettings } from '@/lib/telegram/settings';
import { botRequest, startTelegramWorker, stopTelegramWorker, workerStatus } from '@/lib/telegram/worker';

export const runtime = 'nodejs';
let busy = false;
export async function POST(request: Request) {
  if (!await verifyAdminSessionFromCookies()) return NextResponse.json({ error: 'Đăng nhập quản trị để cấu hình Telegram.' }, { status: 401 });
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ error: 'Nguồn yêu cầu không hợp lệ.' }, { status: 403 });
  if (busy) return NextResponse.json({ error: 'Đang xử lý. Vui lòng thử lại sau.' }, { status: 409 });
  busy = true;
  try {
    const raw = await request.text();
    if (raw.length > 10000) return NextResponse.json({ error: 'Cấu hình quá dài.' }, { status: 413 });
    const body = JSON.parse(raw);
    const current = telegramConfig();
    const token = typeof body.token === 'string' && body.token.trim() ? body.token.trim() : current.token;
    if (body.action === 'stop') {
      saveTelegramSettings({ ...current, enabled: false });
      await stopTelegramWorker();
      return NextResponse.json({ message: 'Đã tắt nhận lệnh mới. Các công việc đã xếp hàng vẫn tiếp tục.' });
    }
    if (!/^\d+:[\w-]+$/.test(token)) throw new Error('Nhập Bot Token hợp lệ từ BotFather.');
    if (body.action === 'test') {
      const bot = await botRequest(token, 'getMe');
      return NextResponse.json({ message: `Kết nối thành công: @${bot.username}`, botUsername: bot.username });
    }
    if (body.action === 'identify') {
      if (workerStatus().running) throw new Error('Tắt bot trước khi lấy Telegram ID.');
      const info = await botRequest(token, 'getWebhookInfo');
      if (info.url) throw new Error('Bot đang dùng webhook; không thể đọc tin nhắn chờ.');
      const updates = await botRequest(token, 'getUpdates', { timeout: 0, limit: 100, allowed_updates: ['message'] });
      const ids = [...new Set(updates.filter((u: any) => u.message?.chat?.type === 'private' && !u.message?.from?.is_bot).map((u: any) => String(u.message.from.id)))];
      return NextResponse.json({ ids, message: ids.length ? 'Chọn đúng ID của bạn trong danh sách bên dưới.' : 'Chưa có tin nhắn. Nhắn /start cho bot rồi bấm lấy ID lại.' });
    }
    if (!['save', 'start'].includes(body.action)) throw new Error('Thao tác không hợp lệ.');
    if (body.action === 'start') {
      saveTelegramSettings({ ...current, enabled: true });
      try { await startTelegramWorker(); } catch (error) { saveTelegramSettings({ ...current, enabled: false }); throw error; }
      return NextResponse.json({ message: 'Bot đã bật. Nhắn /status trong Telegram để kiểm tra.' });
    }
    const allowedUsers = typeof body.allowedUsers === 'string' ? body.allowedUsers.split(',').map((v: string) => v.trim()).filter(Boolean) : [];
    if (!allowedUsers.length || allowedUsers.some((v: string) => !/^\d+$/.test(v))) throw new Error('Nhập Telegram ID dạng số; nhiều ID cách nhau bằng dấu phẩy.');
    const owner = typeof body.userId === 'string' ? await db.user.findUnique({ where: { id: body.userId }, select: { id: true } }) : null;
    if (!owner) throw new Error('Tài khoản AFF không tồn tại.');
    await stopTelegramWorker();
    saveTelegramSettings({ enabled: false, token, allowedUsers: [...new Set<string>(allowedUsers)], userId: owner.id, secret: /^[\w-]{32,256}$/.test(current.secret) ? current.secret : randomBytes(32).toString('hex') });
    return NextResponse.json({ message: 'Đã lưu cấu hình. Bấm Bật bot để bắt đầu nhận lệnh.' });
  } catch (error) {
    const message = error instanceof Error && !/prisma|credential|ENCRYPTION|JSON|ENOENT|EACCES/i.test(error.message) ? error.message : 'Không lưu được cấu hình. Kiểm tra cơ sở dữ liệu, khóa mã hóa và quyền ghi của máy chủ.';
    return NextResponse.json({ error: message }, { status: 400 });
  } finally { busy = false; }
}

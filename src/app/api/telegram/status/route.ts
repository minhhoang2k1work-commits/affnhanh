import { NextResponse } from 'next/server';
import { verifyAdminSessionFromCookies } from '@/lib/admin-auth';
import { telegramConfig, isTelegramConfigured } from '@/lib/telegram/config';
import { db } from '@/lib/db';

export async function GET() {
  if (!await verifyAdminSessionFromCookies()) return NextResponse.json({ error: 'Đăng nhập quản trị để xem cấu hình agent.' }, { status: 401 });
  const config = telegramConfig();
  try {
    const currentUser = await db.user.findFirst({ select: { id: true } });
    const commands = config.userId ? await db.telegramCommand.findMany({ where: { userId: config.userId }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, text: true, status: true, createdAt: true, jobId: true, replySentAt: true, notifiedAt: true } }) : [];
    return NextResponse.json({ enabled: config.enabled, ready: isTelegramConfigured(), hasToken: !!config.token, hasSecret: config.secret.length >= 32, allowedUsers: config.allowedUsers, appUserId: config.userId || currentUser?.id || '', commands });
  } catch { return NextResponse.json({ error: 'Không đọc được trạng thái agent.' }, { status: 500 }); }
}

import { workerStatus } from '@/lib/autocut/queue';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isTelegramConfigured, telegramConfig } from '@/lib/telegram/config';
import type { AutomationOverview, SetupItem } from '@/lib/automation/overview';
export const dynamic = 'force-dynamic';
export async function GET() {
  const setup: SetupItem[] = [
    { id: 'database', name: 'Dữ liệu AFF', state: 'unknown', detail: 'Lưu sản phẩm, video và danh sách chờ duyệt.', href: '#setup', action: 'Kiểm tra lại' },
    { id: 'extension', name: 'Tiện ích Chrome', state: 'unknown', detail: 'Quét sản phẩm, lấy link và thực hiện đăng bài.', href: '/settings/shopee', action: 'Kết nối tiện ích' },
    { id: 'ai', name: 'AI tạo video', state: 'unknown', detail: 'Cần cấu hình viết kịch bản, tạo clip và giọng đọc.', href: '/ai-settings', action: 'Thiết lập AI' },
    { id: 'page', name: 'Page nhận bài', state: 'unknown', detail: 'Xác minh đúng Page trước khi cho phép đăng.', href: '/publishing?tab=channels', action: 'Quản lý Page' },
    { id: 'telegram', name: 'Duyệt qua Telegram', state: 'unknown', detail: 'Nhận video và duyệt đăng từ điện thoại.', href: '/telegram', action: 'Thiết lập Telegram' },
    { id: 'autocut', name: 'Flow → template AutoCut', state: 'unavailable', detail: 'Chưa nối tự động. Luồng hàng loạt hiện tạo clip bằng AI đã cấu hình và ghép video trong AFF.', href: '/ai-video?batch=1', action: 'Xem luồng hiện có' },
  ];
  const worker = await workerStatus();
  setup[5] = { ...setup[5], state: worker.online && worker.state !== 'blocked' ? 'configured' : 'missing', detail: worker.online ? 'Đã nhận heartbeat AutoCut. Chọn Google Flow và template trong đợt video; cần chạy thử để xác minh kết quả.' : worker.error || 'Chưa kết nối worker AutoCut.' };
  const result: AutomationOverview = { checkedAt: new Date().toISOString(), database: false, counts: null, setup };
  try {
    const user = await db.user.findFirst({ select: { id: true } });
    result.database = true; setup[0].state = 'connected'; setup[0].detail = 'AFF vừa đọc được cơ sở dữ liệu.';
    if (!user) { result.error = 'Chưa có tài khoản AFF để tải công việc. Thiết lập tài khoản trước.'; return NextResponse.json(result); }
    const [products, links, flows, posts, channels, device, providers] = await Promise.all([
      db.product.count({ where: { userId: user.id, isActive: true } }),
      db.affiliateLink.count({ where: { userId: user.id, status: 'ACTIVE' } }),
      db.flowRun.groupBy({ by: ['status'], where: { userId: user.id }, _count: true }),
      db.publishingPost.groupBy({ by: ['status'], where: { userId: user.id }, _count: true }),
      db.publishingChannel.count({ where: { userId: user.id, verifiedAt: { not: null }, paused: false } }),
      db.extensionDevice.findFirst({ where: { userId: user.id, lastSeenAt: { gte: new Date(Date.now() - 120000) } }, select: { id: true } }),
      db.aIProvider.findMany({ where: { userId: user.id, isActive: true }, select: { type: true, mode: true, apiKeyEnc: true, browserSessionValid: true } }),
    ]);
    const flowCount = (statuses: string[]) => flows.filter(item => statuses.includes(item.status)).reduce((sum, item) => sum + item._count, 0);
    const postCount = (statuses: string[]) => posts.filter(item => statuses.includes(item.status)).reduce((sum, item) => sum + item._count, 0);
    result.counts = { products, links, producing: flowCount(['pending', 'running', 'paused']), drafts: postCount(['draft']), scheduled: postCount(['scheduled', 'preparing']), published: postCount(['published']), attention: postCount(['needs_attention', 'submitted_unknown', 'missed']) };
    setup[1].state = device ? 'connected' : 'missing';
    const aiReady = ['llm', 'video', 'voiceover'].every(type => providers.some(p => p.type === type && (p.mode === 'browser' ? p.browserSessionValid : Boolean(p.apiKeyEnc))));
    setup[2].state = aiReady ? 'configured' : 'missing';
    if (aiReady) setup[2].detail = 'Đã lưu cấu hình AI. Cần chạy một video để kiểm chứng kết quả thực tế.';
    setup[3].state = channels > 0 ? 'configured' : 'missing';
    setup[4].state = isTelegramConfigured() && telegramConfig().userId === user.id ? 'configured' : 'missing';
  } catch {
    result.error = 'Chưa tải được dữ liệu công việc. Kiểm tra kết nối dữ liệu AFF rồi thử lại; các số liệu chưa được xác định.';
    result.counts = null;
    if (!result.database) { setup[0].state = 'missing'; setup[0].detail = 'AFF chưa kết nối được dữ liệu. Cần quản trị kiểm tra máy chủ và kết nối cơ sở dữ liệu.'; }
  }
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}

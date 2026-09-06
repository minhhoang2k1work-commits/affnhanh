'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { HELP } from '@/lib/telegram/commands';

export default function TelegramPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  async function refresh() {
    setError('');
    try { const response = await fetch('/api/telegram/status'); const result = await response.json(); if (!response.ok) throw new Error(result.error); setData(result); }
    catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { void refresh(); }, []);
  return <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-8">
    <h1 className="text-2xl font-bold text-white">Telegram Agent</h1>
    <p className="text-slate-400">Điều khiển AFF HUB qua tin nhắn riêng. Bản đầu hỗ trợ các lệnh xác định và mẫu câu tiếng Việt; chưa điều khiển toàn bộ máy tính.</p>
    {error && <p role="alert" className="text-amber-300">{error} <Link className="underline" href="/admin/login">Đăng nhập quản trị</Link></p>}
    {data && <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-slate-300">
      <p className="font-semibold text-white">{data.ready ? 'Đã đủ cấu hình — cần chạy tiến trình Telegram để nhận lệnh' : 'Chưa bật hoặc còn thiếu cấu hình'}</p>
      <p>Bot token: {data.hasToken ? 'Đã cấu hình (ẩn)' : 'Chưa có'} · Khóa kết nối: {data.hasSecret ? 'Đã cấu hình' : 'Chưa có'}</p>
      <p>Telegram ID được phép: {data.allowedUsers.join(', ') || 'Chưa thiết lập'}</p>
      <p className="break-all">AFF User ID: {data.appUserId}</p>
    </section>}
    <section className="space-y-3 rounded-2xl border border-slate-800 p-5 text-sm text-slate-300">
      <h2 className="text-lg font-semibold text-white">Kết nối trên máy này</h2>
      <ol className="list-inside list-decimal space-y-2">
        <li>Tạo bot bằng <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-indigo-300">BotFather</a>. Lưu token vào .env trên máy chủ, không dán token vào prompt hay lịch sử chat.</li>
        <li>Nhắn /start cho bot rồi chạy <code>npm run telegram:identify</code> để lấy ID của bạn. Điền các biến TELEGRAM_* theo .env.example, gồm Telegram ID và AFF User ID bên trên. Bot chỉ nhận chat riêng từ ID đã cho phép.</li>
        <li>Khởi động lại web, chạy <code>npm run telegram</code> trong thư mục AFF. Chế độ này không cần mở cổng internet hoặc tên miền.</li>
        <li>Mở Chrome + AFF HUB Extension, đăng nhập các sàn/ChatGPT/Flow. Nhắn <code>/start</code> rồi <code>/status</code> cho bot.</li>
      </ol>
      <p>Nếu triển khai webhook HTTPS, chạy <code>npm run telegram:webhook</code> một lần và giữ <code>npm run telegram:notify</code> hoạt động để nhận thông báo hoàn tất. Polling và webhook không chạy đồng thời.</p>
      <p>Lệnh /video dùng credit Flow. Tắt bot bằng TELEGRAM_ENABLED=false và khởi động lại web. /cancel chỉ hủy việc đang chờ.</p>
    </section>
    <pre className="whitespace-pre-wrap rounded-2xl bg-slate-900 p-5 text-sm text-slate-300">{HELP}</pre>
    <div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-white">Lịch sử lệnh gần đây</h2><button onClick={refresh} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-white">Làm mới</button></div>
    {data?.commands?.map((item: any) => <article key={item.id} className="rounded-xl border border-slate-800 p-4 text-sm text-slate-300"><p className="break-words text-white">{item.text}</p><p>{item.status} · {new Date(item.createdAt).toLocaleString('vi-VN')}</p><p>{item.jobId ? `Mã việc: ${item.jobId}` : ''}</p><p>{item.replySentAt ? 'Đã trả lời Telegram' : 'Chưa gửi phản hồi'}{item.notifiedAt ? ' · Đã báo kết quả công việc' : ''}</p></article>)}
  </div>;
}

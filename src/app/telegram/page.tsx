'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { HELP } from '@/lib/telegram/commands';

export default function TelegramPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');
  const [allowedUsers, setAllowedUsers] = useState('');
  const [userId, setUserId] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [ids, setIds] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  async function action(name: string) {
    setBusy(name); setError(''); setNotice('');
    try {
      const response = await fetch('/api/telegram/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: name, token, allowedUsers, userId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setNotice(result.message);
      if (result.ids) setIds(result.ids);
      if (name === 'save') { setToken(''); setDirty(false); }
      await refresh();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  }
  async function refresh() {
    try { const response = await fetch('/api/telegram/status'); const result = await response.json(); if (!response.ok) throw new Error(result.error); setData(result); }
    catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { void refresh(); const timer = setInterval(() => { void refresh(); }, 10000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (data && !dirty) { setAllowedUsers(data.allowedUsers.join(', ')); setUserId(data.appUserId); } }, [data, dirty]);
  return <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-8">
    <h1 className="text-2xl font-bold text-white">Telegram Agent</h1>
    <p className="text-slate-400">Điều khiển AFF HUB qua tin nhắn riêng. Bản đầu hỗ trợ các lệnh xác định và mẫu câu tiếng Việt; chưa điều khiển toàn bộ máy tính.</p>
    {error && <p role="alert" className="text-amber-300">{error} <Link className="underline" href="/admin/login">Đăng nhập quản trị</Link></p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-800 bg-emerald-950/40 p-4 text-emerald-300">{notice}</p>}
    <section className="space-y-5 rounded-2xl border border-indigo-500/30 bg-slate-900 p-5 md:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold text-white">Kết nối bot Telegram</h2><p className="mt-1 text-sm text-slate-400">Tạo bot → nhập thông tin → lưu cấu hình → bật bot.</p></div><span className={`rounded-full px-3 py-1 text-sm ${data?.worker?.running ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>{data?.worker?.running ? 'Đang chạy' : 'Đã dừng'}</span></div>
      <fieldset disabled={!!busy || !data} className="space-y-5 disabled:opacity-60">
        <label className="block text-sm font-medium text-slate-200">Bot Token
          <input type="password" autoComplete="new-password" value={token} onChange={e => { setToken(e.target.value); setDirty(true); }} placeholder={data?.hasToken ? 'Đã lưu token • để trống để giữ nguyên' : 'Dán token từ BotFather'} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white focus:border-indigo-400 focus:outline-none" />
          <span className="mt-2 block text-xs text-slate-400">Mở <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-indigo-300 underline">BotFather</a>, gửi /newbot để tạo bot. Token được mã hóa khi lưu trên máy chủ.</span>
        </label>
        <div className="flex flex-wrap gap-3"><button type="button" onClick={() => action('test')} className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-white">Kiểm tra kết nối</button><button type="button" disabled={data?.worker?.running} onClick={() => action('identify')} className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-white disabled:opacity-40">Lấy Telegram ID</button></div>
        <label className="block text-sm font-medium text-slate-200">Telegram ID được phép điều khiển
          <input value={allowedUsers} onChange={e => { setAllowedUsers(e.target.value); setDirty(true); }} placeholder="Ví dụ: 123456789" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white focus:border-indigo-400 focus:outline-none" />
          <span className="mt-2 block text-xs text-slate-400">Nhắn /start cho bot vừa tạo, rồi bấm Lấy Telegram ID. Chỉ chọn ID của bạn; nhiều ID cách nhau bằng dấu phẩy.</span>
        </label>
        {ids.length > 0 && <div className="flex flex-wrap gap-2">{ids.map(id => <button key={id} type="button" onClick={() => { setAllowedUsers(id); setDirty(true); }} className="rounded-lg bg-indigo-500/20 px-3 py-2 text-sm text-indigo-200">Dùng ID {id}</button>)}</div>}
        <label className="block text-sm font-medium text-slate-200">Tài khoản AFF quản lý dữ liệu
          <input value={userId} onChange={e => { setUserId(e.target.value); setDirty(true); }} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white focus:border-indigo-400 focus:outline-none" />
          <span className="mt-2 block text-xs text-slate-400">Đã điền ID tài khoản hiện có. Bot sẽ thao tác trên sản phẩm và ngành hàng của tài khoản này.</span>
        </label>
        <div className="flex flex-wrap gap-3 border-t border-slate-800 pt-5">
          <button type="button" onClick={() => action('save')} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-500">Lưu cấu hình</button>
          <button type="button" disabled={dirty || !data?.hasToken || data?.worker?.running} onClick={() => action('start')} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">Bật bot</button>
          <button type="button" disabled={!data?.enabled && !data?.worker?.running} onClick={() => action('stop')} className="rounded-xl border border-rose-500/40 px-5 py-3 text-sm text-rose-300 disabled:opacity-40">Tắt bot</button>
        </div>
      </fieldset>
      {busy && <p role="status" className="text-sm text-indigo-300">Đang xử lý, vui lòng chờ…</p>}
      {!data && <p className="text-sm text-amber-300"><Link href="/admin/login" className="underline">Đăng nhập quản trị</Link> để nhập và lưu cấu hình.</p>}
      {dirty && <p className="text-sm text-amber-300">Có thay đổi chưa lưu. Lưu cấu hình trước khi bật bot.</p>}
      {data?.worker?.error && <p role="alert" className="text-sm text-amber-300">{data.worker.error}</p>}
      {data?.worker?.lastPoll && <p className="text-xs text-slate-400">Lần kết nối gần nhất: {new Date(data.worker.lastPoll).toLocaleString('vi-VN')}</p>}
      <p className="text-sm text-slate-400">Giữ web và máy tính hoạt động. Sau khi khởi động lại web, bấm Bật bot lại. Chỉ chạy một bot trên một tiến trình; dừng lệnh npm run telegram cũ trước khi bật tại đây.</p>
    </section>
    {data && <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-slate-300">
      <p className="font-semibold text-white">{data.worker?.running ? 'Bot đang nhận lệnh trên máy này' : 'Bot chưa chạy trên giao diện — lưu cấu hình rồi bấm Bật bot'}</p>
      <p>Bot token: {data.hasToken ? 'Đã cấu hình (ẩn)' : 'Chưa có'} · Khóa kết nối: {data.hasSecret ? 'Đã cấu hình' : 'Chưa có'}</p>
      <p>Telegram ID được phép: {data.allowedUsers.join(', ') || 'Chưa thiết lập'}</p>
      <p className="break-all">AFF User ID: {data.appUserId}</p>
    </section>}
    <details className="space-y-3 rounded-2xl border border-slate-800 p-5 text-sm text-slate-300"><summary className="cursor-pointer font-semibold text-white">Cấu hình nâng cao bằng dòng lệnh</summary>
      <h2 className="text-lg font-semibold text-white">Kết nối trên máy này</h2>
      <ol className="list-inside list-decimal space-y-2">
        <li>Tạo bot bằng <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-indigo-300">BotFather</a>. Lưu token vào .env trên máy chủ, không dán token vào prompt hay lịch sử chat.</li>
        <li>Nhắn /start cho bot rồi chạy <code>npm run telegram:identify</code> để lấy ID của bạn. Điền các biến TELEGRAM_* theo .env.example, gồm Telegram ID và AFF User ID bên trên. Bot chỉ nhận chat riêng từ ID đã cho phép.</li>
        <li>Khởi động lại web, chạy <code>npm run telegram</code> trong thư mục AFF. Chế độ này không cần mở cổng internet hoặc tên miền.</li>
        <li>Mở Chrome + AFF HUB Extension, đăng nhập các sàn/ChatGPT/Flow. Nhắn <code>/start</code> rồi <code>/status</code> cho bot.</li>
      </ol>
      <p>Nếu triển khai webhook HTTPS, chạy <code>npm run telegram:webhook</code> một lần và giữ <code>npm run telegram:notify</code> hoạt động để nhận thông báo hoàn tất. Polling và webhook không chạy đồng thời.</p>
      <p>Lệnh /video dùng credit Flow. Tắt bot bằng TELEGRAM_ENABLED=false và khởi động lại web. /cancel chỉ hủy việc đang chờ.</p>
    </details>
    <pre className="whitespace-pre-wrap rounded-2xl bg-slate-900 p-5 text-sm text-slate-300">{HELP}</pre>
    <div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-white">Lịch sử lệnh gần đây</h2><button onClick={refresh} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-white">Làm mới</button></div>
    {data?.commands?.map((item: any) => <article key={item.id} className="rounded-xl border border-slate-800 p-4 text-sm text-slate-300"><p className="break-words text-white">{item.text}</p><p>{item.status} · {new Date(item.createdAt).toLocaleString('vi-VN')}</p><p>{item.jobId ? `Mã việc: ${item.jobId}` : ''}</p><p>{item.replySentAt ? 'Đã trả lời Telegram' : 'Chưa gửi phản hồi'}{item.notifiedAt ? ' · Đã báo kết quả công việc' : ''}</p></article>)}
  </div>;
}

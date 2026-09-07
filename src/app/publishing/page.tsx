'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, List, Radio, Plus, RefreshCw, Clock, CheckCircle2, AlertTriangle, X, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { requestPublishing } from '@/lib/publishing/extension';
import { parseReelCopy } from '@/lib/publishing/reels';
import { fromVietnamTime, POST_LABELS, toVietnamTime } from '@/lib/publishing/schedule';
import { PublishingMediaImport } from '@/components/ai-video/PublishingMediaImport';

type Channel = { id: string; pageId: string; name: string; deviceId: string; profileName: string; paused: boolean; slots: string[]; graceMinutes: number; verifiedAt: string | null };
type Post = { id: string; projectId: string; channelId: string; title: string; caption: string; hashtags: string[]; affiliateUrl: string; status: string; scheduledAt: string | null; createdAt: string; updatedAt: string; permalink: string | null; error: string | null; events: { id: string; status: string; message: string; createdAt: string }[] };
type Device = { id: string; lastSeenAt: string; publishingLastSeenAt: string | null; extensionVersion: string };
type Data = { channels: Channel[]; posts: Post[]; devices: Device[]; totals: Record<string, number>; total: number };
type Project = { id: string; title: string };
type Editor = { id?: string; projectId: string; title: string; caption: string; tags: string; affiliateUrl: string; channelIds: string[]; mode: string; time: string; clientKey: string; reviewed: boolean };
const field = 'w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white outline-none focus:border-indigo-400';
const btn = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40';
const primary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-40';
const initialData: Data = { channels: [], posts: [], devices: [], totals: {}, total: 0 };
const initialChannel = { id: '', pageId: '', name: '', deviceId: '', profileName: '', slotsText: '09:00, 19:00', graceMinutes: 15 };
function formatted(value: string) { return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)); }
function online(device?: Device) { return !!device?.publishingLastSeenAt && Date.now() - new Date(device.publishingLastSeenAt).getTime() < 180000; }
function color(status: string) { return status === 'published' ? 'bg-emerald-500/15 text-emerald-300' : ['missed', 'needs_attention', 'submitted_unknown'].includes(status) ? 'bg-amber-500/15 text-amber-300' : status === 'scheduled' ? 'bg-indigo-500/15 text-indigo-300' : 'bg-slate-700/50 text-slate-300'; }

async function api(path: string, body?: unknown, method = 'POST') {
  const response = await fetch(path, body ? { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Không thực hiện được yêu cầu.');
  return data;
}

export default function PublishingManager() {
  const [data, setData] = useState<Data>(initialData);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tab, setTab] = useState('queue');
  const [filter, setFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [channelForm, setChannelForm] = useState(initialChannel);
  const [chatgpt, setChatgpt] = useState('https://chatgpt.com/');
  const [raw, setRaw] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);
  const [detail, setDetail] = useState<Post | null>(null);
  const [resultUrl, setResultUrl] = useState('');
  const [checked, setChecked] = useState(false);

  const refresh = useCallback(async () => {
    try { setData(await api('/api/publishing')); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Không tải được trình quản lý.'); }
    finally { setLoading(false); }
  }, []);
  const freshEditor = (projectId = ''): Editor => ({ projectId, title: '', caption: '', tags: '', affiliateUrl: '', channelIds: [], mode: 'draft', time: toVietnamTime(new Date(Date.now() + 3600000)), clientKey: crypto.randomUUID(), reviewed: false });
  useEffect(() => {
    refresh();
    api('/api/ai-video?status=completed&limit=100').then(value => setProjects(value.projects || [])).catch(() => {});
    const projectId = new URLSearchParams(location.search).get('project');
    if (projectId) {
      const draft = freshEditor(projectId);
      try { const saved = JSON.parse(localStorage.getItem(`aff-reel-draft:${projectId}`) || 'null'); if (saved?.copy) { const copy = parseReelCopy(JSON.stringify(saved.copy)); Object.assign(draft, copy, { tags: copy.hashtags.join(' '), affiliateUrl: saved.affiliateUrl || '' }); } } catch { /* Server draft editing remains available. */ }
      setEditor(draft);
    }
    const timer = setInterval(refresh, 20000); return () => clearInterval(timer);
  }, [refresh]);

  async function work(label: string, fn: () => Promise<void>) {
    setBusy(label); setError(''); setNotice('');
    try { await fn(); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Không thực hiện được.'); }
    finally { setBusy(''); }
  }
  function editPost(post: Post) { setEditor({ ...freshEditor(post.projectId), id: post.id, title: post.title, caption: post.caption, tags: post.hashtags.join(' '), affiliateUrl: post.affiliateUrl, channelIds: [post.channelId], reviewed: false }); setDetail(null); }
  async function saveEditor() {
    if (!editor) return;
    const copy = parseReelCopy(JSON.stringify({ title: editor.title, caption: editor.caption, hashtags: editor.tags.split(/\s+/).filter(Boolean) }));
    if (editor.id) {
      await api(`/api/publishing/${editor.id}`, { action: 'edit', copy, affiliateUrl: editor.affiliateUrl, reviewed: editor.reviewed }, 'PATCH');
      if (editor.mode !== 'draft') await api(`/api/publishing/${editor.id}`, { action: 'reschedule', scheduledAt: fromVietnamTime(editor.time).toISOString() }, 'PATCH');
    } else {
      await api('/api/publishing', { kind: 'posts', ...editor, copy, scheduledAt: editor.mode === 'time' ? fromVietnamTime(editor.time).toISOString() : undefined });
    }
    setEditor(null); setNotice('Đã lưu vào trình quản lý. Lịch và nội dung được lưu trên máy chủ.');
  }
  const channelById = Object.fromEntries(data.channels.map(c => [c.id, c]));
  const posts = data.posts.filter(p => (!channelFilter || p.channelId === channelFilter) && (filter === 'all' || (filter === 'attention' ? ['needs_attention', 'submitted_unknown', 'missed'].includes(p.status) : p.status === filter)) && p.title.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))).sort((a, b) => (a.scheduledAt || a.createdAt).localeCompare(b.scheduledAt || b.createdAt));
  const totalAttention = (data.totals.needs_attention || 0) + (data.totals.submitted_unknown || 0) + (data.totals.missed || 0);
  const today = toVietnamTime(new Date()).slice(0, 10);
  const weekStart = new Date(`${today}T00:00:00Z`); weekStart.setUTCDate(weekStart.getUTCDate() - (weekStart.getUTCDay() + 6) % 7 + weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => { const date = new Date(weekStart); date.setUTCDate(date.getUTCDate() + i); return date.toISOString().slice(0, 10); });

  return <div className="max-w-7xl mx-auto space-y-6 pb-24">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">AFF Publishing</p><h1 className="text-3xl font-bold text-white mt-2">Trình quản lý đăng bài</h1><p className="text-slate-400 text-sm mt-2">Lên kế hoạch, duyệt nội dung và tự đăng Facebook Reels theo từng hồ sơ Chrome.</p></div><div className="flex gap-2"><button className={btn} disabled={!!busy} onClick={refresh} aria-label="Tải lại"><RefreshCw size={16} /></button><button className={primary} onClick={() => { setEditor(freshEditor()); setRaw(''); }}><Plus size={17} />Tạo bài đăng</button></div></header>
    {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
    {notice && <p role="status" className="rounded-xl bg-emerald-500/10 p-4 text-sm text-emerald-300">{notice}</p>}
    {busy && <p role="status" className="text-sm text-indigo-300">{busy}</p>}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[
      { label: 'Đang chờ lịch', value: data.totals.scheduled || 0, key: 'scheduled', icon: Clock },
      { label: 'Đã xác nhận đăng', value: data.totals.published || 0, key: 'published', icon: CheckCircle2 },
      { label: 'Cần kiểm tra', value: totalAttention, key: 'attention', icon: AlertTriangle },
      { label: 'Page đang bật', value: data.channels.filter(c => !c.paused).length, key: 'channels', icon: Radio },
    ].map(stat => <button key={stat.key} onClick={() => { if (stat.key === 'channels') setTab('channels'); else { setFilter(stat.key); setTab('queue'); } }} className="text-left rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><stat.icon size={18} className="text-indigo-400 mb-3" /><div className="text-2xl font-bold text-white">{stat.value}</div><p className="text-xs text-slate-400 mt-1">{stat.label}</p></button>)}</div>
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400"><strong className="text-slate-200">Giờ Việt Nam · UTC+7.</strong> Extension kiểm tra lịch khoảng mỗi phút. Có thể đóng tab AFF; Chrome, máy tính và máy chủ AFF cần hoạt động. Bài quá thời gian cho phép trễ sẽ chờ bạn đặt lịch lại.</div>
    <PublishingMediaImport onImported={incoming => { setProjects(current => [...incoming, ...current.filter(p => !incoming.some(i => i.id === p.id))]); setNotice(`Đã thêm ${incoming.length} video vào danh sách. Bấm Tạo bài đăng để chọn video và lên lịch.`); }} />
    <nav className="flex gap-2 border-b border-slate-800 pb-3" aria-label="Quản lý đăng bài">{[{ id: 'queue', text: 'Hàng đợi', icon: List }, { id: 'calendar', text: 'Lịch tuần', icon: CalendarDays }, { id: 'channels', text: 'Kênh & hồ sơ', icon: Radio }].map(item => <button key={item.id} onClick={() => setTab(item.id)} className={`${btn} ${tab === item.id ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200' : ''}`}><item.icon size={16} />{item.text}</button>)}</nav>
    {loading ? <p className="text-slate-400">Đang tải lịch đăng…</p> : tab === 'channels' ? <div className="grid lg:grid-cols-5 gap-5">
      <div className="lg:col-span-3 space-y-3">{!data.channels.length && <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-slate-400">Chưa có Page. Kết nối hồ sơ Chrome và thêm Page đầu tiên ở bên cạnh.</div>}{data.channels.map(channel => {
        const device = data.devices.find(d => d.id === channel.deviceId);
        return <article key={channel.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-3"><div className="flex justify-between gap-2"><div><h2 className="font-semibold text-white">{channel.name}</h2><p className="text-xs text-slate-400 mt-1">{channel.profileName} · Page {channel.pageId}</p></div><span className={`text-xs ${online(device) ? 'text-emerald-300' : 'text-amber-300'}`}>{online(device) ? 'Extension đang trực' : 'Extension chưa trực'}</span></div><p className="text-xs text-slate-400">Khung giờ: {channel.slots.join(' · ')} · Cho phép trễ {channel.graceMinutes} phút</p><p className="text-xs text-slate-400">{channel.verifiedAt ? `Đã kiểm tra Page: ${formatted(channel.verifiedAt)}` : 'Chưa kiểm tra Page trong hồ sơ đã gắn'}</p><div className="flex flex-wrap gap-2">
          <button className={btn} disabled={!!busy} onClick={() => work('Đang mở Page…', async () => { await requestPublishing('OPEN', { pageId: channel.pageId, pageName: channel.name }); setNotice('Chọn đúng Page trong Meta Business Suite rồi bấm Kiểm tra Page.'); })}>Mở Page</button>
          <button className={btn} disabled={!!busy} onClick={() => work('Đang kiểm tra Page và hồ sơ…', async () => { await requestPublishing('CHECK', { pageId: channel.pageId, pageName: channel.name, channelId: channel.id }); setNotice('Đã xác minh Page trong đúng hồ sơ. Bạn có thể bật tự đăng.'); })}>Kiểm tra Page</button>
          <button className={btn} disabled={!!busy || (channel.paused && !channel.verifiedAt)} onClick={() => work('Đang cập nhật kênh…', async () => { await api('/api/publishing', { kind: 'channel', id: channel.id, paused: !channel.paused }); })}>{channel.paused ? 'Bật tự đăng' : 'Tạm dừng kênh'}</button>
          <button className={btn} onClick={() => setChannelForm({ ...channel, slotsText: channel.slots.join(', ') })}>Sửa</button>
        </div></article>;
      })}</div>
      <form className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-3" onSubmit={e => { e.preventDefault(); work('Đang lưu kênh…', async () => { await api('/api/publishing', { kind: 'channel', ...channelForm, id: channelForm.id || undefined, slots: channelForm.slotsText.split(',').map(s => s.trim()).filter(Boolean) }); setChannelForm(initialChannel); setNotice('Đã lưu kênh. Kênh mới hoặc đổi danh tính cần được kiểm tra trước khi bật tự đăng.'); }); }}>
        <h2 className="font-semibold text-white">{channelForm.id ? 'Chỉnh cấu hình Page' : 'Thêm Page'}</h2>
        <button type="button" className={btn} disabled={!!busy} onClick={() => work('Đang nhận diện extension…', async () => { const result = await requestPublishing('IDENTITY'); setChannelForm(c => ({ ...c, deviceId: String(result.deviceId) })); setNotice('Đã chọn extension của hồ sơ Chrome hiện tại.'); })}>Dùng hồ sơ Chrome hiện tại</button>
        <label className="block text-sm text-slate-300">Thiết bị extension<select className={field} required value={channelForm.deviceId} onChange={e => setChannelForm({ ...channelForm, deviceId: e.target.value })}><option value="">Chọn thiết bị</option>{data.devices.map(d => <option key={d.id} value={d.id}>{d.id.slice(0, 8)} · {online(d) ? 'đang trực' : 'chưa trực'}</option>)}</select></label>
        <label className="block text-sm text-slate-300">Tên hồ sơ Chrome<input className={field} required maxLength={100} placeholder="VD: Facebook công việc" value={channelForm.profileName} onChange={e => setChannelForm({ ...channelForm, profileName: e.target.value })} /></label>
        <label className="block text-sm text-slate-300">ID Page<input className={field} required pattern="[0-9]{5,30}" value={channelForm.pageId} onChange={e => setChannelForm({ ...channelForm, pageId: e.target.value })} /></label>
        <label className="block text-sm text-slate-300">Tên Page chính xác<input className={field} required maxLength={200} value={channelForm.name} onChange={e => setChannelForm({ ...channelForm, name: e.target.value })} /></label>
        <label className="block text-sm text-slate-300">Khung giờ hằng ngày<input className={field} value={channelForm.slotsText} onChange={e => setChannelForm({ ...channelForm, slotsText: e.target.value })} /></label>
        <label className="block text-sm text-slate-300">Cho phép đăng trễ tối đa (phút)<input type="number" className={field} min={1} max={60} value={channelForm.graceMinutes} onChange={e => setChannelForm({ ...channelForm, graceMinutes: Number(e.target.value) })} /></label>
        <p className="text-xs text-slate-500">Khung giờ dành cho bài chọn “Xếp vào hàng đợi”. Mỗi tài khoản Facebook nên dùng một hồ sơ Chrome; nhiều Page cùng tài khoản có thể dùng chung hồ sơ.</p><button className={primary} disabled={!!busy}>Lưu kênh</button>
      </form>
    </div> : <>
      <div className="flex flex-wrap gap-3"><input aria-label="Tìm bài đăng" className={`${field} sm:!w-64`} placeholder="Tìm tiêu đề…" value={search} onChange={e => setSearch(e.target.value)} /><select aria-label="Lọc Page" className={`${field} sm:!w-52`} value={channelFilter} onChange={e => setChannelFilter(e.target.value)}><option value="">Tất cả Page</option>{data.channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><select aria-label="Lọc trạng thái" className={`${field} sm:!w-52`} value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Tất cả trạng thái</option><option value="attention">Cần kiểm tra</option>{Object.entries(POST_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
      {!!((data.totals.submitted_unknown || 0) + (data.totals.needs_attention || 0)) && <p className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-200">Có bài chưa rõ kết quả hoặc bị gián đoạn. Hàng đợi trong hồ sơ liên quan sẽ chờ xử lý bài đó trước khi đăng tiếp.</p>}
      {tab === 'calendar' ? <div className="space-y-3"><div className="flex items-center justify-between"><button className={btn} aria-label="Tuần trước" onClick={() => setWeekOffset(v => v - 1)}><ChevronLeft size={16} /></button><span className="text-sm text-slate-300">{days[0]} — {days[6]}</span><button className={btn} aria-label="Tuần sau" onClick={() => setWeekOffset(v => v + 1)}><ChevronRight size={16} /></button></div><div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-7 gap-2">{days.map(day => <div key={day} className={`min-w-0 rounded-xl border ${day === today ? 'border-indigo-500' : 'border-slate-800'} bg-slate-900/60 p-3 min-h-40`}><p className="text-sm font-medium text-slate-200 mb-3">{new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'UTC' }).format(new Date(day))}</p>{posts.filter(p => p.scheduledAt && toVietnamTime(new Date(p.scheduledAt)).startsWith(day)).map(post => <button key={post.id} className="block w-full text-left rounded-lg bg-slate-800 p-2 mb-2" onClick={() => { setDetail(post); setChecked(false); setResultUrl(post.permalink || ''); }}><p className="text-xs text-indigo-300">{toVietnamTime(new Date(post.scheduledAt!)).slice(11)} · {channelById[post.channelId]?.name}</p><p className="text-xs text-white my-1 line-clamp-3">{post.title}</p><span className={`text-[10px] ${color(post.status)} rounded px-1`}>{POST_LABELS[post.status]}</span></button>)}</div>)}</div><p className="text-xs text-slate-500">Bản nháp chưa có giờ đăng nằm trong Hàng đợi → Bản nháp.</p></div> : <div className="space-y-3">
        {!posts.length && <div className="text-center rounded-2xl border border-dashed border-slate-700 p-12"><CalendarDays className="mx-auto mb-4 text-indigo-400" size={32} /><h2 className="text-white font-semibold">Chưa có bài trong danh sách này</h2><p className="text-sm text-slate-400 mt-2">Thêm Page, chọn video đã hoàn tất và tạo lịch đăng đầu tiên.</p><button className={`${primary} mt-5`} onClick={() => setEditor(freshEditor())}>Tạo bài đăng</button></div>}
        {posts.map(post => <article key={post.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`text-xs rounded-full px-2 py-1 ${color(post.status)}`}>{POST_LABELS[post.status]}</span><span className="text-xs text-slate-400">{channelById[post.channelId]?.name} · {channelById[post.channelId]?.profileName}</span></div><h2 className="font-semibold text-white mt-2 break-words">{post.title}</h2><p className="text-xs text-slate-400 mt-1">{post.scheduledAt ? formatted(post.scheduledAt) : 'Chưa đặt giờ'}{post.status === 'scheduled' && post.scheduledAt && new Date(post.scheduledAt) < new Date() ? ' · Đang chờ extension nhận' : ''}</p>{post.error && <p className="text-xs text-amber-300 mt-2 break-words">{post.error}</p>}</div><div className="flex gap-2">{post.permalink && <a className={btn} target="_blank" rel="noopener noreferrer" href={post.permalink}>Xem Reel</a>}<button className={btn} onClick={() => { setDetail(post); setResultUrl(post.permalink || ''); setChecked(false); }}>Chi tiết</button></div></article>)}
      </div>}
      {data.total > data.posts.length && <p className="text-sm text-amber-300">Đang hiển thị {data.posts.length} bài gần nhất trong tổng số {data.total} bài.</p>}
    </>}

    {editor && <div className="fixed inset-0 z-50 bg-black/70 p-3 sm:p-8 overflow-y-auto"><div role="dialog" aria-modal="true" aria-label="Soạn bài đăng" className="max-w-3xl mx-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 space-y-4"><div className="flex justify-between"><h2 className="text-xl font-bold text-white">{editor.id ? 'Sửa nội dung bài đăng' : 'Soạn bài & lên lịch'}</h2><button className={btn} aria-label="Đóng soạn bài" disabled={!!busy} onClick={() => setEditor(null)}><X size={17} /></button></div>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}{busy && <p role="status" className="text-sm text-indigo-300">{busy}</p>}
      <fieldset disabled={!!busy} className="space-y-4 disabled:opacity-60">
        <label className="block text-sm text-slate-300">Video đã hoàn tất<select className={field} disabled={!!editor.id} value={editor.projectId} onChange={e => setEditor({ ...freshEditor(e.target.value), channelIds: editor.channelIds })}><option value="">Chọn video trong AI Video Studio</option>{projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
        <div className="flex flex-wrap gap-2"><input aria-label="Link ChatGPT" className={`${field} flex-1`} value={chatgpt} onChange={e => setChatgpt(e.target.value)} /><button className={btn} disabled={!editor.projectId} onClick={() => work('ChatGPT đang viết tiêu đề và caption…', async () => { const source = await api(`/api/ai-video/${editor.projectId}/reel-copy`); const result = await requestPublishing('GENERATE', { url: chatgpt, prompt: source.prompt }); const copy = parseReelCopy(String(result.responseText || '')); setEditor({ ...editor, ...copy, tags: copy.hashtags.join(' '), affiliateUrl: source.affiliateUrl || '' }); })}><Sparkles size={16} />Viết bằng ChatGPT</button></div>
        <details className="text-sm text-slate-400"><summary>Nhập JSON từ ChatGPT</summary><textarea aria-label="JSON ChatGPT" className={field} value={raw} onChange={e => setRaw(e.target.value)} /><button className={btn} onClick={() => work('Đang nhập nội dung…', async () => { const copy = parseReelCopy(raw); setEditor({ ...editor, ...copy, tags: copy.hashtags.join(' ') }); })}>Áp dụng</button></details>
        <label className="block text-sm text-slate-300">Tiêu đề ({editor.title.length}/100)<input className={field} maxLength={100} value={editor.title} onChange={e => setEditor({ ...editor, title: e.target.value })} /></label>
        <label className="block text-sm text-slate-300">Caption<textarea rows={4} className={field} maxLength={1800} value={editor.caption} onChange={e => setEditor({ ...editor, caption: e.target.value })} /></label>
        <div className="grid sm:grid-cols-2 gap-3"><label className="block text-sm text-slate-300">Hashtag<input className={field} value={editor.tags} onChange={e => setEditor({ ...editor, tags: e.target.value })} /></label><label className="block text-sm text-slate-300">Link affiliate<input className={field} value={editor.affiliateUrl} onChange={e => setEditor({ ...editor, affiliateUrl: e.target.value })} /></label></div>
        <fieldset className="space-y-2"><legend className="text-sm text-slate-300 mb-2">Page nhận bài</legend>{!data.channels.length && <button className={btn} onClick={() => { setEditor(null); setTab('channels'); }}>Thêm Page trước</button>}{data.channels.map(c => <label key={c.id} className="flex gap-2 items-center text-sm text-slate-300"><input type="checkbox" disabled={!!editor.id} checked={editor.channelIds.includes(c.id)} onChange={e => setEditor({ ...editor, channelIds: e.target.checked ? [...editor.channelIds, c.id] : editor.channelIds.filter(id => id !== c.id) })} />{c.name} <span className="text-xs text-slate-500">{c.profileName}{c.paused ? ' · tạm dừng' : ''}</span></label>)}</fieldset>
        <div className="grid sm:grid-cols-2 gap-3"><label className="block text-sm text-slate-300">Cách đăng<select className={field} value={editor.mode} onChange={e => setEditor({ ...editor, mode: e.target.value })}><option value="draft">Lưu bản nháp</option><option value="time">Chọn ngày giờ</option>{!editor.id && <><option value="queue">Xếp vào khung giờ trống tiếp theo</option><option value="now">Đăng ngay khi extension nhận</option></>}</select></label>{editor.mode === 'time' && <label className="block text-sm text-slate-300">Ngày giờ Việt Nam<input type="datetime-local" className={field} value={editor.time} onChange={e => setEditor({ ...editor, time: e.target.value })} /></label>}</div>
        {editor.id && <label className="flex gap-2 text-xs text-slate-400"><input type="checkbox" checked={editor.reviewed} onChange={e => setEditor({ ...editor, reviewed: e.target.checked })} />Tôi đã kiểm tra và xử lý bản nháp Facebook nếu lượt trước bị gián đoạn.</label>}
        <p className="text-xs text-slate-400">Bấm duyệt lịch cho phép extension tự đăng đúng nội dung này lên các Page đã chọn. Sửa nội dung bài đã lên lịch sẽ đưa bài về nháp để duyệt lại.</p>
        <div className="flex justify-end"><button className={primary} disabled={!editor.projectId || !editor.channelIds.length || !editor.title.trim() || !editor.caption.trim()} onClick={() => work('Đang lưu bài đăng…', saveEditor)}>{editor.mode === 'draft' ? 'Lưu bản nháp' : editor.mode === 'now' ? 'Duyệt và đăng ngay' : 'Duyệt và lên lịch'}</button></div>
      </fieldset>
    </div></div>}

    {detail && <div className="fixed inset-0 z-50 bg-black/70 p-4 sm:p-8 overflow-y-auto"><div role="dialog" aria-modal="true" aria-label="Chi tiết bài đăng" className="max-w-2xl mx-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 space-y-4"><div className="flex justify-between gap-3"><h2 className="font-bold text-white">{detail.title}</h2><button className={btn} aria-label="Đóng chi tiết" onClick={() => setDetail(null)}><X size={16} /></button></div>{error && <p role="alert" className="text-sm text-red-300">{error}</p>}<p className="text-sm whitespace-pre-wrap text-slate-300">{detail.caption}</p><p className="text-xs text-slate-400">{detail.hashtags.join(' ')}</p><Link className="text-sm text-indigo-300 underline" href={`/ai-video/${detail.projectId}`}>Mở video nguồn</Link><div className="space-y-2"><h3 className="text-sm font-semibold text-white">Lịch sử xử lý</h3>{detail.events.map(e => <div key={e.id} className="border-l-2 border-slate-700 pl-3 text-xs text-slate-400"><p>{formatted(e.createdAt)} · {POST_LABELS[e.status]}</p><p className="text-slate-300 mt-1">{e.message}</p></div>)}</div>
      <div className="flex flex-wrap gap-2">{['draft', 'scheduled', 'missed', 'needs_attention', 'cancelled'].includes(detail.status) && <button className={btn} onClick={() => editPost(detail)}>Sửa / lên lịch lại</button>}{['draft', 'scheduled', 'missed', 'needs_attention'].includes(detail.status) && <button className={btn} disabled={!!busy} onClick={() => work('Đang hủy lịch…', async () => { await api(`/api/publishing/${detail.id}`, { action: 'cancel' }, 'PATCH'); setDetail(null); })}>Hủy lịch</button>}</div>
      {['submitted_unknown', 'needs_attention'].includes(detail.status) && <div className="space-y-3 border-t border-slate-700 pt-4"><p className="text-sm text-amber-200">Đối chiếu Page, video và thời gian đăng trước khi xử lý kết quả.</p><label className="flex gap-2 text-sm text-slate-300"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />Tôi đã kiểm tra Facebook trực tiếp</label><input aria-label="Link Reel đã xuất bản" className={field} placeholder="https://www.facebook.com/reel/..." value={resultUrl} onChange={e => setResultUrl(e.target.value)} /><div className="flex flex-wrap gap-2"><button className={primary} disabled={!checked || !resultUrl || !!busy} onClick={() => work('Đang xác nhận kết quả…', async () => { await api(`/api/publishing/${detail.id}`, { action: 'confirm', permalink: resultUrl }, 'PATCH'); setDetail(null); })}>Xác nhận đã đăng đúng bài</button>{detail.status === 'submitted_unknown' && <button className={btn} disabled={!checked || !!busy} onClick={() => work('Đang trả về bản nháp…', async () => { await api(`/api/publishing/${detail.id}`, { action: 'not_published', reviewed: true }, 'PATCH'); setDetail(null); })}>Đã kiểm tra: bài chưa đăng</button>}</div></div>}
    </div></div>}
  </div>;
}

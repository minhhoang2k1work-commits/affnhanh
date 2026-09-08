'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { WorkerStatus } from '@/lib/autocut/queue';
import { DataError } from '@/components/ui/DataError';

type Product = { id: string; name: string; image: string; affiliateLinks: { affiliateUrl: string }[] };
type Channel = { id: string; name: string; paused: boolean; verifiedAt: string | null };
type Run = { id: string; status: string; progress: number; errorMessage: string | null; videoProjectId: string; videoProject: { title: string } | null; post: { status: string; scheduledAt: string | null; error: string | null } | null };
const statuses: Record<string, string> = { pending: 'Chờ tạo video', running: 'Đang tạo video', completed: 'Đã gửi chờ duyệt', failed: 'Xử lý lỗi', cancelled: 'Đã hủy', paused: 'Tạm dừng', scheduled: 'Chờ lịch đăng', preparing: 'Đang chuẩn bị đăng', submitted_unknown: 'Đã gửi lệnh đăng — cần kiểm tra Facebook', published: 'Đã xuất bản', missed: 'Lỡ lịch đăng', needs_attention: 'Cần kiểm tra', draft: 'Chờ duyệt' };
const field = 'rounded-lg border border-slate-700 bg-slate-900 px-3 py-2';

export function BatchVideoStudio() {
  const [products, setProducts] = useState<Product[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selected, setSelected] = useState<Record<string, Product>>({});
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [channelId, setChannelId] = useState('');
  const [style, setStyle] = useState('professional');
  const [videoSource, setVideoSource] = useState('configured');
  const [autoCutTemplateId, setAutoCutTemplateId] = useState('');
  const [autoCutStatus, setAutoCutStatus] = useState<WorkerStatus | null>(null);
  useEffect(() => { const refresh = async () => { try { const res = await fetch('/api/automation/autocut'); if (!res.ok) throw new Error(); setAutoCutStatus(await res.json()); } catch { setAutoCutStatus(null); } }; void refresh(); const timer = setInterval(refresh, 10000); return () => clearInterval(timer); }, []);
  const [duration, setDuration] = useState(30);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(false);
  const [catalogReload, setCatalogReload] = useState(0);
  const [runsError, setRunsError] = useState(false);
  const [runsLoaded, setRunsLoaded] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [runs, setRuns] = useState<Run[]>([]);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const requestRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const submitting = useRef(false);

  useEffect(() => {
    try {
      const settings = JSON.parse(sessionStorage.getItem('aff-batch-draft') || '{}');
      if (typeof settings.channelId === 'string') setChannelId(settings.channelId);
      if (['professional','trendy','minimal','energetic','luxury'].includes(settings.style)) setStyle(settings.style);
      if (Number.isInteger(settings.duration) && settings.duration >= 5 && settings.duration <= 120) setDuration(settings.duration);
      if (['configured','google_flow'].includes(settings.videoSource)) setVideoSource(settings.videoSource);
      if (typeof settings.autoCutTemplateId === 'string') setAutoCutTemplateId(settings.autoCutTemplateId);
      if (typeof settings.request?.key === 'string' && typeof settings.request?.fingerprint === 'string') requestRef.current = settings.request;
      const saved = JSON.parse(sessionStorage.getItem('aff-batch-selection') || '[]');
      if (Array.isArray(saved)) setSelected(Object.fromEntries(saved.slice(0, 50).filter(p => p && typeof p.id === 'string' && typeof p.name === 'string' && Array.isArray(p.affiliateLinks)).map(p => [p.id, p])));
    } catch { /* The server validates the saved selection again. */ } finally { setDraftReady(true); }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/ai-video/batch?catalog=1&page=${page}&q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setCatalogError(false); setProducts(data.products); setChannels(data.channels); setTotal(data.total);
      } catch (err) { if (!controller.signal.aborted) setCatalogError(true); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [page, query, catalogReload]);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/ai-video/batch');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setRuns(data.runs); setRunsError(false); setRunsLoaded(true);
    } catch { setRunsError(true); setRunsLoaded(true); }
  }, []);
  useEffect(() => { void refresh(); const timer = setInterval(() => void refresh(), 5000); return () => clearInterval(timer); }, [refresh]);

  useEffect(() => {
    if (!draftReady) return;
    try {
      sessionStorage.setItem('aff-batch-selection', JSON.stringify(Object.values(selected)));
      sessionStorage.setItem('aff-batch-draft', JSON.stringify({channelId, style, duration, videoSource, autoCutTemplateId, request: requestRef.current}));
    } catch { /* Storage may be disabled; server idempotency remains active. */ }
  }, [draftReady, selected, channelId, style, duration, videoSource, autoCutTemplateId]);

  const toggle = (product: Product) => setSelected(previous => {
    const next = { ...previous };
    if (next[product.id]) delete next[product.id];
    else if (Object.keys(next).length < 50) next[product.id] = product;
    return next;
  });
  const count = Object.keys(selected).length;
  const channel = channels.find(item => item.id === channelId);
  const retry = async (id: string) => {
    setRetrying(id); setError('');
    try {
      const response = await fetch(`/api/flows/runs/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'retry' }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Không thể thử lại.'); }
    finally { setRetrying(null); }
  };
  const start = async () => {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError(''); setNotice('');
    const payload = { productIds: Object.keys(selected).sort(), channelId, style, duration, videoSource, ...(autoCutTemplateId ? { autoCutTemplateId } : {}) };
    const fingerprint = JSON.stringify(payload);
    if (requestRef.current?.fingerprint !== fingerprint) requestRef.current = { fingerprint, key: crypto.randomUUID() };
    try {
      sessionStorage.setItem('aff-batch-draft', JSON.stringify({channelId, style, duration, videoSource, autoCutTemplateId, request: requestRef.current}));
      const response = await fetch('/api/ai-video/batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, clientKey: requestRef.current.key }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setNotice(`Đã đưa ${data.count} sản phẩm vào hàng đợi. Video hoàn tất sẽ gắn link và chờ duyệt cho Page ${channel?.name}.`);
      setSelected({}); sessionStorage.removeItem('aff-batch-selection'); requestRef.current = null; await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Không tạo được đợt video.'); }
    finally { setBusy(false); submitting.current = false; }
  };

  return <div className="space-y-5">
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-5 space-y-3">
      <h2 className="text-lg font-semibold">Tạo video hàng loạt và gửi duyệt</h2>
      <p className="text-sm text-slate-400">Chọn tối đa 50 sản phẩm có ảnh. AFF lấy hoặc tạo link affiliate thật trước khi chạy AI, sau đó lưu video và nội dung vào bản nháp để bạn duyệt.</p>
      <p className="text-sm text-slate-400">Giữ máy chủ AFF và hồ sơ Chrome có extension đăng Facebook hoạt động. Cấu hình AI và <Link href="/publishing" className="text-amber-400 underline">Page cùng lịch đăng</Link> trước khi bắt đầu.</p>
      <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
        <h3 className="font-semibold text-white">1. Chọn sản phẩm</h3>
        <input aria-label="Tìm sản phẩm" placeholder="Tìm sản phẩm theo tên…" className={`${field} w-full`} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} />
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <strong>Đã chọn {count}/50</strong>
          <button type="button" disabled={loading} className="text-amber-400 disabled:opacity-40" onClick={() => setSelected(previous => { const next = { ...previous }; for (const product of products) if (product.image && Object.keys(next).length < 50) next[product.id] = product; return next; })}>Chọn trang hiện tại</button>
          <button type="button" onClick={() => setSelected({})} className="text-slate-400">Bỏ chọn tất cả</button>
        </div>
        {count > 0 && <div className="flex flex-wrap gap-2">{Object.values(selected).map(product => <button type="button" key={product.id} onClick={() => toggle(product)} aria-label={`Bỏ chọn ${product.name}`} className="max-w-64 truncate rounded-lg bg-amber-500/10 px-2 py-1 text-xs text-amber-300">× {product.name}</button>)}</div>}
        {loading ? <p role="status">Đang tải sản phẩm…</p> : catalogError ? <DataError title="Chưa tải được sản phẩm và Page" onRetry={() => setCatalogReload(v => v + 1)} /> : <div className="grid gap-2 md:grid-cols-2">{products.map(product => {
          const ready = Boolean(product.image);
          return <label key={product.id} className={`flex gap-3 rounded-xl border p-3 ${selected[product.id] ? 'border-amber-500 bg-amber-500/10' : 'border-slate-800'} ${!ready ? 'opacity-50' : ''}`}>
            <input type="checkbox" aria-label={`Chọn ${product.name}`} checked={Boolean(selected[product.id])} disabled={!ready || (!selected[product.id] && count >= 50)} onChange={() => toggle(product)} />
            {product.image && <img src={product.image} alt="" className="h-14 w-14 rounded-lg object-cover" />}
            <span className="min-w-0 text-sm"><span className="line-clamp-2">{product.name}</span><span className="block text-xs text-slate-400">{ready ? (product.affiliateLinks[0]?.affiliateUrl ? 'Đã có link affiliate' : 'Sẽ tạo link thật trước khi chạy AI') : 'Cần bổ sung ảnh'}</span></span>
          </label>;
        })}{products.length === 0 && <p className="text-slate-400">Không tìm thấy sản phẩm.</p>}</div>}
        <div className="flex items-center justify-between text-sm"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)} className="disabled:opacity-40">← Trang trước</button><span>{page}/{Math.max(1, Math.ceil(total / 20))}</span><button type="button" disabled={page * 20 >= total || loading} onClick={() => setPage(page + 1)} className="disabled:opacity-40">Trang sau →</button></div>
        <h3 className="border-t border-slate-700 pt-5 font-semibold text-white">2. Chọn Page và cách làm video</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-sm">Page Facebook<select aria-label="Page Facebook" className={field} value={channelId} onChange={event => setChannelId(event.target.value)}><option value="">Chọn Page</option>{channels.map(item => <option key={item.id} value={item.id} >{item.name}{item.paused || !item.verifiedAt ? ' — cần xác minh/bật trước khi duyệt đăng' : ''}</option>)}</select></label>
          <label className="grid gap-1 text-sm">Phong cách<select className={field} value={style} onChange={event => setStyle(event.target.value)}>{[['professional', 'Chuyên nghiệp'], ['trendy', 'Xu hướng'], ['minimal', 'Tối giản'], ['energetic', 'Năng động'], ['luxury', 'Sang trọng']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="grid gap-1 text-sm">Thời lượng<select className={field} value={duration} onChange={event => setDuration(Number(event.target.value))}>{[...new Set([15, 30, 60, duration])].sort((a,b) => a-b).map(value => <option key={value} value={value}>{value} giây</option>)}</select></label>
        </div>
        {!channels.length && !loading && !catalogError && <Link href="/publishing?tab=channels" className="block text-sm text-violet-300 underline">Thêm Page để tiếp tục</Link>}
        <div className="rounded-lg bg-slate-800 p-3 text-sm text-slate-300">ChatGPT viết tiêu đề và mô tả từ hồ sơ sản phẩm đã lưu; AFF gắn đúng link affiliate. Telegram gửi tệp video và Page dự kiến để duyệt. Cần cấu hình Telegram. Chọn nguồn tạo clip và cách dựng bên dưới. Google Flow cần extension AutoFlow đang kết nối; AutoCut cần worker riêng hoạt động.</div>
        <label className="grid gap-1 text-sm">Nguồn tạo clip<select className={field} value={videoSource} onChange={e => setVideoSource(e.target.value)}><option value="configured">Nhà cung cấp AI đã cấu hình</option><option value="google_flow">Google Flow qua AutoCut và extension</option></select></label>
        <label className="grid gap-1 text-sm">Dựng thành phẩm<select className={field} value={autoCutTemplateId} onChange={e => { setAutoCutTemplateId(e.target.value); const template = autoCutStatus?.templates.find(t => t.id === e.target.value); setDuration(template ? Math.round(template.duration) : 30); }}><option value="">Ghép trong AFF</option>{autoCutStatus?.templates.map(t => <option key={t.id} value={t.id}>{t.name} · {t.duration}s · AutoCut</option>)}</select></label>
        <p className="text-sm text-slate-400">{autoCutStatus?.online ? 'Worker AutoCut: ' + ({ idle: 'Sẵn sàng nhận việc', rendering: 'Đang dựng video', blocked: 'Cần kiểm tra' }[autoCutStatus.state] || autoCutStatus.state) + '. Chọn template có thời lượng khớp video.' : 'AutoCut chưa kết nối worker. Template thật sẽ xuất hiện khi worker hoạt động.'}</p>
        <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 text-sm leading-6"><h3 className="font-semibold text-white">3. Kiểm tra trước khi tạo</h3><p className="mt-2 text-slate-300">{count} sản phẩm → {count} video · {duration} giây/video · Page: {channel?.name || "Chưa chọn"}</p><p className="text-slate-400">{Object.values(selected).filter(p => !p.affiliateLinks[0]?.affiliateUrl).length} sản phẩm cần lấy link trước khi chạy AI. Video tạo xong chờ duyệt, chưa đăng ngay.</p><p className="text-amber-200">Tạo video có thể dùng credit của tài khoản AI. Chưa có báo giá chính xác cho đợt này.</p></div>
        {(!count || !channel || Object.values(selected).some(p => !p.image)) && <p className="text-sm text-slate-400">{!count ? "Chọn ít nhất một sản phẩm để tiếp tục." : Object.values(selected).some(p => !p.image) ? "Bỏ chọn hoặc bổ sung ảnh cho sản phẩm còn thiếu ảnh." : "Chọn Page nhận video để tiếp tục."}</p>}
        <button type="button" disabled={busy || !count || !channel || loading || catalogError || Object.values(selected).some(p => !p.image)} onClick={start} className="w-full sm:w-auto rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white disabled:opacity-40">{busy ? 'Đang lưu hàng đợi…' : `Tạo ${count} video chờ duyệt`}</button>
      </fieldset>
    </div>
    {error && <p role="alert" className="rounded-xl bg-rose-500/10 p-4 text-rose-300">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-emerald-500/10 p-4 text-emerald-300">{notice}</p>}
    <div className="space-y-3"><div className="flex items-center justify-between"><h3 className="font-semibold">Video hàng loạt gần đây</h3><Link href="/publishing" className="text-sm text-amber-400">Xem lịch và kết quả đăng →</Link></div>
      {runsLoaded && !runsError && runs.length === 0 && <p className="text-sm text-slate-400">Chưa có đợt xử lý nào.</p>}
      {runsError && <DataError title="Chưa tải được tiến độ" onRetry={refresh} />}
      {!runsLoaded && <p role="status" className="text-sm text-slate-400">Đang tải tiến độ…</p>}
      {!runsError && runs.map(run => <div key={run.id} className="rounded-xl border border-slate-800 p-4 text-sm space-y-1"><Link href={`/ai-video/${run.videoProjectId}`} className="font-semibold text-amber-300">{run.videoProject?.title || 'Video sản phẩm'}</Link><progress aria-label={`Tiến độ ${run.videoProject?.title || "video"}`} max={100} value={run.progress} className="h-2 w-full accent-violet-500" /><p>{statuses[run.status] || run.status} · {run.progress}%{run.post && ` · ${statuses[run.post.status] || run.post.status}`}</p>{run.post?.scheduledAt && <p className="text-slate-400">Lịch đăng: {new Date(run.post.scheduledAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} (giờ Việt Nam)</p>}{(run.errorMessage || run.post?.error) && <p className="text-rose-300">{run.errorMessage || run.post?.error}</p>}{run.status === 'failed' && <button type="button" disabled={retrying !== null} onClick={() => retry(run.id)} className="text-amber-400 disabled:opacity-40">{retrying === run.id ? 'Đang thử lại…' : 'Thử lại bước bị lỗi'}</button>}</div>)}
    </div>
  </div>;
}

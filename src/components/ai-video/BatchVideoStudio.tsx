'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type Product = { id: string; name: string; image: string; affiliateLinks: { affiliateUrl: string }[] };
type Channel = { id: string; name: string; paused: boolean; verifiedAt: string | null };
type Run = { id: string; status: string; progress: number; errorMessage: string | null; videoProjectId: string; videoProject: { title: string } | null; post: { status: string; scheduledAt: string | null; error: string | null } | null };
const statuses: Record<string, string> = { pending: 'Chờ tạo video', running: 'Đang tạo video', completed: 'Đã xếp lịch', failed: 'Xử lý lỗi', cancelled: 'Đã hủy', paused: 'Tạm dừng', scheduled: 'Chờ lịch đăng', preparing: 'Đang chuẩn bị đăng', submitted_unknown: 'Đã gửi lệnh đăng — cần kiểm tra Facebook', published: 'Đã xuất bản', missed: 'Lỡ lịch đăng', needs_attention: 'Cần kiểm tra', draft: 'Bản nháp' };
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
  const [duration, setDuration] = useState(30);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [runs, setRuns] = useState<Run[]>([]);
  const [retrying, setRetrying] = useState<string | null>(null);
  const requestRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const submitting = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/ai-video/batch?catalog=1&page=${page}&q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setProducts(data.products); setChannels(data.channels); setTotal(data.total);
      } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Không tải được sản phẩm.'); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [page, query]);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/ai-video/batch');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setRuns(data.runs);
    } catch (err) { setError(err instanceof Error ? err.message : 'Không tải được tiến độ.'); }
  }, []);
  useEffect(() => { void refresh(); const timer = setInterval(() => void refresh(), 5000); return () => clearInterval(timer); }, [refresh]);

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
    const payload = { productIds: Object.keys(selected).sort(), channelId, style, duration };
    const fingerprint = JSON.stringify(payload);
    if (requestRef.current?.fingerprint !== fingerprint) requestRef.current = { fingerprint, key: crypto.randomUUID() };
    try {
      const response = await fetch('/api/ai-video/batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, clientKey: requestRef.current.key }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setNotice(`Đã đưa ${data.count} sản phẩm vào hàng đợi. Video hoàn tất sẽ tự gắn link và xếp lịch đăng trên ${channel?.name}.`);
      setSelected({}); requestRef.current = null; await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Không tạo được đợt video.'); }
    finally { setBusy(false); submitting.current = false; }
  };

  return <div className="space-y-5">
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-5 space-y-3">
      <h2 className="text-lg font-semibold">Tạo video và đăng Facebook hàng loạt</h2>
      <p className="text-sm text-slate-400">Mỗi sản phẩm tạo một video dọc tiếng Việt, gắn link affiliate vào mô tả bài đăng và xếp vào khung giờ trống của Page. Chọn tối đa 50 sản phẩm đã có ảnh và link affiliate.</p>
      <p className="text-sm text-slate-400">Giữ máy chủ AFF và hồ sơ Chrome có extension đăng Facebook hoạt động. Cấu hình AI và <Link href="/publishing" className="text-amber-400 underline">Page cùng lịch đăng</Link> trước khi bắt đầu.</p>
      <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-sm">Page Facebook<select aria-label="Page Facebook" className={field} value={channelId} onChange={event => setChannelId(event.target.value)}><option value="">Chọn Page</option>{channels.map(item => <option key={item.id} value={item.id} disabled={item.paused || !item.verifiedAt}>{item.name}{item.paused || !item.verifiedAt ? ' — chưa bật tự đăng' : ''}</option>)}</select></label>
          <label className="grid gap-1 text-sm">Phong cách<select className={field} value={style} onChange={event => setStyle(event.target.value)}>{[['professional', 'Chuyên nghiệp'], ['trendy', 'Xu hướng'], ['minimal', 'Tối giản'], ['energetic', 'Năng động'], ['luxury', 'Sang trọng']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="grid gap-1 text-sm">Thời lượng<select className={field} value={duration} onChange={event => setDuration(Number(event.target.value))}>{[15, 30, 60].map(value => <option key={value} value={value}>{value} giây</option>)}</select></label>
        </div>
        <input aria-label="Tìm sản phẩm" placeholder="Tìm sản phẩm theo tên…" className={`${field} w-full`} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} />
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <strong>Đã chọn {count}/50</strong>
          <button type="button" disabled={loading} className="text-amber-400 disabled:opacity-40" onClick={() => setSelected(previous => { const next = { ...previous }; for (const product of products) if (product.image && product.affiliateLinks[0]?.affiliateUrl && Object.keys(next).length < 50) next[product.id] = product; return next; })}>Chọn trang hiện tại</button>
          <button type="button" onClick={() => setSelected({})} className="text-slate-400">Bỏ chọn tất cả</button>
        </div>
        {count > 0 && <div className="flex flex-wrap gap-2">{Object.values(selected).map(product => <button type="button" key={product.id} onClick={() => toggle(product)} aria-label={`Bỏ chọn ${product.name}`} className="max-w-64 truncate rounded-lg bg-amber-500/10 px-2 py-1 text-xs text-amber-300">× {product.name}</button>)}</div>}
        {loading ? <p role="status">Đang tải sản phẩm…</p> : <div className="grid gap-2 md:grid-cols-2">{products.map(product => {
          const ready = Boolean(product.image && product.affiliateLinks[0]?.affiliateUrl);
          return <label key={product.id} className={`flex gap-3 rounded-xl border p-3 ${selected[product.id] ? 'border-amber-500 bg-amber-500/10' : 'border-slate-800'} ${!ready ? 'opacity-50' : ''}`}>
            <input type="checkbox" aria-label={`Chọn ${product.name}`} checked={Boolean(selected[product.id])} disabled={!ready || (!selected[product.id] && count >= 50)} onChange={() => toggle(product)} />
            {product.image && <img src={product.image} alt="" className="h-14 w-14 rounded-lg object-cover" />}
            <span className="min-w-0 text-sm"><span className="line-clamp-2">{product.name}</span><span className="block text-xs text-slate-400">{ready ? 'Sẵn sàng · tự gắn link affiliate' : 'Cần bổ sung ảnh hoặc tạo link affiliate'}</span></span>
          </label>;
        })}{products.length === 0 && <p className="text-slate-400">Không tìm thấy sản phẩm.</p>}</div>}
        <div className="flex items-center justify-between text-sm"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)} className="disabled:opacity-40">← Trang trước</button><span>{page}/{Math.max(1, Math.ceil(total / 20))}</span><button type="button" disabled={page * 20 >= total || loading} onClick={() => setPage(page + 1)} className="disabled:opacity-40">Trang sau →</button></div>
        <div className="rounded-lg bg-slate-800 p-3 text-sm text-slate-300">Nội dung đăng: tên sản phẩm + lời mời xem thông tin, giá tại link + link affiliate của sản phẩm + thông báo tiếp thị liên kết. Bấm bên dưới sẽ bắt đầu tạo video bằng cấu hình AI hiện tại và cho phép tự đăng theo lịch Page.</div>
        <button type="button" disabled={!count || !channel || channel.paused || !channel.verifiedAt} onClick={start} className="rounded-xl bg-amber-600 px-5 py-3 font-semibold text-white disabled:opacity-40">{busy ? 'Đang lưu hàng đợi…' : `Tạo ${count} video và tự đăng Facebook`}</button>
      </fieldset>
    </div>
    {error && <p role="alert" className="rounded-xl bg-rose-500/10 p-4 text-rose-300">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-emerald-500/10 p-4 text-emerald-300">{notice}</p>}
    <div className="space-y-3"><div className="flex items-center justify-between"><h3 className="font-semibold">Video hàng loạt gần đây</h3><Link href="/publishing" className="text-sm text-amber-400">Xem lịch và kết quả đăng →</Link></div>
      {runs.length === 0 && <p className="text-sm text-slate-400">Chưa có đợt xử lý nào.</p>}
      {runs.map(run => <div key={run.id} className="rounded-xl border border-slate-800 p-4 text-sm space-y-1"><Link href={`/ai-video/${run.videoProjectId}`} className="font-semibold text-amber-300">{run.videoProject?.title || 'Video sản phẩm'}</Link><p>{statuses[run.status] || run.status} · {run.progress}%{run.post && ` · ${statuses[run.post.status] || run.post.status}`}</p>{run.post?.scheduledAt && <p className="text-slate-400">Lịch đăng: {new Date(run.post.scheduledAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} (giờ Việt Nam)</p>}{(run.errorMessage || run.post?.error) && <p className="text-rose-300">{run.errorMessage || run.post?.error}</p>}{run.status === 'failed' && <button type="button" disabled={retrying !== null} onClick={() => retry(run.id)} className="text-amber-400 disabled:opacity-40">{retrying === run.id ? 'Đang thử lại…' : 'Thử lại bước bị lỗi'}</button>}</div>)}
    </div>
  </div>;
}

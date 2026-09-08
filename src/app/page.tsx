'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, CircleHelp, Clapperboard, Clock3, RefreshCw, Settings2, ShieldCheck, ShoppingBag, TriangleAlert } from 'lucide-react';
import { AutomationOverview, nextAutomationAction, setupLabels } from '@/lib/automation/overview';

const actionClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50';
export default function DashboardPage() {
  const [data, setData] = useState<AutomationOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true; setLoading(true);
    try {
      const response = await fetch('/api/automation/overview', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error();
      const value: AutomationOverview = await response.json();
      setData(value); setError(value.error || '');
    } catch { setData(null); setError('Chưa liên lạc được với AFF. Kiểm tra máy chủ rồi bấm Thử lại.'); }
    finally { setLoading(false); inFlight.current = false; }
  }, []);
  useEffect(() => { void refresh(); const timer = setInterval(() => { if (!document.hidden) void refresh(); }, 30000); return () => clearInterval(timer); }, [refresh]);
  const next = nextAutomationAction(data);
  const counts = data?.counts;
  const steps = [
    { name: 'Sản phẩm', text: 'Chọn thông tin và ảnh gốc', href: '/library', count: counts?.products, unit: 'sản phẩm', icon: ShoppingBag },
    { name: 'Tạo video', text: 'Kịch bản → clip → thành phẩm', href: '/ai-video?tab=processing', count: counts?.producing, unit: 'video đang xử lý', icon: Clapperboard },
    { name: 'Chờ duyệt', text: 'Xem video, nội dung và Page', href: '/publishing?filter=draft', count: counts?.drafts, unit: 'bản nháp', icon: ShieldCheck },
    { name: 'Lịch đăng', text: 'Đã duyệt, đang chờ đăng', href: '/publishing?tab=calendar', count: counts?.scheduled, unit: 'bài theo lịch', icon: Clock3 },
    { name: 'Đã đăng', text: 'Kết quả đã được xác nhận', href: '/publishing?filter=published', count: counts?.published, unit: 'bài đã xác nhận', icon: CheckCircle2 },
  ];
  return <div className="space-y-7 pb-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">Không gian làm việc</p><h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">Video affiliate, từ sản phẩm đến bài đăng</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Tạo video theo đợt, kiểm soát nội dung và duyệt đúng Page trước khi đăng.</p></div>
      <button className={actionClass} disabled={loading} onClick={refresh}><RefreshCw size={16} className={loading ? 'animate-spin' : ''} />{loading ? 'Đang kiểm tra…' : 'Cập nhật'}</button>
    </header>
    {error && <div role="alert" className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4"><div className="flex gap-3"><TriangleAlert size={20} className="mt-0.5 shrink-0 text-amber-300" /><div><p className="font-semibold text-amber-100">Chưa xác định được trạng thái công việc</p><p className="mt-1 max-w-2xl text-sm leading-6 text-amber-200/80">{error}</p></div></div><button className={actionClass} disabled={loading} onClick={refresh}>Thử lại</button></div>}
    <section aria-label="Hành trình sản xuất video" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {steps.map((step, index) => <Link href={step.href} key={step.name} className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-5 transition-colors hover:border-violet-400/60 hover:bg-slate-900"><div className="flex items-center justify-between"><step.icon size={20} className="text-violet-300" /><span className="text-xs text-slate-500">0{index + 1}</span></div><h2 className="mt-4 font-semibold text-white">{step.name}</h2><p className="mt-1 text-xs leading-5 text-slate-400">{step.text}</p><p className="mt-5 text-3xl font-bold tabular-nums text-white">{loading && !data ? '…' : step.count ?? '—'}</p><p className="mt-1 text-xs text-slate-400">{step.count == null ? 'Chưa có số liệu xác thực' : step.unit}</p></Link>)}
    </section>
    <section className="grid gap-4 lg:grid-cols-3" aria-label="Việc tiếp theo">
      <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-950/60 to-slate-900 p-6 lg:col-span-2"><p className="text-xs font-semibold uppercase tracking-widest text-violet-300">Việc nên làm tiếp</p><h2 className="mt-3 text-2xl font-semibold text-white">{loading && !data ? 'Đang đọc trạng thái của bạn…' : next.title}</h2><p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">{next.detail}</p><Link href={next.href} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500">{next.action}<ArrowRight size={17} /></Link></div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6"><ShieldCheck size={24} className="text-emerald-300" /><h2 className="mt-3 font-semibold text-white">Bạn quyết định lúc đăng</h2><p className="mt-2 text-sm leading-6 text-slate-400">Video tạo xong được đưa vào bản nháp. Kiểm tra video, tiêu đề, link sản phẩm và Page; duyệt trên AFF hoặc Telegram để xếp lịch.</p><Link href="/publishing?filter=draft" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-violet-300">Mở danh sách chờ duyệt<ArrowRight size={15} /></Link></div>
    </section>
    <section id="setup" aria-labelledby="setup-title" className="scroll-mt-24 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="setup-title" className="flex items-center gap-2 text-lg font-semibold text-white"><Settings2 size={20} className="text-violet-300" />Kết nối trước khi chạy</h2><p className="mt-2 text-sm text-slate-400">“Đã cấu hình” nghĩa là đã lưu thiết lập, chưa phải xác nhận chạy video thành công.</p></div>{data && <span className="text-xs text-slate-400">Kiểm tra lúc {new Date(data.checkedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })} · giờ Việt Nam</span>}</div>
      {!data ? <div className="mt-5 rounded-xl border border-dashed border-slate-700 p-6 text-sm text-slate-400" role="status">{loading ? 'Đang kiểm tra các kết nối…' : 'Chưa đọc được kết nối. Bấm Thử lại để kiểm tra.'}</div> : <div className="mt-5 divide-y divide-slate-800">{data.setup.map(item => <div key={item.id} className="flex flex-wrap items-start justify-between gap-4 py-4"><div className="min-w-0 flex-1 basis-64"><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium text-slate-100">{item.name}</h3><span className={`rounded-full px-2.5 py-1 text-xs ${item.state === 'connected' ? 'bg-emerald-500/10 text-emerald-300' : item.state === 'configured' ? 'bg-violet-500/10 text-violet-300' : 'bg-amber-500/10 text-amber-200'}`}>{setupLabels[item.state]}</span></div><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{item.detail}</p></div>{item.id === 'database' ? <button className={actionClass} disabled={loading} onClick={refresh}>{item.action}</button> : <Link href={item.href} className={actionClass}>{item.action}<ArrowRight size={14} /></Link>}</div>)}</div>}
    </section>
    <div className="flex items-start gap-2 text-xs leading-5 text-slate-400"><CircleHelp size={16} className="mt-0.5 shrink-0" /><p>Chưa có sản phẩm? <Link href="/scanner" className="text-violet-300 underline">Thêm từ shop</Link>. Đã có video dựng sẵn? <Link href="/publishing" className="text-violet-300 underline">Nhập video và duyệt đăng</Link>. Xem lỗi tạo video tại <Link href="/flows" className="text-violet-300 underline">Tiến độ & lỗi</Link>.</p></div>
  </div>;
}

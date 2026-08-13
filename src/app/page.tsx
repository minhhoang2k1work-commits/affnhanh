'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ShoppingBag, 
  Store, 
  MousePointerClick, 
  TrendingUp, 
  ScanLine, 
  Copy, 
  Check, 
  Sparkles, 
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/utils';

export default function DashboardPage() {
  const [summaryData, setSummaryData] = useState<any | null>(null);
  const [integrationStatus, setIntegrationStatus] = useState<any | null>(null);
  const [chartData, setChartData] = useState<any | null>(null);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    // 1. Fetch real summary metrics from DB (Section 9, 10, 13)
    fetch('/api/dashboard/summary')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setSummaryData(data.summary);
          setIntegrationStatus(data.integrationStatus);
        }
      })
      .catch((err) => console.error(err));

    // 2. Fetch real commission chart data (Section 11)
    fetch('/api/dashboard/commission-chart?range=7d')
      .then((res) => res.json())
      .then((data) => {
        setChartData(data);
      })
      .catch((err) => console.error(err));

    // 3. Fetch real top products from DB (Section 12)
    fetch('/api/products?sortBy=sold')
      .then((res) => res.json())
      .then((data) => {
        if (data.products) {
          setTopProducts(data.products.slice(0, 6));
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleCopyLink = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const summary = summaryData || {
    totalProducts: 0,
    totalShops: 0,
    affiliateProducts: 0,
    unsupportedProducts: 0,
    clicks: null,
    orders: null,
    commission: null,
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-900/60 via-violet-900/40 to-slate-900 border border-purple-500/20 p-4 sm:p-6 md:p-8">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 text-[11px] sm:text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Thư Viện Affiliate Cá Nhân (Real Data Engine)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            Quét Shop & Tự Động Tạo <span className="gradient-text">Affiliate Link</span>
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Biến toàn bộ danh mục sản phẩm từ các shop thành thư viện Affiliate cá nhân. Tạo deep link 1-click & gắn trực tiếp vào video.
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-2.5 sm:gap-3">
            <Link
              href="/scanner"
              className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl gradient-shopee text-white font-semibold text-xs sm:text-sm shadow-glow flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all"
            >
              <ScanLine className="w-4 h-4" />
              <span>DÁN LINK QUÉT SHOP</span>
            </Link>
            <Link
              href="/library"
              className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-200 font-medium text-xs sm:text-sm hover:bg-slate-800 hover:text-white transition-all"
            >
              Xem Thư Viện
            </Link>
          </div>
        </div>

        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Section 14: Data Source Integration Status Banner */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <span>Trạng Thái Kết Nối Dữ Liệu Nguồn (Data Source Status)</span>
          <span className="text-purple-400 font-mono text-[10px]">Real DB Mode</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-200 font-semibold">Shopee Product API</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">Connected</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {integrationStatus?.affiliateDeepLink?.connected ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-400" />
              )}
              <span className="text-slate-200 font-semibold">Affiliate Deep Link Engine</span>
            </div>
            <div className="flex items-center gap-1.5">
              {!integrationStatus?.affiliateDeepLink?.connected && (
                <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-blue-500/20 text-blue-300">
                  Via Extension
                </span>
              )}
              <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                integrationStatus?.affiliateDeepLink?.connected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-300'
              }`}>
                {integrationStatus?.affiliateDeepLink?.connected ? 'API Connected' : 'Web Dashboard'}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-slate-500" />
              <span className="text-slate-400 font-semibold">Click Report API</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 font-bold text-[10px]">Not Connected</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-slate-500" />
              <span className="text-slate-400 font-semibold">Order & Commission Report</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 font-bold text-[10px]">Not Connected</span>
          </div>
        </div>
      </div>

      {/* Real Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Products */}
        <div className="glass-card p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Tổng Sản Phẩm DB</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white">{summary.totalProducts}</div>
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span className="text-emerald-400 font-medium">{summary.affiliateProducts} Có Affiliate</span>
            <span className="text-slate-500">{summary.unsupportedProducts} Không Hỗ Trợ</span>
          </div>
        </div>

        {/* Active Shops */}
        <div className="glass-card p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Shop Theo Dõi</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Store className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white">{summary.totalShops} Shop</div>
          <div className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Đồng bộ thực tế từ Database</span>
          </div>
        </div>

        {/* Clicks (Section 10: Display '—' if report API un-integrated) */}
        <div className="glass-card p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Số Lượt Click</span>
            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400">
              <MousePointerClick className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-400">
            {summary.clicks !== null ? formatNumber(summary.clicks) : '—'}
          </div>
          <div className="text-xs text-slate-500 flex items-center justify-between">
            <span>{summary.totalLinksCreated || 0} Link đã tạo</span>
            <span className="text-slate-500 font-semibold">{summary.orders !== null ? summary.orders : '—'} Đơn hàng</span>
          </div>
        </div>

        {/* Total Commission */}
        <div className="glass-card p-5 rounded-2xl space-y-2 border-purple-500/30 bg-gradient-to-b from-purple-900/20 to-slate-900">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-300">Hoa Hồng Thực Tế</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-300">
            {summary.commission !== null ? formatCurrency(summary.commission) : '—'}
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <span>Chưa kết nối dữ liệu Báo cáo Bán hàng</span>
          </div>
        </div>
      </div>

      {/* Real Analytics Chart & Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Commission Analytics Timeline (Section 11: Real Aggregated DB Data) */}
        <div className="lg:col-span-2 glass-card p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg text-white">Thống Kê Hiệu Quả Hoa Hồng</h3>
              <p className="text-xs text-slate-400">Dữ liệu hoa hồng tích lũy thực tế từ Database</p>
            </div>
          </div>

          {!chartData?.hasData ? (
            /* Empty State for Chart (Section 11 Requirement) */
            <div className="h-64 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-2xl text-center p-6 space-y-2">
              <BarChart3 className="w-10 h-10 text-slate-600" />
              <h4 className="text-sm font-bold text-slate-300">Chưa có dữ liệu hoa hồng trong 7 ngày qua.</h4>
              <p className="text-xs text-slate-500">Quét shop và tạo link Affiliate để phát sinh lượt click và ghi nhận doanh số.</p>
            </div>
          ) : (
            <div className="h-64 flex items-end justify-between gap-3 pt-6 px-2 border-b border-slate-800 pb-4">
              {chartData.data?.map((bar: any, idx: number) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group relative">
                  <div className="w-full max-w-[40px] h-32 rounded-t-xl bg-purple-600 shadow-md" />
                  <span className="text-xs text-slate-400 font-medium">{bar.day}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 12: Real Top Performers Query */}
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-white">Top Sản Phẩm Trong DB</h3>
            <Link href="/library" className="text-xs text-purple-400 hover:underline flex items-center gap-1">
              Xem tất cả <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {topProducts.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs space-y-2">
                <ShoppingBag className="w-8 h-8 text-slate-600 mx-auto" />
                <p>Database chưa có sản phẩm nào.</p>
                <Link href="/scanner" className="text-purple-400 hover:underline font-semibold block">
                  Dán link quét shop ngay →
                </Link>
              </div>
            ) : (
              topProducts.map((p) => (
                <div key={p.id} className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between gap-3 hover:border-purple-500/40 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={p.image} alt={p.name} className="w-12 h-12 rounded-lg object-cover bg-slate-800 flex-shrink-0" />
                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold text-white truncate">{p.name}</h4>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span className="text-emerald-400 font-medium">HH: {p.commissionRate}%</span>
                        <span>•</span>
                        <span>Đã bán: {formatNumber(p.sold)}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleCopyLink(p.affiliateUrl || p.originalUrl, p.id)}
                    className="p-2 rounded-lg bg-purple-600/20 text-purple-300 hover:bg-purple-600 hover:text-white transition-all flex-shrink-0"
                    title="Copy Link Affiliate"
                  >
                    {copiedId === p.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

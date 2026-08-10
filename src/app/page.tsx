'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ShoppingBag, 
  Link2, 
  Store, 
  MousePointerClick, 
  ShoppingBag as OrderIcon, 
  BadgePercent, 
  TrendingUp, 
  ScanLine, 
  Copy, 
  Check, 
  ExternalLink,
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/utils';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalProducts: 437,
    affProducts: 421,
    nonAffProducts: 16,
    activeShops: 8,
    linksCreated: 1250,
    totalClicks: 18420,
    orders: 684,
    totalCommission: 24850000,
  });

  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch products for dashboard top list
    fetch('/api/products?sortBy=sold')
      .then((res) => res.json())
      .then((data) => {
        if (data.products) {
          setTopProducts(data.products.slice(0, 6));
        }
      })
      .catch((err) => console.error(err));
  }, []);

  const handleCopyLink = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-900/60 via-violet-900/40 to-slate-900 border border-purple-500/20 p-6 md:p-8">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Thư Viện Affiliate Cá Nhân</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            Quét Shop & Tự Động Tạo <span className="gradient-text">Affiliate Link</span>
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed">
            Biến toàn bộ danh mục sản phẩm từ các shop thành thư viện Affiliate cá nhân. Tạo deep link 1-click & gắn trực tiếp vào video.
          </p>
          <div className="pt-2 flex items-center gap-3">
            <Link
              href="/scanner"
              className="px-5 py-2.5 rounded-xl gradient-shopee text-white font-semibold text-sm shadow-glow flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all"
            >
              <ScanLine className="w-4 h-4" />
              <span>DÁN LINK QUÉT SHOP</span>
            </Link>
            <Link
              href="/library"
              className="px-5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-200 font-medium text-sm hover:bg-slate-800 hover:text-white transition-all"
            >
              Xem Thư Viện
            </Link>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Overview Metric Cards (Section 3) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Products */}
        <div className="glass-card p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Tổng Sản Phẩm</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white">{formatNumber(stats.totalProducts)}</div>
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span className="text-emerald-400 font-medium">{stats.affProducts} Có Affiliate</span>
            <span className="text-slate-500">{stats.nonAffProducts} Không Hỗ Trợ</span>
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
          <div className="text-2xl font-extrabold text-white">{stats.activeShops} Shop</div>
          <div className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Tự động đồng bộ (Auto Sync)</span>
          </div>
        </div>

        {/* Links & Clicks */}
        <div className="glass-card p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Số Lượt Click</span>
            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400">
              <MousePointerClick className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white">{formatNumber(stats.totalClicks)}</div>
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>{stats.linksCreated} Link đã tạo</span>
            <span className="text-orange-400 font-semibold">{stats.orders} Đơn hàng</span>
          </div>
        </div>

        {/* Total Commission */}
        <div className="glass-card p-5 rounded-2xl space-y-2 border-purple-500/30 bg-gradient-to-b from-purple-900/20 to-slate-900">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-300">Hoa Hồng Ước Tính</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-400">{formatCurrency(stats.totalCommission)}</div>
          <div className="text-xs text-slate-400 flex items-center gap-1">
            <span className="text-emerald-400 font-semibold">+18.5%</span>
            <span>so với tháng trước</span>
          </div>
        </div>
      </div>

      {/* Analytics Chart & Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Commission Analytics Timeline */}
        <div className="lg:col-span-2 glass-card p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg text-white">Thống Kê Hiệu Quả Hoa Hồng</h3>
              <p className="text-xs text-slate-400">Dữ liệu lượt click, chuyển đổi đơn hàng và hoa hồng</p>
            </div>
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
              <button className="px-3 py-1 rounded-lg bg-purple-600 text-white font-medium">7 Ngày</button>
              <button className="px-3 py-1 rounded-lg text-slate-400 hover:text-white">30 Ngày</button>
            </div>
          </div>

          {/* Simple Visual Chart Representation */}
          <div className="h-64 flex items-end justify-between gap-3 pt-6 px-2 border-b border-slate-800 pb-4">
            {[
              { day: 'T2', height: '40%', val: '1.8M', clicks: 1200 },
              { day: 'T3', height: '65%', val: '3.2M', clicks: 2100 },
              { day: 'T4', height: '50%', val: '2.5M', clicks: 1700 },
              { day: 'T5', height: '85%', val: '4.8M', clicks: 3400 },
              { day: 'T6', height: '70%', val: '3.9M', clicks: 2800 },
              { day: 'T7', height: '95%', val: '5.6M', clicks: 4200 },
              { day: 'CN', height: '80%', val: '4.2M', clicks: 3100 },
            ].map((bar, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 group relative">
                {/* Tooltip */}
                <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[11px] py-1 px-2 rounded border border-purple-500/40 pointer-events-none whitespace-nowrap z-20">
                  {bar.val} ({bar.clicks} clicks)
                </div>
                <div
                  style={{ height: bar.height }}
                  className="w-full max-w-[40px] rounded-t-xl bg-gradient-to-t from-purple-900 via-purple-600 to-indigo-400 group-hover:brightness-125 transition-all shadow-md"
                />
                <span className="text-xs text-slate-400 font-medium">{bar.day}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-purple-500" />
              <span>Hoa Hồng Tích Lũy (VND)</span>
            </div>
            <span className="text-purple-300 font-semibold">Tăng trưởng đỉnh điểm: Thứ 7 (5.6M)</span>
          </div>
        </div>

        {/* Top Product Performers */}
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-white">Top Sản Phẩm Nổi Bật</h3>
            <Link href="/library" className="text-xs text-purple-400 hover:underline flex items-center gap-1">
              Xem tất cả <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {topProducts.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                Chưa có dữ liệu sản phẩm. Hãy dán link quét shop đầu tiên!
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

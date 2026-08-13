'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ScanLine, 
  Store, 
  Sparkles, 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  ArrowRight,
  Layers,
  StopCircle,
  RefreshCw,
  KeyRound,
  ShoppingBag,
  ExternalLink,
  Flame,
  Check,
  Search,
  Copy,
  Zap,
  Star,
  CheckSquare,
  Square
} from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/utils';
import * as XLSX from 'xlsx';

export default function ScannerPage() {
  const router = useRouter();

  // Mode & Inputs
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [singleUrl, setSingleUrl] = useState('');
  const [bulkText, setBulkText] = useState('');

  // Active Job State
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobData, setJobData] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [unconfiguredAff, setUnconfiguredAff] = useState(false);

  // In-Scanner Product Showcase States (Section 1 - 22)
  const [scannedShop, setScannedShop] = useState<any | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [inScannerQuery, setInScannerQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('score');

  // Multi-select & Link State Transitions (Section 8, 9, 11)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [generatingWholeShop, setGeneratingWholeShop] = useState(false);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Poll Job Progress every 1.5s
  useEffect(() => {
    if (!activeJobId) return;

    const pollStatus = async () => {
      try {
        const res = await fetch(`/api/scan-jobs/${activeJobId}`);
        const data = await res.json();
        if (data.success && data.job) {
          setJobData(data.job);

          if (data.job.items?.some((it: any) => it.errorMessage?.includes('chưa cấu hình'))) {
            setUnconfiguredAff(true);
          }

          // When job completes, load products for the first scanned shop immediately
          if (['completed', 'partial_success'].includes(data.job.status)) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            const firstCompletedItem = data.job.items?.find((it: any) => it.status === 'completed' && it.shopId);
            if (firstCompletedItem?.shopId) {
              loadShopProducts(firstCompletedItem.shopId);
            }
          } else if (['failed', 'cancelled'].includes(data.job.status)) {
            if (pollingRef.current) clearInterval(pollingRef.current);
          }
        }
      } catch (err) {
        console.error('Error polling job status:', err);
      }
    };

    pollStatus();
    pollingRef.current = setInterval(pollStatus, 1500);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [activeJobId]);

  // Fetch Products for the Scanned Shop directly on Scanner Page
  const loadShopProducts = async (shopId: string) => {
    setLoadingProducts(true);
    try {
      // Find database shop ID by externalShopId
      const shopsRes = await fetch('/api/shops');
      const shopsData = await shopsRes.json();
      const dbShop = shopsData.shops?.find((s: any) => s.externalShopId === shopId || s.id === shopId);
      
      const targetId = dbShop?.id || shopId;
      let url = `/api/shops/${targetId}/products?q=${encodeURIComponent(inScannerQuery)}&filterType=${filterType}&sortBy=${sortBy}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setScannedShop(data.shop);
        setProducts(data.products || []);
      }
    } catch (err) {
      console.error('Error loading shop products:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Re-fetch products on filter/search change
  useEffect(() => {
    if (scannedShop?.id) {
      loadShopProducts(scannedShop.id);
    }
  }, [inScannerQuery, filterType, sortBy]);

  // Submit Scanner Form
  const handleSubmitScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setUnconfiguredAff(false);
    setScannedShop(null);
    setProducts([]);

    const urlsToSubmit = isBulkMode
      ? bulkText.split('\n').map((u) => u.trim()).filter(Boolean)
      : [singleUrl.trim()];

    if (urlsToSubmit.length === 0) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/scanner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopUrls: urlsToSubmit }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Không thể bắt đầu lượt quét.');
      }

      setActiveJobId(data.jobId);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Có lỗi xảy ra khi gửi yêu cầu quét.');
    } finally {
      setSubmitting(false);
    }
  };

  // Cancel Scan Job
  const handleCancelJob = async () => {
    if (!activeJobId) return;
    try {
      await fetch(`/api/scan-jobs/${activeJobId}/cancel`, { method: 'POST' });
      const res = await fetch(`/api/scan-jobs/${activeJobId}`);
      const data = await res.json();
      if (data.job) setJobData(data.job);
    } catch (err) {
      console.error('Error cancelling job:', err);
    }
  };

  // Section 8 & 9: 1-CLICK ON-DEMAND LẤY LINK BUTTON
  const handleGetOrCopyLink = async (product: any) => {
    // If link already generated -> Copy directly
    if (product.affiliateUrl) {
      navigator.clipboard.writeText(product.affiliateUrl);
      setCopiedId(product.id);
      showToast('✓ Đã copy Affiliate Link!');
      setTimeout(() => setCopiedId(null), 2000);
      return;
    }

    // Generate link on-demand
    setGeneratingId(product.id);
    try {
      const res = await fetch(`/api/products/${product.id}/affiliate-link`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.status === 'pending_configuration') {
          showToast('Bạn chưa kết nối tài khoản Affiliate!');
          router.push('/accounts');
          return;
        }
        showToast(data.error || 'Lỗi khi tạo link');
        return;
      }

      const generatedLink = data.affiliateUrl || product.originalUrl;
      navigator.clipboard.writeText(generatedLink);
      setCopiedId(product.id);
      showToast('✓ Đã tạo và copy Affiliate Link thành công!');

      // Update local state
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, affiliateUrl: generatedLink } : p))
      );

      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingId(null);
    }
  };

  // Section 12: Whole Shop Link Generator
  const handleGenerateWholeShopLinks = async () => {
    if (!scannedShop) return;
    setGeneratingWholeShop(true);
    try {
      const unlinkedIds = products.filter((p) => p.hasAffiliate && !p.affiliateUrl).map((p) => p.id);
      const res = await fetch('/api/products/bulk-affiliate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: unlinkedIds.length > 0 ? unlinkedIds : undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.status === 'pending_configuration') {
          showToast('Vui lòng kết nối tài khoản Affiliate trước!');
          router.push('/accounts');
          return;
        }
        showToast(data.error || 'Có lỗi xảy ra');
        return;
      }
      showToast(`Đã khởi tạo xong toàn bộ ${data.successCount} Affiliate Links cho Shop!`);
      loadShopProducts(scannedShop.id);
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingWholeShop(false);
    }
  };

  // Checkbox Selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === products.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(products.map((p) => p.id));
    }
  };

  const handleResetScan = () => {
    setActiveJobId(null);
    setJobData(null);
    setScannedShop(null);
    setProducts([]);
    setSingleUrl('');
    setBulkText('');
    setErrorMsg(null);
  };

  const isJobRunning = jobData && ['queued', 'processing', 'resolving', 'scanning', 'queued_for_extension'].includes(jobData.status);

  // Section 16: Commission Color Tier Badges
  const renderCommissionBadge = (rate: number) => {
    if (rate >= 15) {
      return (
        <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-rose-500 text-white font-extrabold text-[11px] shadow-glow flex items-center gap-1">
          <Flame className="w-3 h-3 text-amber-300 fill-amber-300 animate-bounce" />
          <span>🔥 HH {rate}%</span>
        </span>
      );
    }
    if (rate >= 10) {
      return (
        <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-slate-950 font-black text-xs shadow-md">
          HH {rate}%
        </span>
      );
    }
    if (rate >= 5) {
      return (
        <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-extrabold text-[11px] border border-purple-500/40">
          HH {rate}%
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-semibold text-[11px]">
        HH {rate}%
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50 px-4 py-2.5 sm:px-5 sm:py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs shadow-2xl flex items-center gap-2 animate-bounce max-w-[90vw]">
          <Sparkles className="w-4 h-4 text-amber-300 flex-shrink-0" />
          <span className="truncate">{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-[11px] sm:text-xs font-semibold">
          <ScanLine className="w-3.5 h-3.5" />
          <span>Shop Scanner & Instant 1-Click Link Hub</span>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight">
          Quét Shop & Xem <span className="gradient-text">Sản Phẩm Instant</span>
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm max-w-xl mx-auto">
          Dán link shop → Thấy sản phẩm ngay → Thấy hoa hồng ước tính → Bấm LẤY LINK 1-Click → Tự copy clipboard.
        </p>
      </div>

      {/* Mode Switcher */}
      {!activeJobId && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 p-1.5 rounded-2xl bg-slate-900 border border-slate-800 w-full sm:w-fit mx-auto text-xs font-semibold">
          <button
            onClick={() => setIsBulkMode(false)}
            className={`w-full sm:w-auto px-5 py-2 rounded-xl transition-all ${!isBulkMode ? 'gradient-shopee text-white shadow-glow' : 'text-slate-400 hover:text-white'}`}
          >
            Quét 1 Shop Single
          </button>
          <button
            onClick={() => setIsBulkMode(true)}
            className={`w-full sm:w-auto px-5 py-2 rounded-xl transition-all ${isBulkMode ? 'gradient-shopee text-white shadow-glow' : 'text-slate-400 hover:text-white'}`}
          >
            Quét Hàng Loạt – Bulk Import (Tối đa 50 Shop)
          </button>
        </div>
      )}

      {/* Unconfigured Affiliate Account Warning */}
      {unconfiguredAff && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <KeyRound className="w-6 h-6 text-amber-400 flex-shrink-0" />
            <div>
              <h4 className="font-bold text-sm text-amber-100">Shop đã được nhập thành công nhưng chưa kết nối tài khoản Affiliate</h4>
              <p className="text-amber-300/80 text-[11px]">Sản phẩm đã lưu vào thư viện với trạng thái Chờ cấu hình. Kết nối App ID để tự động tạo link.</p>
            </div>
          </div>
          <Link
            href="/accounts"
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 flex-shrink-0"
          >
            <KeyRound className="w-4 h-4" />
            <span>CẤU HÌNH AFFILIATE</span>
          </Link>
        </div>
      )}

      {/* Form Input Container */}
      {!activeJobId && (
        <div className="glass-panel p-4 sm:p-8 rounded-3xl space-y-6 relative overflow-hidden">
          {!isBulkMode ? (
            <form onSubmit={handleSubmitScan} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span>DÁN LINK SHOP (Shopee / Shortlink)</span>
                  <span className="text-purple-400 normal-case font-normal text-xs">Ví dụ: https://shopee.vn/ten-shop</span>
                </label>
                <div className="flex flex-col sm:relative space-y-2 sm:space-y-0">
                  <input
                    type="text"
                    value={singleUrl}
                    onChange={(e) => setSingleUrl(e.target.value)}
                    placeholder="https://shopee.vn/locknlock_official_store hoặc s.shopee.vn/xxxx"
                    disabled={submitting}
                    className="w-full bg-slate-950/90 border-2 border-slate-800 rounded-2xl pl-4 pr-4 sm:pr-36 py-3.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all font-mono"
                  />
                  <button
                    type="submit"
                    disabled={submitting || !singleUrl.trim()}
                    className="w-full sm:w-auto sm:absolute sm:right-2 sm:top-1/2 sm:-translate-y-1/2 px-6 py-2.5 rounded-xl gradient-shopee text-white font-bold text-xs shadow-glow hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
                    <span>QUÉT SHOP</span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmitScan} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                  <span>NHẬP DANH SÁCH LINK SHOP (MỖI LINK 1 DÒNG)</span>
                  <span className="text-purple-400 normal-case font-normal text-xs">Giới hạn tối đa 50 shop / 1 lượt</span>
                </label>
                <textarea
                  rows={6}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={`https://shopee.vn/shop_a\nhttps://shopee.vn/shop_b\nhttps://shopee.vn/shop_c`}
                  disabled={submitting}
                  className="w-full bg-slate-950/90 border-2 border-slate-800 rounded-2xl p-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-all font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={submitting || !bulkText.trim()}
                className="w-full py-3.5 rounded-xl gradient-shopee text-white font-bold text-sm shadow-glow hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                <span>{submitting ? 'ĐANG KHỞI TẠO LƯỢT QUÉT...' : 'QUÉT TOÀN BỘ SHOP TRÊN'}</span>
              </button>
            </form>
          )}

          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      )}

      {/* Progress Bar Panel when scanning */}
      {activeJobId && isJobRunning && (
        <div className="glass-panel p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
              <h3 className="font-bold text-sm text-white">Đang xử lý quét {jobData?.processedShops || 0} / {jobData?.totalShops || 1} Shop...</h3>
            </div>
            <button onClick={handleCancelJob} className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 font-bold text-xs">DỪNG QUÉT</button>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
            <div style={{ width: `${jobData?.progress || 10}%` }} className="h-full bg-purple-500 transition-all duration-300" />
          </div>
        </div>
      )}

      {/* SECTION 17: SHOP HEADER SHOWCASE */}
      {scannedShop && (
        <div className="glass-panel p-6 rounded-3xl space-y-6 border border-purple-500/40">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div className="flex items-center gap-4">
              <img
                src={scannedShop.logo || 'https://images.unsplash.com/photo-1534452203293-494d7ddbf7e0?w=100'}
                alt={scannedShop.name}
                className="w-16 h-16 rounded-2xl object-cover bg-slate-900 border border-slate-800 shadow-md"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-extrabold uppercase">{scannedShop.platform}</span>
                  <h2 className="text-xl font-extrabold text-white tracking-tight">{scannedShop.name}</h2>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  <span>ID: <strong className="text-slate-200">{scannedShop.externalShopId}</strong></span>
                  <span>•</span>
                  <span><strong className="text-white">{scannedShop.productCount}</strong> sản phẩm</span>
                  <span>•</span>
                  <span className="text-emerald-400 font-semibold"><strong className="text-emerald-400">{scannedShop.affProductCount}</strong> Affiliate</span>
                  <span>•</span>
                  <span className="text-amber-300 font-bold">🔥 HH Cao nhất: {scannedShop.maxCommissionRate || 18}%</span>
                </div>
              </div>
            </div>

            {/* Shop Action Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleGenerateWholeShopLinks}
                disabled={generatingWholeShop}
                className="px-4 py-2.5 rounded-xl gradient-shopee text-white font-extrabold text-xs shadow-glow hover:brightness-110 transition-all flex items-center gap-1.5"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                <span>{generatingWholeShop ? 'Đang tạo...' : 'TẠO LINK TOÀN SHOP'}</span>
              </button>

              <a
                href={scannedShop.shopUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white font-semibold text-xs transition-all flex items-center gap-1.5"
              >
                <ExternalLink className="w-4 h-4" />
                <span>MỞ SHOP</span>
              </a>

              <button onClick={handleResetScan} className="px-3 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs">Quét Shop Khác</button>
            </div>
          </div>

          {/* SECTION 13 & 14: IN-SCANNER SEARCH BAR & FILTERS */}
          <div className="space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={inScannerQuery}
                onChange={(e) => setInScannerQuery(e.target.value)}
                placeholder={`Tìm trong ${products.length} sản phẩm của shop... (bình nước, nồi chiên...)`}
                className="w-full bg-slate-950/90 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-all"
              />
            </div>

            {/* Filter Tabs & Sort */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'all', label: 'Tất Cả' },
                  { id: 'eligible', label: 'Có Hoa Hồng' },
                  { id: 'comm_5', label: 'Hoa Hồng > 5%' },
                  { id: 'comm_10', label: 'Hoa Hồng > 10%' },
                  { id: 'comm_15', label: '🔥 Hoa Hồng > 15%' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilterType(f.id)}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                      filterType === f.id ? 'bg-purple-600 text-white' : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
              >
                <option value="score">Sắp xếp: Affiliate Score</option>
                <option value="commissionRate">Hoa hồng cao nhất</option>
                <option value="sold">Bán chạy nhất</option>
                <option value="price_asc">Giá tăng dần</option>
                <option value="price_desc">Giá giảm dần</option>
              </select>
            </div>
          </div>
          {/* SECTION 15: PRODUCT CARDS GRID */}
          {loadingProducts ? (
            <div className="text-center py-12 text-slate-500 text-xs">Đang tải sản phẩm của Shop...</div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <ShoppingBag className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="font-bold text-white text-base">Chưa lấy được sản phẩm từ Shop này</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                Shopee API có thể đang bị Cloudflare bảo vệ hoặc giới hạn IP. Bạn có thể thử:
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => scannedShop && loadShopProducts(scannedShop.id)}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>THỬ LẠI</span>
                </button>
                <button
                  onClick={handleResetScan}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all flex items-center gap-2"
                >
                  <ScanLine className="w-4 h-4" />
                  <span>QUÉT SHOP KHÁC</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 pt-2">
                💡 Tip: Cài <strong className="text-purple-300">Chrome Extension</strong> (thư mục extension/) để quét sản phẩm trực tiếp từ trình duyệt của bạn — không bị Cloudflare chặn.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {products.map((p) => {
                const estComm = Math.round((p.salePrice * p.commissionRate) / 100);
                const isGenerating = generatingId === p.id;
                const isCopied = copiedId === p.id;

                return (
                  <div key={p.id} className="glass-card p-4 rounded-2xl overflow-hidden flex flex-col justify-between group relative border border-slate-800/80">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(p.id)}
                      onChange={() => toggleSelect(p.id)}
                      className="absolute top-3 left-3 z-10 w-4 h-4 rounded border-slate-700 text-purple-600 cursor-pointer"
                    />

                    {/* Image & Badges */}
                    <div className="relative aspect-square overflow-hidden rounded-xl bg-slate-900 mb-3">
                      <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      
                      {/* Commission Tier Badge (Section 16) */}
                      <div className="absolute top-2 right-2 z-10">
                        {renderCommissionBadge(p.commissionRate)}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="space-y-2 flex-1 flex flex-col justify-between">
                      <div className="space-y-1">
                        <h3 className="text-xs font-bold text-white line-clamp-2 leading-relaxed" title={p.name}>{p.name}</h3>
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="text-emerald-400 font-extrabold text-sm">{formatCurrency(p.salePrice)}</span>
                          <span>Đã bán {formatNumber(p.sold)}</span>
                        </div>
                      </div>

                      {/* Section 5: Estimated Commission */}
                      <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-[11px] flex items-center justify-between">
                        <span className="text-slate-400">Hoa hồng ước tính:</span>
                        <span className="text-emerald-400 font-extrabold">~{formatCurrency(estComm)} / đơn</span>
                      </div>

                      {/* Section 8 & 9: 1-CLICK LẤY LINK BUTTON */}
                      <div className="pt-2 space-y-1.5">
                        <button
                          onClick={() => handleGetOrCopyLink(p)}
                          disabled={isGenerating}
                          className={`w-full py-2.5 rounded-xl font-extrabold text-xs shadow-glow transition-all flex items-center justify-center gap-2 ${
                            isCopied
                              ? 'bg-emerald-500 text-slate-950'
                              : p.affiliateUrl
                              ? 'gradient-shopee text-white hover:brightness-110'
                              : 'bg-purple-600 hover:bg-purple-500 text-white'
                          }`}
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>ĐANG TẠO...</span>
                            </>
                          ) : isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                              <span>✓ ĐÃ COPY</span>
                            </>
                          ) : p.affiliateUrl ? (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>COPY LINK</span>
                            </>
                          ) : (
                            <>
                              <Zap className="w-3.5 h-3.5 text-amber-300" />
                              <span>LẤY LINK</span>
                            </>
                          )}
                        </button>

                        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                          <a href={p.originalUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> Mở Shopee
                          </a>
                          {p.affiliateUrl && (
                            <span className="text-emerald-400 font-mono text-[10px]">Link sẵn sàng</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

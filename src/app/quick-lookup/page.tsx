'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Search,
  Coins,
  TrendingUp,
  ShoppingBag,
  Store,
  Star,
  Copy,
  Check,
  ExternalLink,
  QrCode,
  Save,
  ShieldCheck,
  Layers,
  Users,
  Key,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { CATEGORY_OPTIONS, TARGET_CUSTOMER_OPTIONS } from '@/lib/constants';

interface LookupData {
  name: string;
  image: string;
  shopName: string;
  isShopXtra: boolean;
  isMall: boolean;
  price: number;
  priceFormatted: string;
  sold: string;
  soldCount: number;
  rating: number;
  itemId: string;
  shopId: string;
  shopeeUrl: string;
  generatedAffiliateUrl: string;
  commission: {
    totalRate: number;
    totalAmountFormatted: string;
    totalAmount: number;
    sellerRate: number;
    sellerAmountFormatted: string;
    sellerAmount: number;
    shopeeRate: number;
    shopeeAmountFormatted: string;
    shopeeAmount: number;
    capAmountFormatted: string;
    capAmount: number;
    capStatus: string;
    note?: string;
    isUnlocked: boolean;
  };
  priceHistory: {
    currentPrice: string;
    maxPrice: string;
    avgPrice: string;
    change7d: string;
    change30d: string;
  };
  fetchedAt: string;
}

export default function QuickLookupPage() {
  const [inputUrl, setInputUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupData | null>(null);

  // Affiliate & Save Options
  const [subId, setSubId] = useState('');
  const [category, setCategory] = useState('Thời trang nữ');
  const [targetCustomer, setTargetCustomer] = useState('Phụ nữ văn phòng');
  const [savingToLibrary, setSavingToLibrary] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Copy states
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);

  // QR Modal
  const [showQR, setShowQR] = useState(false);

  // Cookie Modal
  const [showCookieModal, setShowCookieModal] = useState(false);
  const [customCookie, setCustomCookie] = useState('');

  const handleSearch = async (queryToSearch?: string) => {
    const q = queryToSearch || inputUrl;
    if (!q.trim()) return;

    setLoading(true);
    setError(null);
    setSavedSuccess(false);

    try {
      const res = await fetch('/api/tools/quick-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: q.trim(),
          customCookie: customCookie.trim() || undefined,
          subId: subId.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Không tìm thấy thông tin sản phẩm này.');
        setResult(null);
      } else {
        setResult(data.data);
      }
    } catch (err: any) {
      setError(err?.message || 'Có lỗi kết nối máy chủ.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToLibrary = async () => {
    if (!result) return;
    setSavingToLibrary(true);

    try {
      const res = await fetch('/api/tools/quick-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: result.itemId,
          saveToLibrary: true,
          category,
          targetCustomer,
          subId: subId.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      } else {
        alert(data.error || 'Không thể lưu vào thư viện.');
      }
    } catch (e: any) {
      alert(e?.message || 'Lỗi khi lưu sản phẩm.');
    } finally {
      setSavingToLibrary(false);
    }
  };

  const copyToClipboard = (text: string, type: 'aff' | 'raw') => {
    navigator.clipboard.writeText(text);
    if (type === 'aff') {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 2000);
    }
  };

  const sampleProducts = [
    { label: 'Áo Len Nam Nữ', id: '1589295236' },
    { label: 'Son Dưỡng Dior', id: '23562309118' },
    { label: 'Tai Nghe Bluetooth', id: '22145678901' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Addlivetag Engine Proxy
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3">
            <Coins className="w-7 h-7 text-amber-400" />
            Tra Cứu Hoa Hồng & Lịch Sử Giá
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Tra cứu tức thì tỷ lệ hoa hồng (Shopee + Seller Extra + Cap), biến động giá 30 ngày và tạo link Affiliate 1-click.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCookieModal(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-sm"
          >
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span>Cấu Hình Cookie</span>
          </button>

          <Link
            href="/library"
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-sm"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-cyan-400" />
            <span>Xem Thư Viện</span>
          </Link>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="Dán link Shopee (shopee.vn, s.shopee.vn, shp.ee) hoặc nhập Item ID (vd: 1589295236)..."
              className="w-full bg-slate-950/90 border border-slate-700 focus:border-purple-500 rounded-xl px-4 py-3.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all font-mono"
            />
            {inputUrl && (
              <button
                type="button"
                onClick={() => setInputUrl('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs px-2 py-1 bg-slate-800 rounded-lg"
              >
                Xóa
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !inputUrl.trim()}
            className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Đang Tra Cứu...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Tra Cứu Ngay</span>
              </>
            )}
          </button>
        </form>

        {/* Quick Sample Links */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-400">
          <span className="font-semibold text-slate-500">Mẫu thử nhanh:</span>
          {sampleProducts.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setInputUrl(p.id);
                handleSearch(p.id);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-purple-300 border border-slate-700/60 transition-all"
            >
              {p.label} (#{p.id})
            </button>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-3 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Không thể tra cứu sản phẩm</p>
            <p className="text-xs text-rose-400/90 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Results View */}
      {result && (
        <div className="space-y-6">
          {/* Main Product Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Product Image */}
            <div className="lg:col-span-4 flex flex-col items-center">
              <div className="relative w-full max-w-sm aspect-square rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner">
                {result.image ? (
                  <img
                    src={result.image}
                    alt={result.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                    Không có ảnh
                  </div>
                )}
                {result.isShopXtra && (
                  <span className="absolute top-3 left-3 px-2 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wide flex items-center gap-1 shadow-md">
                    ⚡ Xtra Shop
                  </span>
                )}
                {result.isMall && (
                  <span className="absolute top-3 right-3 px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-black uppercase tracking-wide shadow-md">
                    Shopee Mall
                  </span>
                )}
              </div>
            </div>

            {/* Right: Product Details & Actions */}
            <div className="lg:col-span-8 space-y-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mb-1.5">
                  <span className="flex items-center gap-1 text-slate-300 font-semibold">
                    <Store className="w-3.5 h-3.5 text-purple-400" />
                    {result.shopName}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-amber-400 font-bold">
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    {result.rating}
                  </span>
                  <span>•</span>
                  <span className="text-slate-400">{result.sold}</span>
                  <span>•</span>
                  <span className="font-mono text-slate-500">#{result.itemId}</span>
                </div>

                <h2 className="text-lg font-bold text-white leading-snug">{result.name}</h2>
              </div>

              {/* Price & Primary Headline */}
              <div className="flex flex-wrap items-baseline gap-4 p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div>
                  <span className="text-xs text-slate-400 block font-medium">Giá bán hiện tại</span>
                  <span className="text-2xl font-black text-emerald-400">{result.priceFormatted}</span>
                </div>

                <div className="h-8 w-px bg-slate-800 hidden sm:block" />

                <div>
                  <span className="text-xs text-slate-400 block font-medium">Tổng Hoa Hồng Dự Kiến</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-amber-400">
                      {result.commission.totalRate > 0 ? `${result.commission.totalRate}%` : 'Chưa rõ'}
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      ≈ {result.commission.totalAmountFormatted} / đơn
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <a
                  href={result.shopeeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 transition-all border border-slate-700"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Xem Trên Shopee</span>
                </a>

                <button
                  onClick={() => setShowQR(true)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 transition-all border border-slate-700"
                >
                  <QrCode className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Mã QR Mua Hàng</span>
                </button>

                <button
                  onClick={() => copyToClipboard(result.generatedAffiliateUrl, 'aff')}
                  className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-purple-600/20"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Đã Copy Link Affiliate!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Link Affiliate</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* 4 Commission Cards Breakdown */}
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-3">
              <Coins className="w-4 h-4 text-amber-400" />
              Chi Tiết Phân Tách Hoa Hồng (Commission Breakdown)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Total */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/30 space-y-1">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                  🌟 Tổng Hoa Hồng
                </span>
                <div className="text-xl font-black text-white">
                  {result.commission.totalRate}%
                </div>
                <div className="text-xs text-amber-300/90 font-semibold">
                  ≈ {result.commission.totalAmountFormatted}
                </div>
                <p className="text-[11px] text-slate-400 pt-1">Tổng cộng Shopee + Shop chi trả</p>
              </div>

              {/* Card 2: Seller Extra */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
                  🏪 Hoa Hồng Shop (Seller)
                </span>
                <div className="text-xl font-black text-white">
                  {result.commission.sellerRate}%
                </div>
                <div className="text-xs text-emerald-300/90 font-semibold">
                  ≈ {result.commission.sellerAmountFormatted}
                </div>
                <p className="text-[11px] text-slate-400 pt-1">Shop tự nguyện trả thêm cho KOL</p>
              </div>

              {/* Card 3: Shopee Base */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider block">
                  🛍️ Hoa Hồng Sàn (Shopee)
                </span>
                <div className="text-xl font-black text-white">
                  {result.commission.shopeeRate}%
                </div>
                <div className="text-xs text-cyan-300/90 font-semibold">
                  ≈ {result.commission.shopeeAmountFormatted}
                </div>
                <p className="text-[11px] text-slate-400 pt-1">Mức hoa hồng tiêu chuẩn của ngành</p>
              </div>

              {/* Card 4: Cap */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-xs font-bold text-pink-400 uppercase tracking-wider block">
                  🛡️ Mức Trần (Cap Tối Đa)
                </span>
                <div className="text-xl font-black text-white">
                  {result.commission.capAmountFormatted}
                </div>
                <div className="text-xs text-pink-300/90 font-semibold">
                  Trạng thái: {result.commission.capStatus}
                </div>
                <p className="text-[11px] text-slate-400 pt-1">Mức hoa hồng tối đa nhận trên 1 SP</p>
              </div>
            </div>

            {result.commission.note && (
              <div className="mt-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-400 flex items-center gap-2">
                <Info className="w-4 h-4 text-purple-400 shrink-0" />
                <span>{result.commission.note}</span>
              </div>
            )}
          </div>

          {/* 30-Day Price History */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              Lịch Sử Biến Động Giá (Price History)
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-medium">Giá hiện tại</span>
                <span className="text-base font-bold text-white">{result.priceHistory.currentPrice}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-medium">Giá cao nhất từng ghi nhận</span>
                <span className="text-base font-bold text-amber-400">{result.priceHistory.maxPrice}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-medium">Biến động 7 ngày</span>
                <span className="text-base font-bold text-cyan-400">{result.priceHistory.change7d}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-medium">Biến động 30 ngày</span>
                <span className={`text-base font-bold ${result.priceHistory.change30d.startsWith('-') ? 'text-emerald-400' : 'text-slate-300'}`}>
                  {result.priceHistory.change30d}
                </span>
              </div>
            </div>
          </div>

          {/* 1-Click Save to Library Panel */}
          <div className="bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 border border-purple-500/30 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Save className="w-4 h-4 text-purple-400" />
                  Lưu Sản Phẩm Này Vào Thư Viện (Library)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tự động lưu với đầy đủ % hoa hồng, giá bán, link affiliate để quản lý và tạo video AI.
                </p>
              </div>

              {savedSuccess && (
                <div className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Đã Lưu Vào Thư Viện!
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1 font-semibold">
                  <Layers className="w-3 h-3 inline mr-1 text-cyan-400" />
                  Ngành Hàng
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1 font-semibold">
                  <Users className="w-3 h-3 inline mr-1 text-pink-400" />
                  Đối Tượng Khách Hàng
                </label>
                <select
                  value={targetCustomer}
                  onChange={(e) => setTargetCustomer(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  {TARGET_CUSTOMER_OPTIONS.map((tc) => (
                    <option key={tc} value={tc}>{tc}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleSaveToLibrary}
                  disabled={savingToLibrary}
                  className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-purple-600/20 disabled:opacity-50"
                >
                  {savingToLibrary ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang Lưu...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Lưu Vào Thư Viện</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQR && result && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full space-y-4 text-center">
            <h3 className="text-base font-bold text-white flex items-center justify-center gap-2">
              <QrCode className="w-4 h-4 text-cyan-400" />
              Mã QR Mua Hàng Trực Tiếp
            </h3>

            <div className="p-4 bg-white rounded-xl inline-block shadow-lg mx-auto">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(result.generatedAffiliateUrl)}`}
                alt="QR Code"
                className="w-48 h-48"
              />
            </div>

            <p className="text-xs text-slate-400">
              Quét bằng camera điện thoại hoặc Shopee App để mở trang mua hàng ngay.
            </p>

            <button
              onClick={() => setShowQR(false)}
              className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-all"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Cookie Configuration Modal */}
      {showCookieModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-400" />
              Cấu Hình Cookie Addlivetag
            </h3>

            <p className="text-xs text-slate-400 leading-relaxed">
              Dán chuỗi Cookie tài khoản Addlivetag của bạn để xem đầy đủ % hoa hồng Shopee + Seller Extra + Cap tối đa.
            </p>

            <div>
              <textarea
                value={customCookie}
                onChange={(e) => setCustomCookie(e.target.value)}
                placeholder="us_id=...; user=...; PHPSESSID=...; portal_sess=..."
                rows={4}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-purple-500 resize-none"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Mặc định hệ thống đã nạp sẵn cookie trong file .env
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowCookieModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Đóng
              </button>
              <button
                onClick={() => {
                  setShowCookieModal(false);
                  alert('Đã áp dụng cookie cho phiên tra cứu này!');
                }}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
              >
                Lưu & Áp Dụng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

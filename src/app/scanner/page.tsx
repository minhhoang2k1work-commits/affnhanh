'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ScanLine, 
  Store, 
  Sparkles, 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  ArrowRight,
  Layers,
  Copy,
  ExternalLink,
  ShieldCheck,
  ShoppingBag
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function ScannerPage() {
  const router = useRouter();
  const [shopUrl, setShopUrl] = useState('');
  const [bulkUrls, setBulkUrls] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [scanResult, setScanResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const steps = [
    "Đang nhận diện nền tảng & xác định Shop ID...",
    "Đang lấy toàn bộ danh sách sản phẩm của Shop...",
    "Đang kiểm tra điều kiện Affiliate sản phẩm...",
    "Đang khởi tạo Affiliate Deep Link cá nhân...",
    "Hoàn tất đồng bộ & tạo thư viện sản phẩm!"
  ];

  const handleScanSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopUrl.trim()) return;

    setIsLoading(true);
    setErrorMsg(null);
    setScanResult(null);
    setCurrentStep(0);

    // Simulate animated step progression
    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < steps.length - 2) return prev + 1;
        return prev;
      });
    }, 900);

    try {
      const res = await fetch('/api/scanner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopUrl: shopUrl.trim() }),
      });

      const data = await res.json();
      clearInterval(stepInterval);

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Không thể quét shop');
      }

      setCurrentStep(4);
      setScanResult(data.results[0]);
    } catch (err: any) {
      clearInterval(stepInterval);
      setErrorMsg(err?.message || 'Có lỗi xảy ra khi kết nối máy chủ.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    const urls = bulkUrls.split('\n').map(u => u.trim()).filter(Boolean);
    if (urls.length === 0) return;

    setIsLoading(true);
    setErrorMsg(null);
    setScanResult(null);
    setCurrentStep(0);

    try {
      const res = await fetch('/api/scanner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopUrls: urls }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Lỗi quét hàng loạt');

      setCurrentStep(4);
      setScanResult({
        isBulk: true,
        scannedCount: data.scannedCount,
        results: data.results,
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Có lỗi xảy ra.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Title */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold">
          <ScanLine className="w-3.5 h-3.5" />
          <span>Shop Scanner & Product Resolver</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
          Bóc Tách Shop & Tạo <span className="gradient-text">Link Affiliate Tự Động</span>
        </h1>
        <p className="text-slate-400 text-sm max-w-xl mx-auto">
          Dán đường dẫn shop Shopee. Hệ thống sẽ tự động quét danh mục sản phẩm, lọc các sản phẩm có hoa hồng và tạo sẵn Deep Link cho bạn.
        </p>
      </div>

      {/* Mode Switcher */}
      <div className="flex items-center justify-center gap-2 p-1.5 rounded-2xl bg-slate-900 border border-slate-800 w-fit mx-auto text-xs font-semibold">
        <button
          onClick={() => setIsBulkMode(false)}
          className={`px-5 py-2 rounded-xl transition-all ${!isBulkMode ? 'gradient-shopee text-white shadow-glow' : 'text-slate-400 hover:text-white'}`}
        >
          Quét 1 Shop Single
        </button>
        <button
          onClick={() => setIsBulkMode(true)}
          className={`px-5 py-2 rounded-xl transition-all ${isBulkMode ? 'gradient-shopee text-white shadow-glow' : 'text-slate-400 hover:text-white'}`}
        >
          Quét Hàng Loạt (Bulk Import)
        </button>
      </div>

      {/* Main Form Box */}
      <div className="glass-panel p-8 rounded-3xl space-y-6 relative overflow-hidden">
        {!isBulkMode ? (
          /* Single Shop URL Form */
          <form onSubmit={handleScanSingle} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>DÁN LINK SHOP (Shopee / Shortlink)</span>
                <span className="text-purple-400 normal-case font-normal text-xs">Ví dụ: https://shopee.vn/ten-shop</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={shopUrl}
                  onChange={(e) => setShopUrl(e.target.value)}
                  placeholder="https://shopee.vn/locknlock_official_store hoặc s.shopee.vn/xxxx"
                  disabled={isLoading}
                  className="w-full bg-slate-950/90 border-2 border-slate-800 rounded-2xl pl-4 pr-36 py-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all font-mono"
                />
                <button
                  type="submit"
                  disabled={isLoading || !shopUrl.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2.5 rounded-xl gradient-shopee text-white font-bold text-xs shadow-glow hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
                  <span>QUÉT SHOP</span>
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* Bulk Import Form */
          <form onSubmit={handleScanBulk} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>NHẬP DANH SÁCH LINK SHOP (MỖI LINK 1 DÒNG)</span>
                <span className="text-purple-400 normal-case font-normal text-xs">Tối đa 50 Shop cùng lúc</span>
              </label>
              <textarea
                rows={5}
                value={bulkUrls}
                onChange={(e) => setBulkUrls(e.target.value)}
                placeholder={`https://shopee.vn/shop_a\nhttps://shopee.vn/shop_b\nhttps://shopee.vn/shop_c`}
                disabled={isLoading}
                className="w-full bg-slate-950/90 border-2 border-slate-800 rounded-2xl p-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-all font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !bulkUrls.trim()}
              className="w-full py-3.5 rounded-xl gradient-shopee text-white font-bold text-sm shadow-glow hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
              <span>QUÉT TOÀN BỘ SHOP TRÊN</span>
            </button>
          </form>
        )}

        {/* Error Notification */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Animated Progress Modal / Card */}
        {isLoading && (
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-purple-500/30 space-y-4 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                <h4 className="font-bold text-sm text-white">Đang xử lý dữ liệu Shop...</h4>
              </div>
              <span className="text-xs font-mono text-purple-300">{currentStep + 1}/{steps.length}</span>
            </div>

            {/* Step List Progress */}
            <div className="space-y-2">
              {steps.map((st, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-3 text-xs transition-colors ${
                    idx === currentStep
                      ? 'text-purple-300 font-semibold'
                      : idx < currentStep
                      ? 'text-emerald-400 line-through'
                      : 'text-slate-600'
                  }`}
                >
                  {idx < currentStep ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  ) : idx === currentStep ? (
                    <span className="w-4 h-4 rounded-full border-2 border-purple-400 border-t-transparent animate-spin flex-shrink-0" />
                  ) : (
                    <span className="w-4 h-4 rounded-full border border-slate-700 flex-shrink-0" />
                  )}
                  <span>{st}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scan Results View (Section 4 Display Requirement) */}
        {scanResult && !isLoading && (
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-emerald-500/40 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Quét Shop Thành Công!</h3>
                  <p className="text-xs text-slate-400">Shop: <span className="text-white font-semibold">{scanResult?.shop?.name}</span></p>
                </div>
              </div>
              <button
                onClick={() => router.push('/library')}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-all flex items-center gap-1.5"
              >
                <span>Đến Thư Viện</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Results Statistics Breakdown */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-1">
                <div className="text-xs text-slate-400">Tổng sản phẩm</div>
                <div className="text-2xl font-extrabold text-white">{scanResult.totalFound}</div>
              </div>
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-center space-y-1">
                <div className="text-xs text-emerald-400 font-semibold">Có thể Affiliate</div>
                <div className="text-2xl font-extrabold text-emerald-400">{scanResult.totalAffiliate}</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-1">
                <div className="text-xs text-slate-400">Không hỗ trợ</div>
                <div className="text-2xl font-extrabold text-slate-400">{scanResult.nonAffiliate}</div>
              </div>
            </div>

            {/* Sample Products Preview */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Xem trước sản phẩm vừa import:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {scanResult.products?.slice(0, 4).map((p: any) => (
                  <div key={p.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3">
                    <img src={p.image} alt={p.name} className="w-10 h-10 rounded-lg object-cover bg-slate-800" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-white truncate">{p.name}</div>
                      <div className="text-[11px] text-emerald-400 font-medium">{formatCurrency(p.salePrice)} • HH {p.commissionRate}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

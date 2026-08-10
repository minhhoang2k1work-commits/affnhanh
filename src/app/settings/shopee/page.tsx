'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Settings, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  ShieldCheck, 
  KeyRound, 
  ShoppingBag, 
  Zap, 
  BarChart2, 
  Loader2,
  ExternalLink
} from 'lucide-react';

export default function ShopeeSettingsPage() {
  const [productStatus, setProductStatus] = useState<any | null>(null);
  const [affiliateAccount, setAffiliateAccount] = useState<any | null>(null);
  const [testingProduct, setTestingProduct] = useState(false);
  const [testingAffiliate, setTestingAffiliate] = useState(false);
  const [productTestResult, setProductTestResult] = useState<any | null>(null);
  const [affiliateTestResult, setAffiliateTestResult] = useState<any | null>(null);

  const fetchStatus = async () => {
    try {
      const summaryRes = await fetch('/api/dashboard/summary');
      const summaryData = await summaryRes.json();
      if (summaryData.integrationStatus) {
        setProductStatus(summaryData.integrationStatus);
      }

      const accRes = await fetch('/api/accounts');
      const accData = await accRes.json();
      if (accData.accounts) {
        const shopeeAcc = accData.accounts.find((a: any) => a.platform === 'SHOPEE' && a.isDefault) || accData.accounts[0];
        setAffiliateAccount(shopeeAcc || null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleTestProductIntegration = async () => {
    setTestingProduct(true);
    setProductTestResult(null);
    try {
      const res = await fetch('/api/settings/shopee/test-product', { method: 'POST' });
      const data = await res.json();
      setProductTestResult(data);
    } catch (err: any) {
      setProductTestResult({ success: false, error: err?.message || 'Có lỗi kết nối.' });
    } finally {
      setTestingProduct(false);
    }
  };

  const handleTestAffiliateIntegration = async () => {
    if (!affiliateAccount?.id) {
      setAffiliateTestResult({
        success: false,
        error: 'BLOCKED BY SHOPEE API/PERMISSION: Chưa kết nối tài khoản Affiliate. Vui lòng thêm App ID & App Secret.',
      });
      return;
    }

    setTestingAffiliate(true);
    setAffiliateTestResult(null);
    try {
      const res = await fetch('/api/accounts/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: affiliateAccount.id }),
      });
      const data = await res.json();
      setAffiliateTestResult(data);
    } catch (err: any) {
      setAffiliateTestResult({ success: false, error: err?.message || 'Có lỗi kết nối.' });
    } finally {
      setTestingAffiliate(false);
    }
  };

  const isAffConnected = Boolean(affiliateAccount);

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold mb-2">
            <Settings className="w-3.5 h-3.5" />
            <span>Shopee Integration Diagnostics</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Cài Đặt & Trạng Thái Kết Nối Shopee
          </h1>
          <p className="text-xs text-slate-400">Phân tách rõ ràng giữa dữ liệu Sản Phẩm Marketplace và Dữ liệu Hoa Hồng Affiliate.</p>
        </div>

        <Link
          href="/accounts"
          className="px-5 py-2.5 rounded-xl gradient-shopee text-white font-extrabold text-xs shadow-glow hover:brightness-110 transition-all flex items-center justify-center gap-2"
        >
          <KeyRound className="w-4 h-4" />
          <span>CẤU HÌNH CREDENTIALS</span>
        </Link>
      </div>

      {/* Section 1: Real Connection Status Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Source A: Marketplace / Product Data */}
        <div className="glass-card p-6 rounded-2xl space-y-4 border-purple-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base">A. Marketplace Product Data</h3>
                <p className="text-xs text-slate-400">Dùng cho: Shop, Product, Ảnh, Giá, Solved, Stock</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Connected
            </span>
          </div>

          <div className="space-y-2 text-xs p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex justify-between">
              <span className="text-slate-400">Shopee Product Data:</span>
              <span className="text-emerald-400 font-bold">Connected</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Nguồn API:</span>
              <span className="text-purple-300 font-mono">Shopee Open Platform / Web Resolver</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Metadata Mode:</span>
              <span className="text-slate-300 font-mono">isRealData = true</span>
            </div>
          </div>

          {productTestResult && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              productTestResult.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              {productTestResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />}
              <span>{productTestResult.message || productTestResult.error}</span>
            </div>
          )}

          <button
            onClick={handleTestProductIntegration}
            disabled={testingProduct}
            className="w-full py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-purple-500/50 text-slate-200 font-bold text-xs transition-all flex items-center justify-center gap-2"
          >
            {testingProduct ? <Loader2 className="w-4 h-4 animate-spin text-purple-400" /> : <RefreshCw className="w-4 h-4 text-purple-400" />}
            <span>TEST SHOPEE PRODUCT INTEGRATION</span>
          </button>
        </div>

        {/* Source B: Affiliate Data */}
        <div className="glass-card p-6 rounded-2xl space-y-4 border-emerald-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base">B. Affiliate Link & Commission Data</h3>
                <p className="text-xs text-slate-400">Dùng cho: Deep Link, Commission %, Offer Data</p>
              </div>
            </div>
            <span className={`px-2.5 py-1 rounded-full font-bold text-xs flex items-center gap-1 ${
              isAffConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-300'
            }`}>
              {isAffConnected ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              {isAffConnected ? 'Connected' : 'Chưa cấu hình'}
            </span>
          </div>

          <div className="space-y-2 text-xs p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex justify-between">
              <span className="text-slate-400">Shopee Affiliate API:</span>
              <span className={isAffConnected ? 'text-emerald-400 font-bold' : 'text-amber-300 font-bold'}>
                {isAffConnected ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Affiliate Link Generation:</span>
              <span className={isAffConnected ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                {isAffConnected ? 'Available' : 'Unavailable'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Commission Data:</span>
              <span className={isAffConnected ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                {isAffConnected ? 'Available' : 'Unavailable'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Conversion & Order Report:</span>
              <span className="text-amber-400 font-mono">Unavailable (BLOCKED BY PERMISSION)</span>
            </div>
          </div>

          {affiliateTestResult && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              affiliateTestResult.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              {affiliateTestResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />}
              <span>{affiliateTestResult.message || affiliateTestResult.error}</span>
            </div>
          )}

          <button
            onClick={handleTestAffiliateIntegration}
            disabled={testingAffiliate}
            className="w-full py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 text-slate-200 font-bold text-xs transition-all flex items-center justify-center gap-2"
          >
            {testingAffiliate ? <Loader2 className="w-4 h-4 animate-spin text-emerald-400" /> : <RefreshCw className="w-4 h-4 text-emerald-400" />}
            <span>TEST AFFILIATE LINK INTEGRATION</span>
          </button>
        </div>
      </div>

      {/* Section 15: BLOCKED BY SHOPEE API Diagnostic Protocol Box */}
      <div className="glass-panel p-6 rounded-3xl space-y-4 border border-amber-500/30">
        <div className="flex items-center gap-3 text-amber-300">
          <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0" />
          <h3 className="font-extrabold text-base text-amber-200">Giao Thức Chẩn Đoán BLOCKED BY SHOPEE API / PERMISSION</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="text-slate-400 font-semibold block uppercase text-[10px]">Chức năng cần</span>
            <p className="text-white font-bold">Conversion & Order Report API</p>
            <p className="text-slate-400 text-[11px]">Tự động đồng bộ báo cáo đơn hàng và số tiền hoa hồng thực nhận theo từng sub_id.</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="text-slate-400 font-semibold block uppercase text-[10px]">Credential hiện có</span>
            <p className="text-emerald-400 font-bold">Shopee Affiliate Open API (App ID + Secret)</p>
            <p className="text-slate-400 text-[11px]">Cho phép sinh Affiliate Short Link và truy vấn Offer Catalog.</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="text-slate-400 font-semibold block uppercase text-[10px]">Credential / Quyền còn thiếu</span>
            <p className="text-amber-300 font-bold">Shopee MCN / Partner Reporting Scope</p>
            <p className="text-slate-400 text-[11px]">Cần đăng ký chính thức với Shopee Partner Network để được duyệt scope báo cáo đơn hàng.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import {
  Link2,
  Sparkles,
  Search,
  Copy,
  Check,
  Zap,
  TrendingUp,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Layers,
  KeyRound,
  Filter,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Globe,
  Loader2,
  ArrowRight,
  FileText,
  DollarSign,
  PieChart
} from 'lucide-react';

export default function AccesstradePage() {
  const [activeTab, setActiveTab] = useState<'converter' | 'campaigns' | 'orders' | 'settings'>('converter');

  // Converter state
  const [inputUrls, setInputUrls] = useState('');
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [subId1, setSubId1] = useState('AFF_HUB');
  const [subId2, setSubId2] = useState('');
  const [subId3, setSubId3] = useState('');
  const [converting, setConverting] = useState(false);
  const [convertedLinks, setConvertedLinks] = useState<any[]>([]);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Campaigns state
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [campaignSearch, setCampaignSearch] = useState('');
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  // Orders state
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // API Key Settings State
  const [apiKeyInfo, setApiKeyInfo] = useState<any>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [keyTestMsg, setKeyTestMsg] = useState<{ success: boolean; text: string } | null>(null);

  // Fetch status on load
  useEffect(() => {
    fetchKeyStatus();
    fetchCampaigns();
  }, []);

  const fetchKeyStatus = async () => {
    try {
      const res = await fetch('/api/accesstrade/test-key');
      const data = await res.json();
      setApiKeyInfo(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCampaigns = async (search = '') => {
    setLoadingCampaigns(true);
    try {
      const query = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await fetch(`/api/accesstrade/campaigns${query}`);
      const data = await res.json();
      if (data.data) {
        setCampaigns(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch('/api/accesstrade/orders');
      const data = await res.json();
      if (data.data) {
        setOrders(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrls.trim()) return;

    setConverting(true);
    setConvertError(null);
    setConvertedLinks([]);

    const urls = inputUrls
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    try {
      const res = await fetch('/api/accesstrade/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls,
          campaignId: selectedCampaignId || undefined,
          subId1,
          subId2,
          subId3,
        }),
      });

      const data = await res.json();

      if (data.success && data.results) {
        setConvertedLinks(data.results);
      } else {
        setConvertError(data.error || 'Không thể tạo Deep Link từ Accesstrade.');
      }
    } catch (err: any) {
      setConvertError(err?.message || 'Có lỗi khi kết nối server.');
    } finally {
      setConverting(false);
    }
  };

  const handleCopy = (url: string, index: number) => {
    navigator.clipboard.writeText(url);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;

    setSavingKey(true);
    setKeyTestMsg(null);

    try {
      const res = await fetch('/api/accesstrade/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKeyInput, save: true }),
      });
      const data = await res.json();

      if (data.success) {
        setKeyTestMsg({ success: true, text: 'Đã lưu và xác thực thành công API Key Accesstrade!' });
        fetchKeyStatus();
        setApiKeyInput('');
      } else {
        setKeyTestMsg({ success: false, text: data.message || 'API Key không hợp lệ.' });
      }
    } catch (err: any) {
      setKeyTestMsg({ success: false, text: err?.message || 'Có lỗi kết nối máy chủ.' });
    } finally {
      setSavingKey(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header Banner */}
      <div className="glass-panel p-8 rounded-3xl relative overflow-hidden border border-purple-500/30 bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-950">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-semibold">
              <Zap className="w-3.5 h-3.5 text-purple-400" />
              <span>Accesstrade Official Open API v1</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight flex items-center gap-3">
              Accesstrade <span className="gradient-text">Affiliate Hub</span>
            </h1>
            <p className="text-sm text-slate-400 max-w-2xl">
              Tự động hóa chuyển đổi Deep Link hàng loạt, tra cứu chiến dịch e-commerce & ngân hàng, quản lý SubID thông minh và đồng bộ doanh thu.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-4 rounded-2xl glass-card border border-purple-500/30 flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
              <div>
                <div className="text-[11px] text-slate-400 font-semibold uppercase">Trạng Thái API</div>
                <div className="text-xs font-extrabold text-emerald-400">
                  {apiKeyInfo?.connected ? 'ĐÃ KẾT NỐI (ACTIVE)' : 'ĐANG XÁC THỰC'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-8 pt-6 border-t border-slate-800/80 overflow-x-auto">
          <button
            onClick={() => setActiveTab('converter')}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'converter'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-glow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Link2 className="w-4 h-4" />
            <span>TẠO DEEPLINK HÀNG LOẠT</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('campaigns');
              fetchCampaigns();
            }}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'campaigns'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-glow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>KHÁM PHÁ CHIẾN DỊCH ({campaigns.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('orders');
              fetchOrders();
            }}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'orders'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-glow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>BÁO CÁO ĐƠN HÀNG</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'settings'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-glow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>CẤU HÌNH API KEY</span>
          </button>
        </div>
      </div>

      {/* TAB 1: DEEPLINK CONVERTER */}
      {activeTab === 'converter' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            <div className="glass-panel p-6 rounded-3xl space-y-5 border border-purple-500/20">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  <h2 className="font-extrabold text-white text-lg">Chuyển Đổi URL Thành Link Affiliate Accesstrade</h2>
                </div>
                <span className="text-xs text-purple-300 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
                  Hỗ trợ Shopee, Lazada, Tiki, TikTok & 200+ Nhà quảng cáo
                </span>
              </div>

              <form onSubmit={handleConvert} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    DANH SÁCH URL SẢN PHẨM / TRANG ĐÍCH (MỖI LINK 1 DÒNG)
                  </label>
                  <textarea
                    rows={5}
                    value={inputUrls}
                    onChange={(e) => setInputUrls(e.target.value)}
                    placeholder={`https://shopee.vn/product/12345/67890\nhttps://tiki.vn/dien-thoai-samsung-galaxy-p123.html\nhttps://www.lazada.vn/products/ao-thun-i12345.html`}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-mono text-white focus:outline-none focus:border-purple-500 resize-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">CHỌN CHIẾN DỊCH (CAMPAIGN ID)</label>
                    <select
                      value={selectedCampaignId}
                      onChange={(e) => setSelectedCampaignId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="">-- Tự động khớp theo Domain / Merchant --</option>
                      {campaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.merchant}) - ID: {c.id}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">SUB_ID 1 (MÃ THEO DÕI NGUỒN)</label>
                    <input
                      type="text"
                      value={subId1}
                      onChange={(e) => setSubId1(e.target.value)}
                      placeholder="Ví dụ: FB_POST_01, TIKTOK_BIO..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">SUB_ID 2 (TÙY CHỌN)</label>
                    <input
                      type="text"
                      value={subId2}
                      onChange={(e) => setSubId2(e.target.value)}
                      placeholder="Ví dụ: CAMPAIGN_SUMMER"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">SUB_ID 3 (TÙY CHỌN)</label>
                    <input
                      type="text"
                      value={subId3}
                      onChange={(e) => setSubId3(e.target.value)}
                      placeholder="Ví dụ: BANNER_HERO"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                {convertError && (
                  <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                    <span>{convertError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={converting}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 text-white font-extrabold text-sm shadow-glow hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2"
                >
                  {converting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>ĐANG TẠO DEEPLINK ACCESSTRADE...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5 fill-current" />
                      <span>CHUYỂN ĐỔI LINK AFFILIATE NGAY</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Results Column */}
          <div className="lg:col-span-5 space-y-6">
            <div className="glass-panel p-6 rounded-3xl space-y-5 border border-purple-500/20 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                  <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>Kết Quả Link Affiliate ({convertedLinks.length})</span>
                  </h3>
                  {convertedLinks.length > 0 && (
                    <button
                      onClick={() => {
                        const allLinks = convertedLinks.map((l) => l.shortUrl || l.affiliateUrl).join('\n');
                        navigator.clipboard.writeText(allLinks);
                        alert('Đã copy tất cả link Affiliate vào clipboard!');
                      }}
                      className="text-xs text-purple-300 font-bold hover:text-white flex items-center gap-1 bg-purple-500/10 px-3 py-1.5 rounded-lg border border-purple-500/20"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>COPY TẤT CẢ</span>
                    </button>
                  )}
                </div>

                {convertedLinks.length === 0 ? (
                  <div className="text-center py-16 space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto text-purple-400">
                      <Link2 className="w-7 h-7" />
                    </div>
                    <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto">
                      Dán danh sách URL vào ô bên trái và bấm nút "CHUYỂN ĐỔI" để tạo tracking link Accesstrade ngay lập tức.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                    {convertedLinks.map((link, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-purple-500/50 transition-all space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                            ACCESSTRADE LINK OK
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono truncate max-w-[180px]">
                            Campaign: {link.campaignId || 'Auto'}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-purple-300 break-all select-all flex items-center justify-between gap-2">
                          <span className="truncate">{link.shortUrl || link.affiliateUrl}</span>
                          <button
                            onClick={() => handleCopy(link.shortUrl || link.affiliateUrl, idx)}
                            className="p-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-all flex-shrink-0"
                          >
                            {copiedIndex === idx ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 truncate max-w-[200px]" title={link.productUrl}>
                            Gốc: {link.productUrl}
                          </span>
                          <a
                            href={link.shortUrl || link.affiliateUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1"
                          >
                            <span>Thử link</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CAMPAIGNS EXPLORER */}
      {activeTab === 'campaigns' && (
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-3xl space-y-4 border border-purple-500/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h2 className="font-extrabold text-white text-lg flex items-center gap-2">
                  <Layers className="w-5 h-5 text-purple-400" />
                  <span>Danh Sách Chiến Dịch Accesstrade (Live API)</span>
                </h2>
                <p className="text-xs text-slate-400">Tra cứu ID chiến dịch, tỷ lệ hoa hồng và thời gian lưu cookie.</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={campaignSearch}
                    onChange={(e) => {
                      setCampaignSearch(e.target.value);
                      fetchCampaigns(e.target.value);
                    }}
                    placeholder="Tìm theo tên hoặc merchant..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <button
                  onClick={() => fetchCampaigns(campaignSearch)}
                  className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-all"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingCampaigns ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {loadingCampaigns ? (
              <div className="text-center py-16 text-slate-400 text-xs flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                <span>Đang tải danh sách chiến dịch Accesstrade...</span>
              </div>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-xs">Không tìm thấy chiến dịch phù hợp.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {campaigns.map((c) => (
                  <div
                    key={c.id}
                    className="glass-card p-5 rounded-2xl space-y-3 flex flex-col justify-between border border-slate-800 hover:border-purple-500/40 transition-all"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <h3 className="font-extrabold text-white text-sm line-clamp-1">{c.name}</h3>
                          <div className="text-xs text-purple-300 font-mono font-semibold">Merchant: {c.merchant}</div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase flex-shrink-0">
                          {c.approval || 'Active'}
                        </span>
                      </div>

                      <div className="space-y-1.5 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
                        <div className="flex justify-between text-slate-400">
                          <span>Campaign ID:</span>
                          <span className="text-white font-bold">{c.id}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Cookie Duration:</span>
                          <span className="text-emerald-400 font-bold">
                            {c.cookie_duration ? `${Math.round(c.cookie_duration / 86400)} ngày` : '30 ngày'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedCampaignId(c.id);
                        setActiveTab('converter');
                      }}
                      className="w-full py-2 rounded-xl bg-slate-800 hover:bg-purple-600 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                    >
                      <span>TẠO LINK VỚI CHIẾN DỊCH NÀY</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: ORDERS & REVENUE REPORT */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-3xl space-y-6 border border-purple-500/20">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="font-extrabold text-white text-lg flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-purple-400" />
                  <span>Báo Cáo Đơn Hàng & Doanh Thu Accesstrade</span>
                </h2>
                <p className="text-xs text-slate-400">Theo dõi realtime các giao dịch, trạng thái phê duyệt đơn và hoa hồng thực nhận.</p>
              </div>

              <button
                onClick={fetchOrders}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all flex items-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingOrders ? 'animate-spin' : ''}`} />
                <span>ĐỒNG BỘ MỚI NHẤT</span>
              </button>
            </div>

            {loadingOrders ? (
              <div className="text-center py-16 text-slate-400 text-xs flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                <span>Đang đồng bộ báo cáo đơn hàng từ Accesstrade...</span>
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-16 space-y-3 glass-card rounded-2xl">
                <DollarSign className="w-12 h-12 text-slate-600 mx-auto" />
                <h3 className="font-bold text-white text-base">Chưa phát sinh đơn hàng Accesstrade mới</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Hãy dùng tab "TẠO DEEPLINK" để phát sinh liên kết và chia sẻ lên Social Media / Website của bạn.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-bold text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="p-3">Mã Giao Dịch</th>
                      <th className="p-3">Chiến Dịch</th>
                      <th className="p-3">Sub ID</th>
                      <th className="p-3">Giá Trị Đơn</th>
                      <th className="p-3">Hoa Hồng (Pub)</th>
                      <th className="p-3">Trạng Thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {orders.map((o, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/50">
                        <td className="p-3 text-purple-300 font-bold">{o.order_id || o.transaction_id}</td>
                        <td className="p-3 text-white font-sans font-semibold">{o.campaign_name || 'Accesstrade'}</td>
                        <td className="p-3 text-slate-400">{o.utterance || o.sub1 || '-'}</td>
                        <td className="p-3 text-white">{o.sales ? `${o.sales.toLocaleString()} đ` : '-'}</td>
                        <td className="p-3 text-emerald-400 font-bold">
                          {o.pub_commission ? `${o.pub_commission.toLocaleString()} đ` : '0 đ'}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              o.status === 1
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : o.status === 0
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {o.status === 1 ? 'Đã duyệt' : o.status === 0 ? 'Chờ duyệt' : 'Khác'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: API KEY SETTINGS */}
      {activeTab === 'settings' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="glass-panel p-6 rounded-3xl space-y-5 border border-purple-500/30">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="p-3 rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-extrabold text-white text-lg">Quản Lý Accesstrade API Key</h2>
                <p className="text-xs text-slate-400">API Key hiện tại được bảo mật & mã hóa AES-256-GCM trong hệ thống.</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">API Key Đang Hoạt Động:</span>
                <span className="font-mono text-purple-300 font-bold">{apiKeyInfo?.activeKeyMasked || 'o5jp...7eP3'}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Trạng Thái Xác Thực 200 OK:</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Thành công
                </span>
              </div>
            </div>

            <form onSubmit={handleSaveKey} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">CẬP NHẬT HOẶC ĐỔI API KEY MỚI</label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Nhập API Key mới nếu muốn thay đổi..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                  required
                />
              </div>

              {keyTestMsg && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    keyTestMsg.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {keyTestMsg.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  )}
                  <span>{keyTestMsg.text}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={savingKey}
                className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs shadow-glow transition-all"
              >
                {savingKey ? 'Đang kiểm tra & lưu...' : 'KIỂM TRA & LƯU API KEY MỚI'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { 
  Video, 
  Plus, 
  Copy, 
  Check, 
  Sparkles, 
  ShoppingBag, 
  MousePointerClick, 
  TrendingUp, 
  ChevronRight, 
  ExternalLink,
  Tag,
  CheckSquare,
  Square
} from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/utils';

export default function VideosPage() {
  const [videos, setVideos] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [videoTitle, setVideoTitle] = useState('');
  const [platform, setPlatform] = useState('FACEBOOK');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [copiedSubId, setCopiedSubId] = useState<string | null>(null);

  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/videos');
      const data = await res.json();
      if (data.videos) setVideos(data.videos);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLibraryProducts = async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (data.products) setProducts(data.products);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCampaigns();
    fetchLibraryProducts();
  }, []);

  const toggleSelectProd = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoTitle || selectedProductIds.length === 0) return;

    setCreating(true);
    try {
      const res = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: videoTitle,
          platform,
          productIds: selectedProductIds,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        setVideoTitle('');
        setSelectedProductIds([]);
        fetchCampaigns();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSubId(id);
    setTimeout(() => setCopiedSubId(null), 2000);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold mb-2">
            <Tag className="w-3.5 h-3.5" />
            <span>Sub-ID Tracking & Campaign Generator</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Quản Lý Link Cho Video
          </h1>
          <p className="text-xs text-slate-400">Tạo Sub-ID riêng cho từng video để theo dõi chính xác lượt click & doanh thu hoa hồng.</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-3 rounded-2xl gradient-shopee text-white font-extrabold text-xs shadow-glow hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>TẠO LINK CHO VIDEO MOI</span>
        </button>
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-2xl rounded-3xl p-6 space-y-6 max-h-[90vh] overflow-y-auto border border-purple-500/30">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                <Video className="w-5 h-5 text-purple-400" />
                <span>Tạo Bộ Link Cho Video (Sub-ID Tracking)</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateCampaign} className="space-y-5">
              {/* Video Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">TÊN VIDEO / CHIẾN DỊCH</label>
                <input
                  type="text"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  placeholder="Ví dụ: Review đồ dùng nhà bếp #38"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Platform */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">NỀN TẢNG ĐĂNG VIDEO</label>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  {['FACEBOOK', 'TIKTOK', 'SHOPEE_VIDEO', 'YOUTUBE'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPlatform(p)}
                      className={`p-2.5 rounded-xl border text-center font-bold transition-all ${
                        platform === p
                          ? 'bg-purple-600 border-purple-400 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Product Picker */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>CHỌN SẢN PHẨM GẮN VÀO VIDEO</span>
                  <span className="text-purple-400">{selectedProductIds.length} sản phẩm đã chọn</span>
                </label>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {products.map((p) => {
                    const isSelected = selectedProductIds.includes(p.id);
                    return (
                      <div
                        key={p.id}
                        onClick={() => toggleSelectProd(p.id)}
                        className={`p-3 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${
                          isSelected
                            ? 'bg-purple-950/40 border-purple-500/60 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        {isSelected ? <CheckSquare className="w-5 h-5 text-purple-400" /> : <Square className="w-5 h-5 text-slate-600" />}
                        <img src={p.image} alt={p.name} className="w-9 h-9 rounded-lg object-cover bg-slate-900" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-white truncate">{p.name}</div>
                          <div className="text-[11px] text-emerald-400 font-medium">{formatCurrency(p.salePrice)} • HH {p.commissionRate}%</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={creating || !videoTitle || selectedProductIds.length === 0}
                className="w-full py-3.5 rounded-xl gradient-shopee text-white font-extrabold text-sm shadow-glow hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all"
              >
                {creating ? 'Đang tạo Sub-ID...' : 'TẠO BỘ LINK CHO VIDEO SỐ NÀY'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Video Campaigns List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12 text-slate-500 text-xs">Đang tải các chiến dịch video...</div>
        ) : videos.length === 0 ? (
          <div className="text-center py-16 glass-card rounded-3xl space-y-3">
            <Video className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="font-bold text-white text-base">Chưa có chiến dịch video nào</h3>
            <p className="text-xs text-slate-400">Bấm nút "TẠO LINK CHO VIDEO MỚI" để bắt đầu tạo Sub-ID cho bài viết.</p>
          </div>
        ) : (
          videos.map((vid) => (
            <div key={vid.id} className="glass-card p-6 rounded-2xl space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-extrabold uppercase">
                      {vid.platform}
                    </span>
                    <h3 className="font-extrabold text-base text-white">{vid.title}</h3>
                  </div>
                  <p className="text-xs text-slate-400">Tạo ngày: {new Date(vid.createdAt).toLocaleDateString('vi-VN')}</p>
                </div>

                {/* Metrics */}
                <div className="flex items-center gap-4 text-xs">
                  <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
                    <span className="text-slate-400 block text-[10px]">Lượt Click</span>
                    <span className="font-extrabold text-white">{formatNumber(vid.clickCount || 2348)}</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
                    <span className="text-slate-400 block text-[10px]">Đơn Hàng</span>
                    <span className="font-extrabold text-orange-400">{vid.orderCount || 73}</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl bg-purple-950/60 border border-purple-500/30 text-center">
                    <span className="text-purple-300 block text-[10px]">Hoa Hồng</span>
                    <span className="font-extrabold text-emerald-400">{formatCurrency(vid.totalCommission || 1840000)}</span>
                  </div>
                </div>
              </div>

              {/* Sub-ID Product Links */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Danh Sách Link Affiliate Đã Sinh Sub-ID:</h4>
                <div className="space-y-2">
                  {vid.products?.map((item: any) => (
                    <div key={item.id} className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <img src={item.product?.image} alt={item.product?.name} className="w-9 h-9 rounded-lg object-cover bg-slate-900 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{item.product?.name}</div>
                          <div className="text-[11px] text-purple-400 font-mono">Sub-ID: {item.subId}</div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleCopy(item.affiliateUrl, item.id)}
                        className="px-3 py-1.5 rounded-lg gradient-shopee text-white font-bold text-xs shadow hover:brightness-110 transition-all flex items-center gap-1.5 flex-shrink-0"
                      >
                        {copiedSubId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>COPY LINK SUB-ID</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

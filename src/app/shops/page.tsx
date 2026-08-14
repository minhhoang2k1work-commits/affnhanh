'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Store, RefreshCw, Trash2, ExternalLink, CheckCircle2, PauseCircle, Loader2, ArrowRight } from 'lucide-react';

export default function ShopsPage() {
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const fetchShops = async () => {
    try {
      const res = await fetch('/api/shops');
      const data = await res.json();
      if (data.shops) setShops(data.shops);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShops();
  }, []);

  const handleToggleAutoSync = async (shopId: string, current: boolean) => {
    try {
      await fetch('/api/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'TOGGLE_AUTO_SYNC', shopId, isAutoSync: !current }),
      });
      fetchShops();
    } catch (err) {
      console.error(err);
    }
  };

  // Section 24: Incremental Sync Shop
  const handleSyncNow = async (shopId: string) => {
    setSyncingId(shopId);
    try {
      await fetch(`/api/shops/${shopId}/sync`, {
        method: 'POST',
      });
      fetchShops();
    } catch (err) {
      console.error(err);
    } finally {
      setSyncingId(null);
    }
  };

  const handleDeleteShop = async (shopId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa shop này khỏi danh sách theo dõi?')) return;
    try {
      await fetch('/api/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DELETE', shopId }),
      });
      fetchShops();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Store className="w-7 h-7 text-purple-400" />
            <span>Quản Lý Shop Đang Theo Dõi</span>
          </h1>
          <p className="text-xs text-slate-400">Tự động kiểm tra sản phẩm mới, cập nhật giá, hoa hồng và trạng thái tồn kho.</p>
        </div>

        <Link
          href="/scanner"
          className="px-5 py-2.5 rounded-xl gradient-shopee text-white font-bold text-xs shadow-glow hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
        >
          <Store className="w-4 h-4" />
          <span>THÊM SHOP MOI</span>
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 text-xs">Đang tải danh sách Shop...</div>
      ) : shops.length === 0 ? (
        <div className="text-center py-16 glass-card rounded-3xl space-y-3">
          <Store className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="font-bold text-white text-base">Chưa theo dõi shop nào</h3>
          <p className="text-xs text-slate-400">Hãy dán link shop đầu tiên để bắt đầu tự động hóa Affiliate link.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {shops.map((shop) => (
            <div key={shop.id} className="glass-card p-6 rounded-2xl space-y-5 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src={shop.logo || 'https://images.unsplash.com/photo-1534452203293-494d7ddbf7e0?w=100'} alt={shop.name} className="w-12 h-12 rounded-xl object-cover bg-slate-900 border border-slate-800" />
                    <div>
                      <h3 className="font-bold text-white text-base line-clamp-1">{shop.name}</h3>
                      <div className="flex items-center gap-1.5 text-[11px] mt-0.5">
                        <span className={`px-1.5 py-0.5 rounded-md font-bold text-[10px] ${
                          shop.platform === 'TIKTOK'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            : 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                        }`}>
                          {shop.platform === 'TIKTOK' ? '🎵 TikTok' : '🛒 Shopee'}
                        </span>
                        <span className="text-slate-400">ID: {shop.externalShopId}</span>
                        {shop.shopUrl && (
                          <a href={shop.shopUrl} target="_blank" rel="noopener noreferrer" className="ml-1 text-slate-400 hover:text-white transition-colors" title="Mở Link Shop gốc">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Tổng Sản Phẩm</span>
                    <span className="font-bold text-white">{shop.productCount}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Có Affiliate</span>
                    <span className="font-bold text-emerald-400">{shop.affProductCount}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    {shop.isAutoSync ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <PauseCircle className="w-4 h-4 text-slate-500" />}
                    <span className="text-slate-300 font-medium">Tự động đồng bộ</span>
                  </div>
                  <button
                    onClick={() => handleToggleAutoSync(shop.id, shop.isAutoSync)}
                    className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all ${
                      shop.isAutoSync ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {shop.isAutoSync ? 'Đang Bật' : 'Tạm Dừng'}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2 text-xs">
                <button
                  onClick={() => handleSyncNow(shop.id)}
                  disabled={syncingId === shop.id}
                  className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all flex items-center gap-1.5"
                >
                  {syncingId === shop.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  <span>ĐỒNG BỘ</span>
                </button>

                <Link
                  href={`/library?q=${encodeURIComponent(shop.name)}`}
                  className="p-2 rounded-xl bg-slate-900 text-slate-300 hover:text-white border border-slate-800 transition-all flex items-center gap-1 text-[11px]"
                  title="Xem sản phẩm"
                >
                  <span>XEM SẢN PHẨM</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>

                <button
                  onClick={() => handleDeleteShop(shop.id)}
                  className="p-2 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white border border-rose-500/20 transition-all"
                  title="Xóa Shop"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

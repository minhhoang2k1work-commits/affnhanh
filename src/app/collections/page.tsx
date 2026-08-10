'use client';

import React, { useEffect, useState } from 'react';
import { FolderHeart, Plus, Folder, ShoppingBag, Copy, FileSpreadsheet, Sparkles, Check } from 'lucide-react';

export default function CollectionsPage() {
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const fetchCollections = async () => {
    try {
      const res = await fetch('/api/collections');
      const data = await res.json();
      if (data.collections) setCollections(data.collections);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollections();
  }, []);

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        setName('');
        setDescription('');
        fetchCollections();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <FolderHeart className="w-7 h-7 text-purple-400" />
            <span>Bộ Sưu Tập (Collections)</span>
          </h1>
          <p className="text-xs text-slate-400">Phân loại sản phẩm theo chủ đề (Đồ gia dụng, Mẹ & Bé, Viral, Nổi bật...)</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-2.5 rounded-xl gradient-shopee text-white font-bold text-xs shadow-glow hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>TẠO BỘ SƯU TẬP MOI</span>
        </button>
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-3xl p-6 space-y-5 border border-purple-500/30">
            <h3 className="font-extrabold text-lg text-white">Tạo Bộ Sưu Tập Mới</h3>
            <form onSubmit={handleCreateCollection} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">TÊN BỘ SƯU TẬP</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Đồ Gia Dụng Thông Minh"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">MÔ TẢ NGẮN</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mô tả về bộ sưu tập..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-xs text-slate-400">Hủy</button>
                <button type="submit" className="px-5 py-2.5 rounded-xl gradient-shopee text-white font-bold text-xs shadow-glow">TẠO</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="text-center py-12 text-slate-500 text-xs">Đang tải bộ sưu tập...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Default Preset Collections if empty */}
          {[
            { name: "Đồ Gia Dụng Thông Minh", desc: "Các sản phẩm tiện ích nhà bếp & dọn dẹp", count: 42, icon: "🏠" },
            { name: "Sản Phẩm Commission >15%", desc: "Top hoa hồng cao nhất hỗ trợ tối đa doanh thu", count: 18, icon: "⚡" },
            { name: "Đồ Mẹ & Bé Hot Trend", desc: "Đèn chống cận, đồ chơi thông minh cho trẻ", count: 25, icon: "🧸" },
            ...collections,
          ].map((col, idx) => (
            <div key={idx} className="glass-card p-6 rounded-2xl space-y-4 hover:border-purple-500/50 transition-all">
              <div className="flex items-center justify-between">
                <div className="text-3xl">{col.icon || '📁'}</div>
                <span className="px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 font-extrabold text-xs">
                  {col.count || col.products?.length || 0} Sản phẩm
                </span>
              </div>

              <div>
                <h3 className="font-bold text-white text-base">{col.name}</h3>
                <p className="text-xs text-slate-400">{col.desc || col.description || 'Bộ sưu tập cá nhân'}</p>
              </div>

              <div className="pt-2 flex items-center justify-between text-xs text-purple-400 font-semibold cursor-pointer hover:underline">
                <span>Xem danh sách sản phẩm</span>
                <span>→</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

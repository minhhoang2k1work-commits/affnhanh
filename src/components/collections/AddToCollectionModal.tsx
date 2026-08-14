'use client';

import React, { useState, useEffect } from 'react';
import { FolderPlus, Plus, Check, Folder, Sparkles, X, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CollectionSummary {
  id: string;
  name: string;
  description?: string | null;
  icon?: string;
  totalProducts: number;
}

interface AddToCollectionModalProps {
  isOpen: boolean;
  productIds: string[];
  productNames?: string[];
  onClose: () => void;
  onSuccess?: (collectionName: string) => void;
}

const PRESET_ICONS = ['📁', '🏠', '👶', '👗', '📱', '💄', '🔥', '🎁', '⭐', '🚀', '🥗', '👟'];

export function AddToCollectionModal({
  isOpen,
  productIds,
  productNames = [],
  onClose,
  onSuccess,
}: AddToCollectionModalProps) {
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  // New Collection Form inline
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newIcon, setNewIcon] = useState('📁');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchCollections();
      setIsCreatingNew(false);
      setNewName('');
      setNewDesc('');
      setErrorMsg(null);
    }
  }, [isOpen]);

  const fetchCollections = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/collections');
      const data = await res.json();
      if (data.collections) {
        setCollections(data.collections);
        if (data.collections.length > 0 && !selectedCollectionId) {
          setSelectedCollectionId(data.collections[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToExisting = async () => {
    if (!selectedCollectionId) {
      setErrorMsg('Vui lòng chọn một bộ sưu tập');
      return;
    }
    if (productIds.length === 0) {
      setErrorMsg('Không có sản phẩm nào được chọn');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/collections/${selectedCollectionId}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds }),
      });
      const data = await res.json();
      if (data.success) {
        const targetCol = collections.find((c) => c.id === selectedCollectionId);
        onSuccess?.(targetCol?.name || 'Bộ sưu tập');
        onClose();
      } else {
        setErrorMsg(data.error || 'Không thể thêm sản phẩm');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Có lỗi xảy ra');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setErrorMsg('Vui lòng nhập tên bộ sưu tập');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDesc.trim(),
          icon: newIcon,
          productIds,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onSuccess?.(newName.trim());
        onClose();
      } else {
        setErrorMsg(data.error || 'Không thể tạo bộ sưu tập');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Có lỗi xảy ra');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-lg bg-slate-900 border border-purple-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">Thêm Vào Bộ Sưu Tập</h2>
              <p className="text-xs text-slate-400">
                Đang chọn <span className="text-purple-300 font-bold">{productIds.length} sản phẩm</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error notification */}
        {errorMsg && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {/* Toggle between existing collection vs create new */}
          <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => setIsCreatingNew(false)}
              className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                !isCreatingNew
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Folder className="w-4 h-4" />
              <span>Bộ sưu tập đã có ({collections.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCreatingNew(true)}
              className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                isCreatingNew
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Tạo bộ sưu tập mới</span>
            </button>
          </div>

          {!isCreatingNew ? (
            /* Existing Collections List */
            loading ? (
              <div className="py-12 text-center text-slate-500 text-xs animate-pulse">
                Đang tải danh sách bộ sưu tập...
              </div>
            ) : collections.length === 0 ? (
              <div className="py-10 text-center space-y-3 bg-slate-950/40 rounded-2xl border border-dashed border-slate-800 p-4">
                <Folder className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">Bạn chưa có bộ sưu tập nào.</p>
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(true)}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all"
                >
                  Tạo Bộ Sưu Tập Đầu Tiên
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                {collections.map((col) => {
                  const isSelected = selectedCollectionId === col.id;
                  return (
                    <div
                      key={col.id}
                      onClick={() => setSelectedCollectionId(col.id)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-purple-600/20 border-purple-500 text-white shadow-glow'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="text-2xl flex-shrink-0">{col.icon || '📁'}</div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs sm:text-sm truncate text-white">
                            {col.name}
                          </h4>
                          <p className="text-[11px] text-slate-400 truncate">
                            {col.description || 'Bộ sưu tập cá nhân'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                          {col.totalProducts || 0} SP
                        </span>
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                            isSelected
                              ? 'bg-purple-600 border-purple-500 text-white'
                              : 'border-slate-700 bg-slate-900'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* Create New Form */
            <form onSubmit={handleCreateAndAdd} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">TÊN BỘ SƯU TẬP *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="VD: Đồ Gia Dụng Thông Minh, Mẹ & Bé Viral..."
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">MÔ TẢ NGẮN (TÙY CHỌN)</label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Mô tả danh mục, mục đích sử dụng..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">CHỌN BIỂU TƯỢNG (ICON)</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_ICONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setNewIcon(emoji)}
                      className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center border transition-all ${
                        newIcon === emoji
                          ? 'bg-purple-600/30 border-purple-500 scale-110 shadow'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            Hủy
          </button>

          {!isCreatingNew ? (
            <button
              type="button"
              disabled={submitting || collections.length === 0 || !selectedCollectionId}
              onClick={handleAddToExisting}
              className="px-6 py-2.5 rounded-xl gradient-shopee text-white font-bold text-xs shadow-glow hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>{submitting ? 'ĐANG THÊM...' : 'XÁC NHẬN THÊM'}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting || !newName.trim()}
              onClick={handleCreateAndAdd}
              className="px-6 py-2.5 rounded-xl gradient-shopee text-white font-bold text-xs shadow-glow hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>{submitting ? 'ĐANG TẠO & THÊM...' : 'TẠO & THÊM SẢN PHẨM'}</span>
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

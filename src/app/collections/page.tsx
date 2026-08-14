'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FolderHeart,
  Plus,
  Folder,
  ShoppingBag,
  Sparkles,
  Search,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  Edit3,
  FileSpreadsheet,
  Zap,
  ArrowLeft,
  Filter,
  Flame,
  LayoutGrid,
  Table,
  CheckCircle2,
  Package,
  TrendingUp,
  Video,
  Play,
  RotateCcw,
  SlidersHorizontal,
  DollarSign,
  Share2,
  X,
  Store,
  ChevronRight,
  Clock,
  Layers,
  Coins
} from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const PRESET_ICONS = ['📁', '🏠', '👶', '👗', '📱', '💄', '🔥', '🎁', '⭐', '🚀', '🥗', '👟', '🍳', '🛋️', '🎒'];

const QUICK_PRESETS = [
  { name: 'Đồ Gia Dụng Thông Minh', icon: '🏠', desc: 'Sản phẩm tiện ích gia đình, nhà bếp, dọn dẹp' },
  { name: 'Mẹ & Bé Viral', icon: '👶', desc: 'Bình sữa, tã bỉm, đồ chơi thông minh và phụ kiện bé' },
  { name: 'Thời Trang & Phụ Kiện Trending', icon: '👗', desc: 'Quần áo, giày dép, túi xách hot trend TikTok/Shopee' },
  { name: 'Đồ Công Nghệ & Tiện Ích', icon: '📱', desc: 'Tai nghe, sạc cáp, phụ kiện máy tính, gia dụng công nghệ' },
  { name: 'Mỹ Phẩm & Skincare', icon: '💄', desc: 'Kem chống nắng, serum dưỡng da, son môi chính hãng' },
  { name: 'Săn Sale Shopee Siêu Rẻ', icon: '🔥', desc: 'Sản phẩm giảm giá sâu, freeship, đơn vị hoa hồng cao' },
];

export default function CollectionsPage() {
  const router = useRouter();

  // Collections state
  const [collections, setCollections] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalCollections: 0,
    totalCategorizedProducts: 0,
    totalPotentialCommission: 0,
    totalReadyLinks: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Active collection detail view
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [activeCollectionData, setActiveCollectionData] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailSearch, setDetailSearch] = useState('');
  const [detailSort, setDetailSort] = useState('score');
  const [detailViewMode, setDetailViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createIcon, setCreateIcon] = useState('📁');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editColId, setEditColId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editIcon, setEditIcon] = useState('📁');

  // Add products to collection picker modal
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerProducts, setPickerProducts] = useState<any[]>([]);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSelectedIds, setPickerSelectedIds] = useState<string[]>([]);

  // Toast & Action States
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Fetch all collections
  const fetchCollections = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/collections');
      const data = await res.json();
      if (data.collections) {
        setCollections(data.collections);
      }
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Error fetching collections:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollections();
  }, []);

  // Fetch single collection detail when activeCollectionId changes
  const fetchCollectionDetail = async (id: string) => {
    try {
      setLoadingDetail(true);
      const res = await fetch(`/api/collections/${id}`);
      const data = await res.json();
      if (data.collection) {
        setActiveCollectionData(data.collection);
        setSelectedProductIds([]);
      } else {
        showToast(data.error || 'Không tìm thấy bộ sưu tập');
        setActiveCollectionId(null);
      }
    } catch (err) {
      console.error('Error fetching collection detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (activeCollectionId) {
      fetchCollectionDetail(activeCollectionId);
    } else {
      setActiveCollectionData(null);
    }
  }, [activeCollectionId]);

  // Create new Collection
  const handleCreateCollection = async (e?: React.FormEvent, preset?: { name: string; icon: string; desc: string }) => {
    if (e) e.preventDefault();
    const targetName = preset ? preset.name : createName.trim();
    const targetDesc = preset ? preset.desc : createDesc.trim();
    const targetIcon = preset ? preset.icon : createIcon;

    if (!targetName) {
      showToast('Vui lòng nhập tên bộ sưu tập');
      return;
    }

    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: targetName,
          description: targetDesc,
          icon: targetIcon,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Đã tạo bộ sưu tập "${targetName}"!`);
        setIsCreateModalOpen(false);
        setCreateName('');
        setCreateDesc('');
        setCreateIcon('📁');
        fetchCollections();
      } else {
        showToast(data.error || 'Lỗi khi tạo bộ sưu tập');
      }
    } catch (err) {
      showToast('Có lỗi xảy ra khi tạo bộ sưu tập');
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (col: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditColId(col.id);
    setEditName(col.name);
    setEditDesc(col.description || '');
    setEditIcon(col.icon || '📁');
    setIsEditModalOpen(true);
  };

  // Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editColId || !editName.trim()) return;

    try {
      const res = await fetch(`/api/collections/${editColId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDesc.trim(),
          icon: editIcon,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Đã cập nhật bộ sưu tập!');
        setIsEditModalOpen(false);
        fetchCollections();
        if (activeCollectionId === editColId) {
          fetchCollectionDetail(editColId);
        }
      } else {
        showToast(data.error || 'Lỗi cập nhật');
      }
    } catch (err) {
      showToast('Lỗi khi cập nhật bộ sưu tập');
    }
  };

  // Delete Collection
  const handleDeleteCollection = async (id: string, name: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm(`Bạn có chắc muốn xóa bộ sưu tập "${name}"? Các sản phẩm trong kho sẽ không bị ảnh hưởng.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/collections/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Đã xóa bộ sưu tập "${name}"`);
        if (activeCollectionId === id) {
          setActiveCollectionId(null);
        }
        fetchCollections();
      } else {
        showToast(data.error || 'Lỗi khi xóa bộ sưu tập');
      }
    } catch (err) {
      showToast('Lỗi khi xóa bộ sưu tập');
    }
  };

  // Remove products from collection
  const handleRemoveProductsFromCollection = async (productIdsToRemove: string[]) => {
    if (!activeCollectionId || productIdsToRemove.length === 0) return;
    if (!confirm(`Bạn có chắc muốn gỡ ${productIdsToRemove.length} sản phẩm khỏi bộ sưu tập này?`)) return;

    try {
      const res = await fetch(`/api/collections/${activeCollectionId}/products`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: productIdsToRemove }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Đã gỡ ${productIdsToRemove.length} sản phẩm khỏi bộ sưu tập!`);
        setSelectedProductIds([]);
        fetchCollectionDetail(activeCollectionId);
        fetchCollections();
      } else {
        showToast(data.error || 'Lỗi khi gỡ sản phẩm');
      }
    } catch (err) {
      showToast('Lỗi kết nối khi gỡ sản phẩm');
    }
  };

  // 1-Click Copy Affiliate Link
  const handleCopyLink = (affUrl: string | null, origUrl: string, id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const linkToCopy = affUrl || origUrl;
    navigator.clipboard.writeText(linkToCopy);
    setCopiedId(id);
    showToast('Đã copy Affiliate Link vào Clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Copy all links from collection
  const handleCopyAllLinks = (collection: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const prods = collection.products || [];
    if (prods.length === 0) {
      showToast('Bộ sưu tập chưa có sản phẩm nào để copy link');
      return;
    }

    const formattedText = prods
      .map(
        (p: any, idx: number) =>
          `${idx + 1}. ${p.name}\n🛒 Link Shopee: ${p.affiliateUrl || p.originalUrl}\n💰 Giá KM: ${formatCurrency(p.salePrice)} (Hoa hồng: ${p.commissionRate}%)`
      )
      .join('\n\n');

    navigator.clipboard.writeText(formattedText);
    showToast(`Đã copy ${prods.length} links của BST "${collection.name}"!`);
  };

  // Export collection as Excel/CSV
  const handleExportCSV = (collection: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const prods = collection.products || [];
    if (prods.length === 0) {
      showToast('Bộ sưu tập chưa có sản phẩm nào để xuất');
      return;
    }

    const exportData = prods.map((p: any) => ({
      'Tên sản phẩm': p.name,
      'Shop': p.shop?.name || '',
      'Giá gốc (VND)': p.price,
      'Giá KM (VND)': p.salePrice,
      'Đã bán': p.sold,
      'Hoa hồng %': p.commissionRate,
      'HH dự kiến/đơn (VND)': p.estCommission || Math.round((p.salePrice * (p.commissionRate || 0)) / 100),
      'Affiliate Score': p.affiliateScore,
      'Affiliate Link': p.affiliateUrl || p.originalUrl,
      'Deep Link gốc': p.originalUrl,
    }));

    const columns = Object.keys(exportData[0]);
    const escapeCsv = (value: unknown) => {
      let text = value == null ? '' : String(value);
      if (/^[=+\-@]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const csv = [
      columns.map(escapeCsv).join(','),
      ...exportData.map((row: any) => columns.map((col: any) => escapeCsv(row[col])).join(',')),
    ].join('\r\n');

    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BST_${collection.name.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, '_')}_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`Đã xuất file Excel cho BST "${collection.name}"!`);
  };

  // Batch generate affiliate links for active collection
  const handleBatchGenerateAffiliateForCollection = async () => {
    if (!activeCollectionData || !activeCollectionData.products) return;
    setIsBatchGenerating(true);
    showToast('Đang tạo link Affiliate cho các sản phẩm...');
    try {
      const pendingIds = activeCollectionData.products
        .filter((p: any) => !p.affiliateUrl)
        .map((p: any) => p.id);

      if (pendingIds.length === 0) {
        showToast('Tất cả sản phẩm trong BST đã có Affiliate Link!');
        return;
      }

      const res = await fetch('/api/products/bulk-affiliate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: pendingIds }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Đã tạo thành công ${data.successCount} link Affiliate!`);
        fetchCollectionDetail(activeCollectionId!);
        fetchCollections();
      } else {
        showToast(data.error || 'Lỗi khi tạo link Affiliate');
      }
    } catch (err: any) {
      showToast(err?.message || 'Có lỗi xảy ra');
    } finally {
      setIsBatchGenerating(false);
    }
  };

  // Open Product Picker from Library
  const handleOpenPicker = async () => {
    setIsPickerOpen(true);
    setPickerSelectedIds([]);
    setPickerQuery('');
    setPickerLoading(true);
    try {
      const res = await fetch('/api/products?limit=50');
      const data = await res.json();
      if (data.products) {
        // Exclude products already in this collection
        const existingIds = new Set((activeCollectionData?.products || []).map((p: any) => p.id));
        setPickerProducts(data.products.filter((p: any) => !existingIds.has(p.id)));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPickerLoading(false);
    }
  };

  // Search in Product Picker
  const handleSearchPicker = async (q: string) => {
    setPickerQuery(q);
    setPickerLoading(true);
    try {
      const res = await fetch(`/api/products?q=${encodeURIComponent(q)}&limit=50`);
      const data = await res.json();
      if (data.products) {
        const existingIds = new Set((activeCollectionData?.products || []).map((p: any) => p.id));
        setPickerProducts(data.products.filter((p: any) => !existingIds.has(p.id)));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPickerLoading(false);
    }
  };

  // Confirm add products from picker to collection
  const handleAddSelectedFromPicker = async () => {
    if (!activeCollectionId || pickerSelectedIds.length === 0) return;

    try {
      const res = await fetch(`/api/collections/${activeCollectionId}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: pickerSelectedIds }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Đã thêm ${pickerSelectedIds.length} sản phẩm vào BST!`);
        setIsPickerOpen(false);
        fetchCollectionDetail(activeCollectionId);
        fetchCollections();
      } else {
        showToast(data.error || 'Lỗi khi thêm sản phẩm');
      }
    } catch (err) {
      showToast('Có lỗi xảy ra');
    }
  };

  // Filtered collections for overview
  const filteredCollections = useMemo(() => {
    if (!searchQuery.trim()) return collections;
    const q = searchQuery.toLowerCase();
    return collections.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [collections, searchQuery]);

  // Filtered & sorted products for active collection detail
  const detailFilteredProducts = useMemo(() => {
    if (!activeCollectionData || !activeCollectionData.products) return [];
    let list = [...activeCollectionData.products];

    if (detailSearch.trim()) {
      const q = detailSearch.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.shop?.name && p.shop.name.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q))
      );
    }

    if (detailSort === 'score') {
      list.sort((a, b) => (b.affiliateScore || 0) - (a.affiliateScore || 0));
    } else if (detailSort === 'commission') {
      list.sort((a, b) => (b.commissionRate || 0) - (a.commissionRate || 0));
    } else if (detailSort === 'sold') {
      list.sort((a, b) => (b.sold || 0) - (a.sold || 0));
    } else if (detailSort === 'price_asc') {
      list.sort((a, b) => a.salePrice - b.salePrice);
    } else if (detailSort === 'price_desc') {
      list.sort((a, b) => b.salePrice - a.salePrice);
    }

    return list;
  }, [activeCollectionData, detailSearch, detailSort]);

  return (
    <div className="space-y-8 pb-20">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs shadow-2xl flex items-center gap-2.5 max-w-[90vw] border border-purple-400/30"
          >
            <Sparkles className="w-4 h-4 text-amber-300 flex-shrink-0 animate-spin" />
            <span className="truncate">{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 1. OVERVIEW VIEW (DANH SÁCH BỘ SƯU TẬP) */}
      {/* ========================================================================= */}
      {!activeCollectionId ? (
        <div className="space-y-8 animate-fade-in">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center shadow-glow">
                  <FolderHeart className="w-6 h-6 text-white" />
                </div>
                <span>Bộ Sưu Tập (Collections)</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Phân loại sản phẩm theo chủ đề (Đồ gia dụng, Mẹ & Bé, Viral, Nổi bật...) để tạo link & làm video hàng loạt.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-5 py-3 rounded-2xl gradient-shopee text-white font-extrabold text-xs shadow-glow hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>TẠO BỘ SƯU TẬP MỚI</span>
              </button>
            </div>
          </div>

          {/* Top Summary Stats Banner */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card p-4 sm:p-5 rounded-2xl border border-purple-500/20 flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 font-extrabold text-xl">
                📁
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tổng Bộ Sưu Tập</div>
                <div className="text-xl sm:text-2xl font-black text-white">{stats.totalCollections}</div>
              </div>
            </div>

            <div className="glass-card p-4 sm:p-5 rounded-2xl border border-indigo-500/20 flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-extrabold text-xl">
                📦
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sản Phẩm Đã Phân Loại</div>
                <div className="text-xl sm:text-2xl font-black text-indigo-300">{stats.totalCategorizedProducts}</div>
              </div>
            </div>

            <div className="glass-card p-4 sm:p-5 rounded-2xl border border-emerald-500/20 flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 font-extrabold text-xl">
                💰
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Hoa Hồng Dự Kiến</div>
                <div className="text-xl sm:text-2xl font-black text-emerald-400">
                  {formatCurrency(stats.totalPotentialCommission || 0)}
                </div>
              </div>
            </div>

            <div className="glass-card p-4 sm:p-5 rounded-2xl border border-amber-500/20 flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300 font-extrabold text-xl">
                ⚡
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Link Đã Sẵn Sàng</div>
                <div className="text-xl sm:text-2xl font-black text-amber-400">
                  {stats.totalReadyLinks} <span className="text-xs font-normal text-slate-400">({stats.totalCategorizedProducts > 0 ? Math.round((stats.totalReadyLinks / stats.totalCategorizedProducts) * 100) : 0}%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Suggested Niches / Presets */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Gợi ý chủ đề thịnh hành (Bấm 1-click để tạo ngay):</span>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {QUICK_PRESETS.map((preset) => {
                const isExisting = collections.some((c) => c.name.toLowerCase() === preset.name.toLowerCase());
                return (
                  <button
                    key={preset.name}
                    onClick={() => {
                      if (!isExisting) {
                        handleCreateCollection(undefined, preset);
                      } else {
                        const existingCol = collections.find((c) => c.name.toLowerCase() === preset.name.toLowerCase());
                        if (existingCol) setActiveCollectionId(existingCol.id);
                      }
                    }}
                    className={`px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all flex items-center gap-2 ${
                      isExisting
                        ? 'bg-purple-950/40 border-purple-500/40 text-purple-300 hover:bg-purple-900/40'
                        : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-purple-500/50 hover:text-white'
                    }`}
                  >
                    <span>{preset.icon}</span>
                    <span>{preset.name}</span>
                    {isExisting ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/30 text-purple-200">Đã có</span>
                    ) : (
                      <Plus className="w-3 h-3 text-slate-500" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm theo tên bộ sưu tập hoặc mô tả..."
              className="w-full bg-slate-900/90 border-2 border-slate-800 rounded-2xl pl-12 pr-10 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Collections Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="glass-card p-6 rounded-3xl space-y-4 animate-pulse">
                  <div className="aspect-[16/9] rounded-2xl bg-slate-800" />
                  <div className="h-5 bg-slate-800 rounded-xl w-2/3" />
                  <div className="h-3 bg-slate-800 rounded-lg w-1/2" />
                </div>
              ))}
            </div>
          ) : filteredCollections.length === 0 ? (
            <div className="text-center py-16 glass-card rounded-3xl space-y-4 border border-dashed border-slate-800">
              <div className="w-20 h-20 rounded-full bg-purple-500/10 border border-purple-500/20 mx-auto flex items-center justify-center text-3xl">
                📁
              </div>
              <h3 className="font-extrabold text-white text-lg">Chưa có bộ sưu tập nào</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Tạo các bộ sưu tập theo ngách (Mẹ & Bé, Gia dụng, Thời trang...) để gom nhóm sản phẩm, xuất Excel và tạo video marketing tự động.
              </p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-6 py-3 rounded-2xl gradient-shopee text-white font-extrabold text-xs shadow-glow hover:brightness-110 active:scale-95 transition-all"
              >
                + TẠO BỘ SƯU TẬP ĐẦU TIÊN
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredCollections.map((col) => {
                const thumbs = col.thumbnails || [];
                return (
                  <div
                    key={col.id}
                    onClick={() => setActiveCollectionId(col.id)}
                    className="glass-card p-5 rounded-3xl space-y-4 hover:border-purple-500/50 transition-all cursor-pointer group flex flex-col justify-between relative overflow-hidden"
                  >
                    {/* Visual Collage Cover (Up to 4 images) */}
                    <div className="aspect-[16/9] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800/80 relative">
                      {thumbs.length >= 4 ? (
                        <div className="grid grid-cols-2 grid-rows-2 w-full h-full gap-0.5">
                          {thumbs.map((imgUrl: string, idx: number) => (
                            <img
                              key={idx}
                              src={imgUrl}
                              alt=""
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ))}
                        </div>
                      ) : thumbs.length > 0 ? (
                        <div className="w-full h-full relative">
                          <img
                            src={thumbs[0]}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-80"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent flex items-center justify-center">
                            <span className="text-4xl filter drop-shadow-md">{col.icon || '📁'}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950 space-y-2">
                          <span className="text-4xl">{col.icon || '📁'}</span>
                          <span className="text-[11px] text-slate-500 font-semibold">Chưa có sản phẩm nào</span>
                        </div>
                      )}

                      {/* Floating Badges */}
                      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-xl bg-slate-950/80 backdrop-blur border border-purple-500/40 text-white font-extrabold text-xs flex items-center gap-1.5 shadow">
                        <span>{col.icon || '📁'}</span>
                        <span>{col.totalProducts || 0} SP</span>
                      </div>

                      {col.totalEstimatedCommission > 0 && (
                        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-xl bg-emerald-950/80 backdrop-blur border border-emerald-500/40 text-emerald-300 font-extrabold text-[11px] shadow">
                          +{formatCurrency(col.totalEstimatedCommission)}
                        </div>
                      )}
                    </div>

                    {/* Card Info */}
                    <div className="space-y-1.5">
                      <h3 className="font-extrabold text-white text-base group-hover:text-purple-300 transition-colors flex items-center justify-between">
                        <span className="truncate">{col.name}</span>
                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:translate-x-1 group-hover:text-purple-400 transition-all flex-shrink-0" />
                      </h3>
                      <p className="text-xs text-slate-400 line-clamp-2 min-h-[32px]">
                        {col.description || 'Bộ sưu tập phân loại sản phẩm cá nhân.'}
                      </p>
                    </div>

                    {/* Quick Action Footer */}
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => handleCopyAllLinks(col, e)}
                          title="Sao chép toàn bộ Link Affiliate trong BST này"
                          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-purple-300 hover:bg-slate-800 transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleExportCSV(col, e)}
                          title="Xuất file Excel / CSV"
                          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-300 hover:bg-slate-800 transition-colors"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleOpenEdit(col, e)}
                          title="Chỉnh sửa tên & mô tả"
                          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteCollection(col.id, col.name, e)}
                          title="Xóa bộ sưu tập này"
                          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        onClick={() => setActiveCollectionId(col.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-300 font-bold text-[11px] hover:bg-purple-600 hover:text-white transition-all"
                      >
                        Xem Chi Tiết
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* 2. COLLECTION DETAIL VIEW (CHI TIẾT BỘ SƯU TẬP) */
        /* ========================================================================= */
        <div className="space-y-6 animate-fade-in">
          {/* Breadcrumb & Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => setActiveCollectionId(null)}
              className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-all flex items-center gap-2 text-xs font-bold"
            >
              <ArrowLeft className="w-4 h-4 text-purple-400" />
              <span>Quay lại danh sách Bộ Sưu Tập</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenEdit(activeCollectionData)}
                className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                <span>Sửa thông tin</span>
              </button>

              <button
                onClick={() => handleDeleteCollection(activeCollectionData.id, activeCollectionData.name)}
                className="px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500 hover:text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa BST</span>
              </button>
            </div>
          </div>

          {/* Collection Hero Card */}
          {activeCollectionData && (
            <div className="glass-card p-6 rounded-3xl border border-purple-500/30 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-3xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-4xl shadow-glow">
                    {activeCollectionData.icon || '📁'}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white">{activeCollectionData.name}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {activeCollectionData.description || 'Bộ sưu tập phân loại sản phẩm cá nhân.'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleOpenPicker}
                    className="px-4 py-2.5 rounded-xl gradient-shopee text-white font-extrabold text-xs shadow-glow hover:brightness-110 transition-all flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>THÊM SẢN PHẨM TỪ KHO</span>
                  </button>

                  <button
                    onClick={() => handleCopyAllLinks(activeCollectionData)}
                    className="px-4 py-2.5 rounded-xl bg-purple-600/30 border border-purple-500/40 text-purple-200 font-bold text-xs hover:bg-purple-600 hover:text-white transition-all flex items-center gap-1.5"
                  >
                    <Copy className="w-4 h-4" />
                    <span>COPY TOÀN BỘ LINK</span>
                  </button>

                  <button
                    onClick={() => handleExportCSV(activeCollectionData)}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-xs hover:bg-slate-700 transition-all flex items-center gap-1.5"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    <span>XUẤT EXCEL</span>
                  </button>
                </div>
              </div>

              {/* Stats & Integrations Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800">
                <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Sản phẩm trong BST</div>
                  <div className="text-lg font-black text-white">{activeCollectionData.totalProducts || 0}</div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Hoa hồng dự kiến</div>
                  <div className="text-lg font-black text-emerald-400">
                    {formatCurrency(activeCollectionData.totalEstimatedCommission || 0)}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Affiliate Link sẵn sàng</div>
                  <div className="text-lg font-black text-purple-300">
                    {activeCollectionData.readyAffiliateCount || 0} / {activeCollectionData.totalProducts || 0}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Điểm Affiliate TB</div>
                  <div className="text-lg font-black text-amber-400 flex items-center gap-1">
                    <Flame className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span>{activeCollectionData.avgScore || 0}/100</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions with Video Studio & Automation */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  {activeCollectionData.totalProducts > activeCollectionData.readyAffiliateCount && (
                    <button
                      onClick={handleBatchGenerateAffiliateForCollection}
                      disabled={isBatchGenerating}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs hover:bg-amber-500 hover:text-slate-950 transition-all flex items-center gap-1.5"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>{isBatchGenerating ? 'Đang tạo link...' : 'Tạo Affiliate Link cho BST'}</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/ai-video?collectionId=${activeCollectionData.id}`}
                    className="px-3.5 py-1.5 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-200 font-bold text-xs hover:bg-purple-600 hover:text-white transition-all flex items-center gap-1.5"
                  >
                    <Video className="w-3.5 h-3.5 text-pink-400" />
                    <span>Tạo Video AI từ BST này</span>
                  </Link>

                  <Link
                    href={`/flows?collectionId=${activeCollectionData.id}`}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-200 font-bold text-xs hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Chạy Luồng Tự Động</span>
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Search, Filter & View Controls inside collection */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={detailSearch}
                onChange={(e) => setDetailSearch(e.target.value)}
                placeholder="Tìm sản phẩm trong bộ sưu tập này..."
                className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-8 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-all"
              />
              {detailSearch && (
                <button
                  onClick={() => setDetailSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={detailSort}
                onChange={(e) => setDetailSort(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-purple-500"
              >
                <option value="score">Sắp xếp: Affiliate Score cao nhất</option>
                <option value="commission">Sắp xếp: Tỷ lệ hoa hồng cao nhất</option>
                <option value="sold">Sắp xếp: Đã bán nhiều nhất</option>
                <option value="price_asc">Sắp xếp: Giá tăng dần</option>
                <option value="price_desc">Sắp xếp: Giá giảm dần</option>
              </select>

              <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                <button
                  onClick={() => setDetailViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-all ${
                    detailViewMode === 'grid' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Dạng Lưới"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDetailViewMode('table')}
                  className={`p-1.5 rounded-lg transition-all ${
                    detailViewMode === 'table' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Dạng Bảng"
                >
                  <Table className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Bulk Selection Toolbar inside collection */}
          {selectedProductIds.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-purple-950/80 border border-purple-500/50 flex items-center justify-between text-xs text-white shadow-xl animate-fade-in">
              <div className="flex items-center gap-2.5 font-bold">
                <span className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center text-[10px]">
                  {selectedProductIds.length}
                </span>
                <span>sản phẩm đã chọn</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const selected = detailFilteredProducts.filter((p) => selectedProductIds.includes(p.id));
                    const text = selected
                      .map((p) => `${p.name}\n${p.affiliateUrl || p.originalUrl}`)
                      .join('\n\n');
                    navigator.clipboard.writeText(text);
                    showToast(`Đã copy ${selected.length} links!`);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white text-purple-950 font-extrabold text-xs shadow hover:bg-slate-100 transition-all flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>COPY LINKS</span>
                </button>

                <button
                  onClick={() => handleRemoveProductsFromCollection(selectedProductIds)}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold text-xs hover:bg-rose-500 hover:text-white transition-all flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>GỠ KHỎI BST ({selectedProductIds.length})</span>
                </button>
              </div>
            </div>
          )}

          {/* Product Items List inside collection */}
          {loadingDetail ? (
            <div className="py-20 text-center text-purple-400 animate-pulse text-xs">
              Đang tải sản phẩm trong bộ sưu tập...
            </div>
          ) : detailFilteredProducts.length === 0 ? (
            <div className="text-center py-16 glass-card rounded-3xl space-y-4 border border-dashed border-slate-800">
              <ShoppingBag className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="font-extrabold text-white text-base">Bộ sưu tập chưa có sản phẩm nào</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Bấm nút "THÊM SẢN PHẨM TỪ KHO" để chọn các sản phẩm đã quét từ Thư Viện vào bộ sưu tập này.
              </p>
              <button
                onClick={handleOpenPicker}
                className="px-5 py-2.5 rounded-2xl gradient-shopee text-white font-extrabold text-xs shadow-glow hover:brightness-110 transition-all"
              >
                + THÊM SẢN PHẨM NGAY
              </button>
            </div>
          ) : detailViewMode === 'grid' ? (
            /* Grid View inside collection */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {detailFilteredProducts.map((p) => {
                const isSelected = selectedProductIds.includes(p.id);
                return (
                  <div
                    key={p.id}
                    className="glass-card rounded-2xl overflow-hidden flex flex-col justify-between group relative border border-slate-800/80 hover:border-purple-500/40 transition-all"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        setSelectedProductIds((prev) =>
                          prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                        );
                      }}
                      className="absolute top-3 left-3 z-10 w-5 h-5 rounded border-slate-700 text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />

                    <div className="relative aspect-[4/5] overflow-hidden bg-slate-950">
                      <img
                        src={p.image}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />

                      <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur border border-amber-500/40 text-amber-300 font-extrabold text-[11px] shadow flex items-center gap-1">
                        <Flame className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span>Score: {p.affiliateScore}/100</span>
                      </div>

                      <div className="absolute bottom-3 right-3 px-2 py-1 rounded-full bg-slate-950/70 backdrop-blur border border-slate-700/50 text-white font-bold text-[10px]">
                        Đã bán {formatNumber(p.sold)}
                      </div>

                      <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-emerald-500 text-slate-950 font-black text-xs shadow-lg flex items-center gap-1">
                        <span>HH: {p.commissionRate}%</span>
                        {p.estCommission > 0 && (
                          <span className="text-[10px] opacity-80">(~{formatCurrency(p.estCommission)})</span>
                        )}
                      </div>
                    </div>

                    <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 truncate max-w-[150px]">
                            {p.shop?.name || 'Shopee Shop'}
                          </span>
                        </div>
                        <h4 className="font-bold text-white text-xs line-clamp-2 group-hover:text-purple-300 transition-colors">
                          {p.name}
                        </h4>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-800/60">
                        <div className="flex items-baseline justify-between">
                          <span className="text-base font-black text-rose-400">{formatCurrency(p.salePrice)}</span>
                          {p.price > p.salePrice && (
                            <span className="text-xs text-slate-500 line-through">{formatCurrency(p.price)}</span>
                          )}
                        </div>

                        {/* Action buttons on card */}
                        <div className="flex items-center gap-1.5 pt-1">
                          <button
                            onClick={(e) => handleCopyLink(p.affiliateUrl, p.originalUrl, p.id, e)}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow ${
                              copiedId === p.id
                                ? 'bg-emerald-600 text-white'
                                : 'gradient-shopee text-white hover:brightness-110 active:scale-95'
                            }`}
                          >
                            {copiedId === p.id ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>ĐÃ COPY</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>COPY LINK</span>
                              </>
                            )}
                          </button>

                          <a
                            href={p.originalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
                            title="Mở trên Shopee"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>

                          <button
                            onClick={() => handleRemoveProductsFromCollection([p.id])}
                            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
                            title="Gỡ khỏi bộ sưu tập này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Table View inside collection */
            <div className="glass-card rounded-2xl overflow-hidden border border-slate-800">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-[11px] uppercase font-bold text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3 text-center w-10">
                        <input
                          type="checkbox"
                          checked={
                            selectedProductIds.length > 0 &&
                            selectedProductIds.length === detailFilteredProducts.length
                          }
                          onChange={() => {
                            if (selectedProductIds.length === detailFilteredProducts.length) {
                              setSelectedProductIds([]);
                            } else {
                              setSelectedProductIds(detailFilteredProducts.map((p) => p.id));
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-700 text-purple-600 cursor-pointer"
                        />
                      </th>
                      <th className="p-3">Sản phẩm</th>
                      <th className="p-3">Giá KM</th>
                      <th className="p-3">Hoa hồng</th>
                      <th className="p-3">Đã bán</th>
                      <th className="p-3">Score</th>
                      <th className="p-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {detailFilteredProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedProductIds.includes(p.id)}
                            onChange={() => {
                              setSelectedProductIds((prev) =>
                                prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                              );
                            }}
                            className="w-4 h-4 rounded border-slate-700 text-purple-600 cursor-pointer"
                          />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <img src={p.image} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                            <div className="min-w-0 max-w-md">
                              <h5 className="font-bold text-white truncate">{p.name}</h5>
                              <span className="text-[10px] text-slate-400">{p.shop?.name || 'Shopee Shop'}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 font-bold text-rose-400">{formatCurrency(p.salePrice)}</td>
                        <td className="p-3 font-bold text-emerald-400">
                          {p.commissionRate}% {p.estCommission > 0 && `(~${formatCurrency(p.estCommission)})`}
                        </td>
                        <td className="p-3 font-semibold">{formatNumber(p.sold)}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-extrabold text-[10px]">
                            {p.affiliateScore}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={(e) => handleCopyLink(p.affiliateUrl, p.originalUrl, p.id, e)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                copiedId === p.id
                                  ? 'bg-emerald-600 text-white'
                                  : 'gradient-shopee text-white hover:brightness-110'
                              }`}
                            >
                              {copiedId === p.id ? 'Đã copy' : 'Copy'}
                            </button>
                            <a
                              href={p.originalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <button
                              onClick={() => handleRemoveProductsFromCollection([p.id])}
                              className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-rose-400"
                              title="Gỡ khỏi BST"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MODALS: CREATE, EDIT, PICK PRODUCTS */}
      {/* ========================================================================= */}

      {/* Create Collection Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel w-full max-w-md rounded-3xl p-6 space-y-5 border border-purple-500/30 bg-slate-900 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                <FolderHeart className="w-5 h-5 text-purple-400" />
                <span>Tạo Bộ Sưu Tập Mới</span>
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => handleCreateCollection(e)} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">TÊN BỘ SƯU TẬP *</label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Ví dụ: Đồ Gia Dụng Thông Minh, Mẹ & Bé..."
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500 transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">MÔ TẢ NGẮN (TÙY CHỌN)</label>
                <input
                  type="text"
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  placeholder="Mục đích hoặc tiêu chí phân loại..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300">BIỂU TƯỢNG (ICON)</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_ICONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setCreateIcon(emoji)}
                      className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center border transition-all ${
                        createIcon === emoji
                          ? 'bg-purple-600/30 border-purple-500 scale-110 shadow'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 text-xs text-slate-400 hover:text-white font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl gradient-shopee text-white font-extrabold text-xs shadow-glow hover:brightness-110"
                >
                  TẠO BỘ SƯU TẬP
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Edit Collection Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel w-full max-w-md rounded-3xl p-6 space-y-5 border border-purple-500/30 bg-slate-900 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-purple-400" />
                <span>Chỉnh Sửa Bộ Sưu Tập</span>
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">TÊN BỘ SƯU TẬP *</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500 transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">MÔ TẢ NGẮN</label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300">BIỂU TƯỢNG (ICON)</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_ICONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setEditIcon(emoji)}
                      className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center border transition-all ${
                        editIcon === emoji
                          ? 'bg-purple-600/30 border-purple-500 scale-110 shadow'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2.5 text-xs text-slate-400 hover:text-white font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl gradient-shopee text-white font-extrabold text-xs shadow-glow hover:brightness-110"
                >
                  LƯU THAY ĐỔI
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Pick Products from Library Modal */}
      {isPickerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-3xl bg-slate-900 border border-purple-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">Chọn Sản Phẩm Từ Thư Viện</h3>
                  <p className="text-xs text-slate-400">
                    Đã chọn <span className="text-purple-300 font-bold">{pickerSelectedIds.length} sản phẩm</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsPickerOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-800 bg-slate-950/40">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={pickerQuery}
                  onChange={(e) => handleSearchPicker(e.target.value)}
                  placeholder="Tìm sản phẩm theo tên, shop..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {pickerLoading ? (
                <div className="py-16 text-center text-purple-400 text-xs animate-pulse">
                  Đang tải danh sách sản phẩm...
                </div>
              ) : pickerProducts.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                  <ShoppingBag className="w-10 h-10 text-slate-600 mx-auto" />
                  <p>Không có sản phẩm nào khả dụng hoặc tất cả sản phẩm đã nằm trong bộ sưu tập này.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {pickerProducts.map((p) => {
                    const isSelected = pickerSelectedIds.includes(p.id);
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          setPickerSelectedIds((prev) =>
                            prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                          );
                        }}
                        className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
                          isSelected
                            ? 'bg-purple-600/20 border-purple-500 text-white shadow-glow'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <img src={p.image} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <h5 className="font-bold text-xs truncate text-white">{p.name}</h5>
                          <div className="flex items-center gap-2 mt-1 text-[11px]">
                            <span className="font-black text-rose-400">{formatCurrency(p.salePrice)}</span>
                            <span className="font-bold text-emerald-400">HH: {p.commissionRate}%</span>
                          </div>
                          <span className="text-[10px] text-slate-500 truncate block mt-0.5">
                            {p.shop?.name || 'Shopee Shop'}
                          </span>
                        </div>
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all flex-shrink-0 ${
                            isSelected
                              ? 'bg-purple-600 border-purple-500 text-white'
                              : 'border-slate-700 bg-slate-900'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsPickerOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={pickerSelectedIds.length === 0}
                onClick={handleAddSelectedFromPicker}
                className="px-6 py-2.5 rounded-xl gradient-shopee text-white font-extrabold text-xs shadow-glow hover:brightness-110 disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>THÊM {pickerSelectedIds.length} SẢN PHẨM VÀO BST</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

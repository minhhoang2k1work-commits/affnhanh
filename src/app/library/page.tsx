'use client';

import React, { useEffect, useState, useTransition, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  Search, 
  Filter, 
  Copy, 
  Check, 
  ExternalLink, 
  Sparkles, 
  LayoutGrid, 
  Table, 
  FolderPlus, 
  Download, 
  FileSpreadsheet, 
  Star, 
  TrendingUp, 
  Flame, 
  Zap,
  ShoppingBag,
  Store,
  Layers
} from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/utils';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

function LibraryContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [filterType, setFilterType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('score');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      let url = `/api/products?q=${encodeURIComponent(searchQuery)}&sortBy=${sortBy}`;
      if (filterType !== 'all') {
        url += `&filterType=${filterType}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.products) {
        setProducts(data.products);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [searchQuery, filterType, sortBy]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Section 5: 1-Click Copy Affiliate Link
  const handleCopyAffLink = (affUrl: string, origUrl: string, id: string) => {
    const linkToCopy = affUrl || origUrl;
    navigator.clipboard.writeText(linkToCopy);
    setCopiedId(id);
    showToast('Đã copy Affiliate Link vào Clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Section 11: Bulk Selection & Copy All
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === products.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(products.map((p) => p.id));
    }
  };

  const handleCopySelectedLinks = () => {
    const selectedProducts = products.filter((p) => selectedIds.includes(p.id));
    if (selectedProducts.length === 0) return;

    const formattedList = selectedProducts
      .map((p) => `${p.name}\n${p.affiliateUrl || p.originalUrl}`)
      .join('\n\n');

    navigator.clipboard.writeText(formattedList);
    showToast(`Đã copy ${selectedProducts.length} link Affiliate dạng danh sách!`);
  };

  const handleExportCSV = () => {
    const selectedProducts = products.filter((p) => selectedIds.includes(p.id));
    const listToExport = selectedProducts.length > 0 ? selectedProducts : products;

    const exportData = listToExport.map((p) => ({
      'Tên sản phẩm': p.name,
      'Shop': p.shop?.name || '',
      'Giá gốc (VND)': p.price,
      'Giá KM (VND)': p.salePrice,
      'Đã bán': p.sold,
      'Hoa hồng %': p.commissionRate,
      'Hoa hồng ước tính (VND)': p.estCommission,
      'Affiliate Score': p.affiliateScore,
      'Affiliate Link': p.affiliateUrl || p.originalUrl,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Affiliate Products');
    XLSX.writeFile(workbook, `Affiliate_Products_${Date.now()}.xlsx`);
    showToast('Đã xuất file Excel thành công!');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs shadow-2xl flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Page Header & Search Bar (Section 6) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Thư Viện Sản Phẩm <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 font-mono">{products.length} Items</span>
          </h1>
          <p className="text-xs text-slate-400">Tìm kiếm & quản lý tất cả sản phẩm đã import từ các Shop.</p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
              title="Dạng Lưới (Card)"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
              title="Dạng Bảng (Table)"
            >
              <Table className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm sản phẩm theo tên, shop, danh mục (bình nước, nồi chiên, son...)"
          className="w-full bg-slate-900/90 border-2 border-slate-800 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-all"
        />
      </div>

      {/* Filter Tabs & Sort Dropdown (Section 7) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${filterType === 'all' ? 'gradient-shopee text-white shadow-glow' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'}`}
          >
            Tất Cả
          </button>
          <button
            onClick={() => setFilterType('viral')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${filterType === 'viral' ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-glow' : 'bg-slate-900 border border-amber-500/30 text-amber-300 hover:bg-slate-800'}`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
            <span>SẢN PHẨM ĐÁNG LÀM VIDEO</span>
          </button>
          <button
            onClick={() => setFilterType('high_comm')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${filterType === 'high_comm' ? 'bg-purple-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'}`}
          >
            Hoa Hồng Cao (&gt;=10%)
          </button>
          <button
            onClick={() => setFilterType('top_sold')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${filterType === 'top_sold' ? 'bg-purple-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'}`}
          >
            Bán Chạy Nhất (&gt;5k)
          </button>
        </div>

        {/* Sort Select */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-purple-500"
        >
          <option value="score">Sắp xếp: Affiliate Score</option>
          <option value="commissionRate">Sắp xếp: Hoa hồng cao nhất</option>
          <option value="sold">Sắp xếp: Đã bán nhiều nhất</option>
          <option value="price_asc">Sắp xếp: Giá tăng dần</option>
          <option value="price_desc">Sắp xếp: Giá giảm dần</option>
        </select>
      </div>

      {/* Section 11: Bulk Action Toolbar */}
      {selectedIds.length > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-900/90 to-indigo-900/90 border border-purple-500/50 flex items-center justify-between text-xs text-white shadow-xl animate-fade-in">
          <div className="flex items-center gap-3 font-semibold">
            <span className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-xs">{selectedIds.length}</span>
            <span>Sản phẩm đã chọn</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopySelectedLinks}
              className="px-4 py-2 rounded-xl bg-white text-purple-950 font-extrabold text-xs shadow hover:bg-slate-100 transition-all flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>COPY ALL AFF LINKS</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-xs hover:bg-slate-700 transition-all flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Xuất Excel / CSV</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Products Grid / Table View */}
      {loading ? (
        <div className="text-center py-16 space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Đang tải thư viện sản phẩm...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 glass-card rounded-3xl space-y-3">
          <ShoppingBag className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="font-bold text-white text-base">Không tìm thấy sản phẩm nào</h3>
          <p className="text-xs text-slate-400">Thử tìm kiếm từ khóa khác hoặc quét shop mới.</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID CARD VIEW (Section 5) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {products.map((p) => (
            <div key={p.id} className="glass-card rounded-2xl overflow-hidden flex flex-col justify-between group relative">
              {/* Checkbox select */}
              <input
                type="checkbox"
                checked={selectedIds.includes(p.id)}
                onChange={() => toggleSelect(p.id)}
                className="absolute top-3 left-3 z-10 w-5 h-5 rounded border-slate-700 text-purple-600 focus:ring-purple-500 cursor-pointer"
              />

              {/* Product Image & Badges */}
              <div className="relative aspect-square overflow-hidden bg-slate-900">
                <img
                  src={p.image}
                  alt={p.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                
                {/* Affiliate Score Badge (Section 7) */}
                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur border border-amber-500/40 text-amber-300 font-extrabold text-[11px] shadow flex items-center gap-1">
                  <Flame className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span>Score: {p.affiliateScore}/100</span>
                </div>

                {/* Commission % Badge */}
                <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-emerald-500 text-slate-950 font-black text-xs shadow-lg">
                  Hoa Hồng {p.commissionRate}%
                </div>
              </div>

              {/* Content */}
              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-purple-400 flex items-center gap-1">
                    <Store className="w-3 h-3" />
                    <span>{p.shop?.name || 'Shopee Store'}</span>
                  </div>
                  <h3 className="text-xs font-bold text-white line-clamp-2 leading-relaxed">{p.name}</h3>
                </div>

                {/* Pricing & Sales Stats */}
                <div className="pt-2 border-t border-slate-800/80 space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-base font-black text-emerald-400">{formatCurrency(p.salePrice)}</span>
                    <span className="text-[11px] text-slate-500 line-through">{formatCurrency(p.price)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Đã bán: {formatNumber(p.sold)}</span>
                    <span className="text-amber-300 flex items-center gap-0.5">
                      <Star className="w-3 h-3 fill-amber-300" /> {p.rating}
                    </span>
                  </div>
                  <div className="text-[11px] text-purple-300 font-semibold">
                    HH ước tính: {formatCurrency(p.estCommission)} / đơn
                  </div>
                </div>

                {/* Actions (Section 5 Requirements) */}
                <div className="pt-2 space-y-2">
                  {/* Big COPY AFF LINK Button */}
                  <button
                    onClick={() => handleCopyAffLink(p.affiliateUrl, p.originalUrl, p.id)}
                    className="w-full py-2.5 rounded-xl gradient-shopee text-white font-extrabold text-xs shadow-glow hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    {copiedId === p.id ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                    <span>COPY AFF LINK</span>
                  </button>

                  {/* Secondary Action Row */}
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    <a
                      href={p.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center gap-1 transition-all"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Mở Gốc</span>
                    </a>
                    <button
                      onClick={() => handleCopyAffLink(p.originalUrl, p.originalUrl, `orig_${p.id}`)}
                      className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center gap-1 transition-all"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Link Gốc</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="glass-panel rounded-2xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold">
                <th className="p-3">
                  <input type="checkbox" onChange={toggleSelectAll} checked={selectedIds.length === products.length} />
                </th>
                <th className="p-3">Sản Phẩm</th>
                <th className="p-3">Giá Bán</th>
                <th className="p-3">Hoa Hồng %</th>
                <th className="p-3">HH Ước Tính</th>
                <th className="p-3">Score</th>
                <th className="p-3">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3">
                    <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => toggleSelect(p.id)} />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <img src={p.image} alt={p.name} className="w-10 h-10 rounded-lg object-cover bg-slate-900 flex-shrink-0" />
                      <div>
                        <div className="font-bold text-white truncate max-w-xs">{p.name}</div>
                        <div className="text-[10px] text-slate-400">{p.shop?.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 font-semibold text-emerald-400">{formatCurrency(p.salePrice)}</td>
                  <td className="p-3 font-bold text-purple-300">{p.commissionRate}%</td>
                  <td className="p-3 font-semibold text-emerald-400">{formatCurrency(p.estCommission)}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">
                      {p.affiliateScore}
                    </span>
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => handleCopyAffLink(p.affiliateUrl, p.originalUrl, p.id)}
                      className="px-3 py-1.5 rounded-lg gradient-shopee text-white font-bold text-[11px] shadow hover:brightness-110 transition-all flex items-center gap-1"
                    >
                      {copiedId === p.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>COPY</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<div className="text-center py-16 text-xs text-slate-400">Đang tải thư viện sản phẩm...</div>}>
      <LibraryContent />
    </Suspense>
  );
}

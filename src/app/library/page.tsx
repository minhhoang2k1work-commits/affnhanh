'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Search, 
  Copy, 
  Check, 
  ExternalLink, 
  Sparkles, 
  LayoutGrid, 
  Table, 
  FolderPlus, 
  FileSpreadsheet, 
  Star, 
  Flame, 
  ShoppingBag,
  Store,
  KeyRound,
  RefreshCw,
  Zap,
  TrendingUp,
  Package,
  DollarSign,
  BarChart3,
  Edit3,
  Filter,
  RotateCcw,
  SlidersHorizontal,
  CheckCircle2,
  Clock,
  Tag,
  X,
  Info,
  Ticket,
  Megaphone,
  Shield,
  CalendarDays,
  Award,
  Users,
  Layers,
  Coins,
  Globe,
  Video,
  Loader2
} from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { CATEGORY_OPTIONS, TARGET_CUSTOMER_OPTIONS } from '@/lib/constants';
import { AddToCollectionModal } from '@/components/collections/AddToCollectionModal';

export const dynamic = 'force-dynamic';

// Helper: Classify sold tier for potential analysis
function getSoldTier(sold: number): { label: string; emoji: string; color: string; bgColor: string } {
  if (sold >= 10000) return { label: 'Siêu Hot', emoji: '🔥', color: 'text-rose-400', bgColor: 'bg-rose-500/20' };
  if (sold >= 5000) return { label: 'Hot', emoji: '🔥', color: 'text-orange-400', bgColor: 'bg-orange-500/20' };
  if (sold >= 1000) return { label: 'Bán tốt', emoji: '⚡', color: 'text-amber-400', bgColor: 'bg-amber-500/20' };
  if (sold >= 200) return { label: 'Ổn định', emoji: '✅', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' };
  if (sold >= 50) return { label: 'Mới', emoji: '🌱', color: 'text-blue-400', bgColor: 'bg-blue-500/20' };
  return { label: 'Chậm', emoji: '💤', color: 'text-slate-500', bgColor: 'bg-slate-800' };
}

function LibraryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get('q') || '';

  const [products, setProducts] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [filterType, setFilterType] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [selectedShop, setSelectedShop] = useState<string>('all');
  const [affiliateStatusFilter, setAffiliateStatusFilter] = useState<string>('all');
  const [soldTierFilter, setSoldTierFilter] = useState<string>('all');
  const [minPriceInput, setMinPriceInput] = useState<string>('');
  const [maxPriceInput, setMaxPriceInput] = useState<string>('');
  const [minCommInput, setMinCommInput] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [targetCustomerFilter, setTargetCustomerFilter] = useState<string>('all');
  const [dbCategories, setDbCategories] = useState<string[]>([]);
  const [dbTargetCustomers, setDbTargetCustomers] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<string>('score');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [generatingBulk, setGeneratingBulk] = useState(false);

  const [isAddToColOpen, setIsAddToColOpen] = useState(false);
  const [colTargetProductIds, setColTargetProductIds] = useState<string[]>([]);
  const [colTargetProductNames, setColTargetProductNames] = useState<string[]>([]);

  // Video Pipeline State
  const [videoCreating, setVideoCreating] = useState(false);
  const [videoProductName, setVideoProductName] = useState('');
  const [videoPipelineState, setVideoPipelineState] = useState<any>(null);
  const [extensionInstalled, setExtensionInstalled] = useState(false);

  // Check extension installed & listen for video pipeline state
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.data?.type === 'AFF_EXTENSION_INSTALLED') {
        setExtensionInstalled(true);
      }
      if (event.data?.type === 'AFF_VIDEO_STARTED') {
        if (!event.data.started) {
          showToast('Lỗi khởi tạo video: ' + (event.data.error || 'Extension không phản hồi'));
          setVideoCreating(false);
        }
      }
      if (event.data?.type === 'AFF_VIDEO_STATE') {
        const state = event.data.state;
        setVideoPipelineState(state);
        if (state?.finalVideoUrl) {
          showToast('🎬 Video hoàn thành!');
        }
        if (state?.error) {
          showToast('❌ Lỗi: ' + state.error);
        }
        if (state?.finalVideoUrl || state?.error) {
          setTimeout(() => setVideoCreating(false), 3000);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    if (document.documentElement.getAttribute('data-aff-extension-installed') === 'true') {
      setExtensionInstalled(true);
    }
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleCreateVideo = async (product: any) => {
    if (!extensionInstalled) {
      showToast('Cần cài đặt AFF HUB Extension để tạo video!');
      return;
    }
    let chatgptUrl = localStorage.getItem('aff_chatgpt_url') || '';
    const flowUrl = localStorage.getItem('aff_flow_url') || 'https://flow.google';

    if (!chatgptUrl) {
      const url = prompt('Nhập link ChatGPT trợ lý phân tích sản phẩm:', 'https://chatgpt.com/g/g-xxxxx');
      if (!url) return;
      localStorage.setItem('aff_chatgpt_url', url);
      chatgptUrl = url;
    }

    setVideoCreating(true);
    setVideoProductName(product.name);
    setVideoPipelineState(null);

    window.postMessage({
      type: 'AFF_CREATE_VIDEO',
      imageUrl: product.image,
      chatgptUrl,
      flowUrl,
      productId: product.id,
      productName: product.name,
    }, '*');
  };

  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [newCommRate, setNewCommRate] = useState<string>('');
  const [editMaxComm, setEditMaxComm] = useState<string>('');
  const [editAffProgram, setEditAffProgram] = useState<string>('');
  const [editVoucherAff, setEditVoucherAff] = useState<string>('');
  const [editVoucherShop, setEditVoucherShop] = useState<string>('');
  const [editVoucherPlatform, setEditVoucherPlatform] = useState<string>('');
  const [editCondition, setEditCondition] = useState<string>('');
  const [editCampaignValidity, setEditCampaignValidity] = useState<string>('');
  const [editAllowAds, setEditAllowAds] = useState<string>('');
  const [editCpsActual, setEditCpsActual] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('');
  const [editTargetCustomer, setEditTargetCustomer] = useState<string>('');

  const handleOpenEdit = (p: any) => {
    setEditingProduct(p);
    setNewCommRate(String(p.commissionRate || 0));
    setEditMaxComm(p.maxCommission != null ? String(p.maxCommission) : '');
    setEditAffProgram(p.affiliateProgram || '');
    setEditVoucherAff(p.voucherAffiliate || '');
    setEditVoucherShop(p.voucherShop || '');
    setEditVoucherPlatform(p.voucherPlatform || '');
    setEditCondition(p.commissionCondition || '');
    setEditCampaignValidity(p.campaignValidity || '');
    setEditAllowAds(p.allowAds === true ? 'yes' : p.allowAds === false ? 'no' : '');
    setEditCpsActual(p.cpsActual != null ? String(p.cpsActual) : '');
    setEditCategory(p.category || '');
    setEditTargetCustomer(p.targetCustomer || '');
  };

  const handleSaveCommission = async () => {
    if (!editingProduct) return;
    const rate = parseFloat(newCommRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      showToast('Tỷ lệ hoa hồng không hợp lệ (0-100%)');
      return;
    }

    try {
      const updatePayload: any = { commissionRate: rate };
      if (editMaxComm) updatePayload.maxCommission = parseFloat(editMaxComm) || null;
      if (editAffProgram) updatePayload.affiliateProgram = editAffProgram;
      if (editVoucherAff) updatePayload.voucherAffiliate = editVoucherAff;
      if (editVoucherShop) updatePayload.voucherShop = editVoucherShop;
      if (editVoucherPlatform) updatePayload.voucherPlatform = editVoucherPlatform;
      if (editCondition) updatePayload.commissionCondition = editCondition;
      if (editCampaignValidity) updatePayload.campaignValidity = editCampaignValidity;
      if (editAllowAds === 'yes') updatePayload.allowAds = true;
      else if (editAllowAds === 'no') updatePayload.allowAds = false;
      if (editCpsActual) updatePayload.cpsActual = parseFloat(editCpsActual) || null;
      updatePayload.category = editCategory || null;
      updatePayload.targetCustomer = editTargetCustomer || null;

      const res = await fetch(`/api/products/${editingProduct.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Đã cập nhật thông tin Affiliate!`);
        setProducts((prev) =>
          prev.map((item) => (item.id === editingProduct.id ? { ...item, ...updatePayload } : item))
        );
        setEditingProduct(null);
      } else {
        showToast(data.error || 'Không thể cập nhật hoa hồng');
      }
    } catch (err) {
      showToast('Lỗi cập nhật hoa hồng');
    }
  };

  // Debounced search & filtering fetch
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchProducts();
    }, 300);

    return () => clearTimeout(handler);
  }, [
    searchQuery, 
    filterType, 
    sortBy, 
    platformFilter,
    selectedShop, 
    affiliateStatusFilter, 
    soldTierFilter, 
    minPriceInput, 
    maxPriceInput, 
    minCommInput,
    categoryFilter,
    targetCustomerFilter
  ]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      let url = `/api/products?q=${encodeURIComponent(searchQuery)}&sortBy=${sortBy}`;
      if (filterType !== 'all') {
        url += `&filterType=${filterType}`;
      }
      if (platformFilter && platformFilter !== 'all') {
        url += `&platform=${encodeURIComponent(platformFilter)}`;
      }
      if (selectedShop && selectedShop !== 'all') {
        url += `&shopId=${encodeURIComponent(selectedShop)}`;
      }
      if (affiliateStatusFilter && affiliateStatusFilter !== 'all') {
        url += `&affiliateStatus=${affiliateStatusFilter}`;
      }
      if (minPriceInput) {
        url += `&minPrice=${encodeURIComponent(minPriceInput)}`;
      }
      if (maxPriceInput) {
        url += `&maxPrice=${encodeURIComponent(maxPriceInput)}`;
      }
      if (minCommInput) {
        url += `&minCommission=${encodeURIComponent(minCommInput)}`;
      }
      if (soldTierFilter && soldTierFilter !== 'all') {
        if (soldTierFilter === 'new') url += `&minSold=1&maxSold=199`;
        else if (soldTierFilter === 'stable') url += `&minSold=200&maxSold=999`;
        else if (soldTierFilter === 'good') url += `&minSold=1000&maxSold=4999`;
        else if (soldTierFilter === 'hot') url += `&minSold=5000&maxSold=9999`;
        else if (soldTierFilter === 'super_hot') url += `&minSold=10000`;
      }
      if (categoryFilter && categoryFilter !== 'all') {
        url += `&category=${encodeURIComponent(categoryFilter)}`;
      }
      if (targetCustomerFilter && targetCustomerFilter !== 'all') {
        url += `&targetCustomer=${encodeURIComponent(targetCustomerFilter)}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      if (data.products) {
        setProducts(data.products);
      }
      if (data.shops) {
        setShops(data.shops);
      }
      if (data.distinctCategories) {
        setDbCategories(data.distinctCategories);
      }
      if (data.distinctTargetCustomers) {
        setDbTargetCustomers(data.distinctTargetCustomers);
      }
    } catch (err) {
      console.error('Error fetching library products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setPlatformFilter('all');
    setSelectedShop('all');
    setAffiliateStatusFilter('all');
    setSoldTierFilter('all');
    setMinPriceInput('');
    setMaxPriceInput('');
    setMinCommInput('');
    setFilterType('all');
    setSortBy('score');
    setCategoryFilter('all');
    setTargetCustomerFilter('all');
  };

  const activeFiltersCount = [
    platformFilter !== 'all',
    selectedShop !== 'all',
    affiliateStatusFilter !== 'all',
    soldTierFilter !== 'all',
    Boolean(minPriceInput),
    Boolean(maxPriceInput),
    Boolean(minCommInput),
    filterType !== 'all',
    Boolean(searchQuery),
    categoryFilter !== 'all',
    targetCustomerFilter !== 'all',
  ].filter(Boolean).length;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Section 20: 1-Click Copy Affiliate Link (Button state toggle for 2 seconds)
  const handleCopyAffLink = (affUrl: string | null, origUrl: string, id: string) => {
    const linkToCopy = affUrl || origUrl;
    navigator.clipboard.writeText(linkToCopy);
    setCopiedId(id);
    showToast('Đã copy Affiliate Link vào Clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Section 10: Generate Affiliate Link for Single Product
  const handleGenerateSingleLink = async (productId: string) => {
    try {
      const res = await fetch(`/api/products/${productId}/affiliate-link`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.status === 'pending_configuration') {
          showToast('Bạn chưa kết nối tài khoản Affiliate!');
          router.push('/accounts');
          return;
        }
        showToast(data.error || 'Lỗi khi tạo link');
        return;
      }
      showToast('Đã tạo Affiliate Link thành công!');
      fetchProducts();
    } catch (err) {
      console.error(err);
    }
  };

  // Section 10: Generate Affiliate Links for all pending items
  const handleBatchGenerateAffiliate = async () => {
    setGeneratingBulk(true);
    try {
      const res = await fetch('/api/products/bulk-affiliate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: selectedIds.length > 0 ? selectedIds : undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.status === 'pending_configuration') {
          showToast('Vui lòng kết nối tài khoản Affiliate trước!');
          router.push('/accounts');
          return;
        }
        showToast(data.error || 'Lỗi khi tạo link hàng loạt');
        return;
      }
      showToast(`Đã khởi tạo ${data.successCount} Affiliate Links thành công!`);
      fetchProducts();
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingBulk(false);
    }
  };

  // Section 22: Bulk Selection & Export
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
      'HH dự kiến/đơn (VND)': Math.round((p.salePrice * p.commissionRate) / 100),
      'HH tối đa (VND)': p.maxCommission || '',
      'CPS thực tế %': p.cpsActual || '',
      'Hoa hồng ước tính (VND)': p.estCommission,
      'Chương trình Affiliate': p.affiliateProgram || '',
      'Voucher Affiliate': p.voucherAffiliate || '',
      'Voucher Shop': p.voucherShop || '',
      'Voucher Sàn': p.voucherPlatform || '',
      'Điều kiện nhận HH': p.commissionCondition || '',
      'Thời gian campaign': p.campaignValidity || '',
      'Cho phép quảng cáo': p.allowAds === true ? 'Có' : p.allowAds === false ? 'Không' : '',
      'Affiliate Score': p.affiliateScore,
      'Ngành hàng': p.category || '',
      'Đối tượng KH': p.targetCustomer || '',
      'Affiliate Link': p.affiliateUrl || p.originalUrl,
      'Deep Link gốc': p.originalUrl,
    }));

    if (exportData.length === 0) return;
    const columns = Object.keys(exportData[0]);
    const escapeCsv = (value: unknown) => {
      let text = value == null ? '' : String(value);
      // Prevent spreadsheet formula injection when the CSV is opened in Excel.
      if (/^[=+\-@]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const csv = [
      columns.map(escapeCsv).join(','),
      ...exportData.map((row) => columns.map((column) => escapeCsv((row as any)[column])).join(',')),
    ].join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Affiliate_Products_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Đã xuất file Excel thành công!');
  };

  const [enrichingBulk, setEnrichingBulk] = useState(false);

  const handleBulkEnrichCommission = async () => {
    if (selectedIds.length === 0) return;
    setEnrichingBulk(true);
    showToast(`Đang kiểm tra hoa hồng cho ${selectedIds.length} sản phẩm...`);
    try {
      const res = await fetch('/api/products/bulk-enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: selectedIds, forceUpdate: true }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Đã cập nhật hoa hồng cho ${data.successCount}/${data.total} sản phẩm!`);
        fetchProducts();
      } else {
        showToast(data.error || 'Cập nhật hoa hồng thất bại');
      }
    } catch (e: any) {
      showToast(e?.message || 'Lỗi kết nối khi cập nhật hoa hồng');
    } finally {
      setEnrichingBulk(false);
    }
  };

  const unconfiguredCount = products.filter(p => p.affiliateStatus === 'pending_configuration' || !p.affiliateUrl).length;

  return (
    <div className="space-y-6 pb-20">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50 px-4 py-2.5 sm:px-5 sm:py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs shadow-2xl flex items-center gap-2 animate-bounce max-w-[90vw]">
          <Sparkles className="w-4 h-4 text-amber-300 flex-shrink-0" />
          <span className="truncate">{toastMsg}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Thư Viện Sản Phẩm <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 font-mono">{products.length} Items</span>
          </h1>
          <p className="text-xs text-slate-400">Tìm kiếm & quản lý toàn bộ sản phẩm từ Database các Shop đã quét.</p>
        </div>

        {/* View Mode & Batch Link Button */}
        <div className="flex items-center gap-3">
          {unconfiguredCount > 0 && (
            <button
              onClick={handleBatchGenerateAffiliate}
              disabled={generatingBulk}
              className="px-4 py-2 rounded-xl bg-purple-600/30 border border-purple-500/40 text-purple-200 font-bold text-xs hover:bg-purple-600 hover:text-white transition-all flex items-center gap-1.5"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>{generatingBulk ? 'Đang tạo link...' : 'TẠO LINK AFFILIATE CHO TẤT CẢ'}</span>
            </button>
          )}

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

      {/* Search Input Bar & Filter Toggle Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm sản phẩm theo tên, shop, danh mục, product ID (bình nước, nồi chiên, son...)"
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

        <button
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className={`px-4 py-3 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            showAdvancedFilters || activeFiltersCount > 0
              ? 'bg-purple-600/30 border-purple-500 text-purple-200'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4 text-purple-400" />
          <span>BỘ LỌC CHI TIẾT</span>
          {activeFiltersCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-purple-500 text-white font-extrabold text-[10px] flex items-center justify-center">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* Advanced Filter Panel */}
      {showAdvancedFilters && (
        <div className="glass-panel p-5 rounded-2xl border border-purple-500/30 space-y-4 animate-fade-in text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 font-bold text-white text-sm">
              <Filter className="w-4 h-4 text-purple-400" />
              <span>Bộ Lọc Sản Phẩm Chi Tiết</span>
            </div>
            {activeFiltersCount > 0 && (
              <button
                onClick={handleResetFilters}
                className="text-slate-400 hover:text-rose-400 flex items-center gap-1 font-semibold transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Xóa tất cả bộ lọc</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 0. Filter by Platform */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-purple-400" />
                <span>Nền Tảng / Sàn:</span>
              </label>
              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
              >
                <option value="all">Tất cả sàn (Shopee & TikTok)</option>
                <option value="SHOPEE">🛒 Shopee</option>
                <option value="TIKTOK">🎵 TikTok Shop</option>
              </select>
            </div>

            {/* 1. Filter by Shop */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-purple-400" />
                <span>Lọc Theo Shop:</span>
              </label>
              <select
                value={selectedShop}
                onChange={(e) => setSelectedShop(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
              >
                <option value="all">Tất cả các Shop ({shops.length})</option>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.platform})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Filter by Affiliate Link Status */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Trạng Thái Affiliate Link:</span>
              </label>
              <select
                value={affiliateStatusFilter}
                onChange={(e) => setAffiliateStatusFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="ready">✓ Đã có Link Affiliate (Sẵn sàng)</option>
                <option value="pending">⏳ Chưa có Link (Chờ tạo)</option>
              </select>
            </div>

            {/* 3. Filter by Sold Count Tier */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-rose-400" />
                <span>Mức Doanh Số / Đã Bán:</span>
              </label>
              <select
                value={soldTierFilter}
                onChange={(e) => setSoldTierFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
              >
                <option value="all">Tất cả mức bán</option>
                <option value="new">🌱 Mới (1 - 199 đơn)</option>
                <option value="stable">✅ Ổn định (200 - 999 đơn)</option>
                <option value="good">⚡ Bán tốt (1.000 - 4.999 đơn)</option>
                <option value="hot">🔥 Hot (5.000 - 9.999 đơn)</option>
                <option value="super_hot">🚀 Siêu Hot (&gt;= 10.000 đơn)</option>
              </select>
            </div>

            {/* 4. Filter by Commission Rate */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Hoa Hồng Từ (%):</span>
                </span>
                {minCommInput && (
                  <button onClick={() => setMinCommInput('')} className="text-slate-500 hover:text-white">x</button>
                )}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={minCommInput}
                  onChange={(e) => setMinCommInput(e.target.value)}
                  placeholder="VD: 10 (%)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                />
              </div>
              <div className="flex items-center gap-1 pt-1">
                {['5', '10', '15', '20'].map((val) => (
                  <button
                    key={val}
                    onClick={() => setMinCommInput(minCommInput === val ? '' : val)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all ${
                      minCommInput === val
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    &gt;={val}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Category & Target Customer Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 5. Filter by Category (Ngành hàng) */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Ngành Hàng:</span>
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
              >
                <option value="all">Tất cả ngành hàng</option>
                {(() => {
                  const allCats = Array.from(new Set([...CATEGORY_OPTIONS, ...dbCategories]));
                  return allCats.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ));
                })()}
              </select>
            </div>

            {/* 6. Filter by Target Customer (Đối tượng khách hàng) */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-pink-400" />
                <span>Đối Tượng Khách Hàng:</span>
              </label>
              <select
                value={targetCustomerFilter}
                onChange={(e) => setTargetCustomerFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
              >
                <option value="all">Tất cả đối tượng</option>
                {(() => {
                  const allTcs = Array.from(new Set([...TARGET_CUSTOMER_OPTIONS, ...dbTargetCustomers]));
                  return allTcs.map((tc) => (
                    <option key={tc} value={tc}>{tc}</option>
                  ));
                })()}
              </select>
            </div>
          </div>

          {/* Row 2: Custom Price Range */}
          <div className="pt-2 border-t border-slate-800/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-400 font-semibold flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-amber-300" />
                <span>Khoảng Giá (VNĐ):</span>
              </span>
              <input
                type="number"
                value={minPriceInput}
                onChange={(e) => setMinPriceInput(e.target.value)}
                placeholder="Giá từ (VD: 50000)"
                className="w-36 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
              />
              <span className="text-slate-500">-</span>
              <input
                type="number"
                value={maxPriceInput}
                onChange={(e) => setMaxPriceInput(e.target.value)}
                placeholder="Đến (VD: 500000)"
                className="w-36 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
              />
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setMinPriceInput(''); setMaxPriceInput('100000'); }}
                  className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white text-[10px]"
                >
                  &lt;100k
                </button>
                <button
                  onClick={() => { setMinPriceInput('100000'); setMaxPriceInput('500000'); }}
                  className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white text-[10px]"
                >
                  100k - 500k
                </button>
                <button
                  onClick={() => { setMinPriceInput('500000'); setMaxPriceInput(''); }}
                  className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white text-[10px]"
                >
                  &gt;500k
                </button>
              </div>
            </div>

            {activeFiltersCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-purple-300 font-semibold">
                  Đang lọc: {products.length} sản phẩm phù hợp
                </span>
                <button
                  onClick={handleResetFilters}
                  className="px-3 py-1 rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500 hover:text-white font-bold text-[11px] transition-all"
                >
                  Xóa lọc
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filter Quick Tabs & Sort Dropdown */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${filterType === 'all' ? 'gradient-shopee text-white shadow-glow' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'}`}
          >
            Tất Cả ({products.length})
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
          <option value="newest">Sắp xếp: Mới cập nhật</option>
          <option value="category">Sắp xếp: Theo Ngành Hàng</option>
        </select>
      </div>

      {/* Section 22: Bulk Action Toolbar */}
      {selectedIds.length > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-900/90 to-indigo-900/90 border border-purple-500/50 flex items-center justify-between text-xs text-white shadow-xl animate-fade-in">
          <div className="flex items-center gap-3 font-semibold">
            <span className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-xs">{selectedIds.length}</span>
            <span>Sản phẩm đã chọn</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBatchGenerateAffiliate}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs transition-all flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>TẠO AFF LINK</span>
            </button>
            <button
              onClick={() => {
                setColTargetProductIds(selectedIds);
                setColTargetProductNames([]);
                setIsAddToColOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-purple-600/40 border border-purple-500/50 hover:bg-purple-600 text-white font-extrabold text-xs transition-all flex items-center gap-1.5"
            >
              <FolderPlus className="w-3.5 h-3.5 text-purple-300" />
              <span>VÀO BỘ SƯU TẬP ({selectedIds.length})</span>
            </button>
            <button
              onClick={handleCopySelectedLinks}
              className="px-4 py-2 rounded-xl bg-white text-purple-950 font-extrabold text-xs shadow hover:bg-slate-100 transition-all flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>COPY LINKS</span>
            </button>
            <button
              onClick={handleBulkEnrichCommission}
              disabled={enrichingBulk}
              className="px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs hover:bg-amber-500/30 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {enrichingBulk ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Coins className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>CHECK HOA HỒNG ({selectedIds.length})</span>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="glass-card p-4 rounded-2xl space-y-3 animate-pulse">
              <div className="aspect-[4/5] rounded-xl bg-slate-800" />
              <div className="h-4 bg-slate-800 rounded-lg w-3/4" />
              <div className="h-3 bg-slate-800 rounded-lg w-1/2" />
              <div className="h-10 bg-slate-800 rounded-xl" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 glass-card rounded-3xl space-y-3">
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-slate-800 to-slate-900 mx-auto flex items-center justify-center">
            <ShoppingBag className="w-16 h-16 text-slate-500" />
          </div>
          <h3 className="font-bold text-white text-base">Không tìm thấy sản phẩm nào</h3>
          <p className="text-xs text-slate-400">Thử tìm kiếm từ khóa khác hoặc dán link quét shop mới.</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID CARD VIEW (Section 19 & 20) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((p) => (
            <div key={p.id} className="glass-card rounded-2xl overflow-hidden flex flex-col justify-between group relative">
              <input
                type="checkbox"
                checked={selectedIds.includes(p.id)}
                onChange={() => toggleSelect(p.id)}
                className="absolute top-3 left-3 z-10 w-5 h-5 rounded border-slate-700 text-purple-600 focus:ring-purple-500 cursor-pointer"
              />

              <div className="relative aspect-[4/5] overflow-hidden bg-slate-900">
                <img
                  src={p.image}
                  alt={p.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                
                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur border border-amber-500/40 text-amber-300 font-extrabold text-[11px] shadow flex items-center gap-1">
                  <Flame className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span>Score: {p.affiliateScore}/100</span>
                </div>

                <div className="absolute bottom-3 right-3 px-2 py-1 rounded-full bg-slate-950/70 backdrop-blur border border-slate-700/50 text-white font-bold text-[10px] flex items-center gap-1">
                  <Package className="w-3 h-3 text-slate-400" />
                  <span>Đã bán {formatNumber(p.sold)}</span>
                </div>

                <button
                  onClick={() => handleOpenEdit(p)}
                  className="absolute bottom-3 left-3 px-3 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg transition-all flex items-center gap-1 group/btn cursor-pointer"
                  title="Bấm để chỉnh sửa tỷ lệ hoa hồng"
                >
                  <span>Hoa Hồng {p.commissionRate}%</span>
                  <Edit3 className="w-3 h-3 text-slate-900 group-hover/btn:scale-110 transition-transform" />
                </button>
              </div>

              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <h3 className="text-xs font-bold text-white line-clamp-2 leading-relaxed min-h-[2.5rem]">{p.name}</h3>
                  <div className="text-[11px] text-slate-400 flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1 truncate">
                      <Store className="w-3 h-3 flex-shrink-0 text-slate-500" />
                      <span className="truncate">{p.shop?.name || (p.platform === 'TIKTOK' ? 'TikTok Shop' : 'Shopee Store')}</span>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                      p.platform === 'TIKTOK'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                    }`}>
                      {p.platform === 'TIKTOK' ? '🎵 TikTok' : '🛒 Shopee'}
                    </span>
                  </div>
                  {(p.category || p.targetCustomer) && (
                    <div className="flex flex-wrap items-center gap-1 pt-0.5">
                      {p.category && (
                        <span className="px-1.5 py-0.5 rounded-md bg-cyan-500/15 text-cyan-400 text-[9px] font-semibold flex items-center gap-0.5">
                          <Layers className="w-2.5 h-2.5" />
                          {p.category}
                        </span>
                      )}
                      {p.targetCustomer && (
                        <span className="px-1.5 py-0.5 rounded-md bg-pink-500/15 text-pink-400 text-[9px] font-semibold flex items-center gap-0.5">
                          <Users className="w-2.5 h-2.5" />
                          {p.targetCustomer}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  {/* Row 1: Price */}
                  <div className="flex items-baseline justify-between">
                    <span className="text-base font-black text-emerald-400">{formatCurrency(p.salePrice)}</span>
                    <span className="text-[11px] text-slate-500 line-through">{formatCurrency(p.price)}</span>
                  </div>

                  {/* Row 2: Sold + Sold Tier Badge */}
                  {(() => {
                    const tier = getSoldTier(p.sold);
                    return (
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Package className="w-3 h-3 text-slate-500" />
                          <span>Đã bán: <span className="font-bold text-white">{formatNumber(p.sold)}</span></span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${tier.bgColor} ${tier.color}`}>
                          {tier.emoji} {tier.label}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Row 3: Revenue + Rating */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center gap-1" title="Doanh thu ước tính = Đã bán × Giá bán">
                      <TrendingUp className="w-3 h-3 text-purple-400" />
                      <span>DT: <span className="text-purple-300 font-semibold">{formatCurrency(p.sold * p.salePrice)}</span></span>
                    </div>
                    <span className="text-amber-300 flex items-center gap-0.5">
                      <Star className="w-3 h-3 fill-amber-300" /> {p.rating}
                    </span>
                  </div>

                  {/* Row 4: Commission Analytics */}
                  <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/60 grid grid-cols-2 gap-2 text-[10px]">
                    <div className="text-slate-400" title="HH ước tính mỗi đơn">
                      <span className="block text-slate-500">HH/đơn</span>
                      <span className="text-emerald-400 font-bold text-[11px]">~{formatCurrency(Math.round(p.salePrice * p.commissionRate / 100))}</span>
                    </div>
                    <div className="text-slate-400 text-right" title="Tổng HH tiềm năng = Đã bán × HH/đơn">
                      <span className="block text-slate-500">Tổng HH tiềm năng</span>
                      <span className="text-amber-300 font-bold text-[11px]">~{formatCurrency(Math.round(p.sold * p.salePrice * p.commissionRate / 100))}</span>
                    </div>
                    {p.maxCommission != null && p.maxCommission > 0 && (
                      <div className="text-slate-400 col-span-2 pt-1 border-t border-slate-800/40">
                        <span className="text-slate-500">HH tối đa: </span>
                        <span className="text-rose-400 font-bold">{formatCurrency(p.maxCommission)}</span>
                      </div>
                    )}
                    {p.cpsActual != null && p.cpsActual > 0 && (
                      <div className="text-slate-400 col-span-2">
                        <span className="text-slate-500">CPS thực tế: </span>
                        <span className="text-cyan-400 font-bold">{p.cpsActual}%</span>
                      </div>
                    )}
                  </div>

                  {/* Row 5: Affiliate Detail Info */}
                  {(p.affiliateProgram || p.voucherAffiliate || p.voucherShop || p.voucherPlatform || p.commissionCondition || p.campaignValidity || p.allowAds !== null) && (
                    <div className="p-2 rounded-lg bg-purple-950/30 border border-purple-500/10 space-y-1 text-[10px]">
                      {p.affiliateProgram && (
                        <div className="flex items-center gap-1 text-purple-300">
                          <Award className="w-3 h-3 text-purple-400 flex-shrink-0" />
                          <span className="truncate">{p.affiliateProgram}</span>
                        </div>
                      )}
                      {p.voucherAffiliate && (
                        <div className="flex items-center gap-1 text-emerald-300">
                          <Ticket className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                          <span className="truncate">Aff: {p.voucherAffiliate}</span>
                        </div>
                      )}
                      {p.voucherShop && (
                        <div className="flex items-center gap-1 text-blue-300">
                          <Ticket className="w-3 h-3 text-blue-400 flex-shrink-0" />
                          <span className="truncate">Shop: {p.voucherShop}</span>
                        </div>
                      )}
                      {p.voucherPlatform && (
                        <div className="flex items-center gap-1 text-amber-300">
                          <Ticket className="w-3 h-3 text-amber-400 flex-shrink-0" />
                          <span className="truncate">Sàn: {p.voucherPlatform}</span>
                        </div>
                      )}
                      {p.commissionCondition && (
                        <div className="flex items-center gap-1 text-slate-300">
                          <Info className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <span className="truncate" title={p.commissionCondition}>ĐK: {p.commissionCondition}</span>
                        </div>
                      )}
                      {p.campaignValidity && (
                        <div className="flex items-center gap-1 text-slate-300">
                          <CalendarDays className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <span className="truncate">{p.campaignValidity}</span>
                        </div>
                      )}
                      {p.allowAds !== null && p.allowAds !== undefined && (
                        <div className="flex items-center gap-1">
                          <Megaphone className="w-3 h-3 flex-shrink-0" />
                          <span className={p.allowAds ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                            {p.allowAds ? '✅ Cho phép chạy Ads' : '❌ Không cho phép Ads'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions & Section 20 Button State Toggle */}
                <div className="pt-2 space-y-2">
                  {p.affiliateUrl ? (
                    <button
                      onClick={() => handleCopyAffLink(p.affiliateUrl, p.originalUrl, p.id)}
                      className={`w-full py-2.5 rounded-xl font-extrabold text-xs shadow-glow transition-all flex items-center justify-center gap-2 ${
                        copiedId === p.id
                          ? 'bg-emerald-500 text-slate-950'
                          : 'gradient-shopee text-white hover:brightness-110 active:scale-95'
                      }`}
                    >
                      {copiedId === p.id ? <Check className="w-4 h-4 stroke-[3]" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedId === p.id ? '✓ ĐÃ COPY' : 'COPY AFF LINK'}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleGenerateSingleLink(p.id)}
                      className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs transition-all flex items-center justify-center gap-1.5"
                    >
                      <Zap className="w-4 h-4 text-amber-300" />
                      <span>TẠO AFF LINK</span>
                    </button>
                  )}

                  <div className="grid grid-cols-4 gap-1.5 text-[11px]">
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
                    <button
                      onClick={() => handleCreateVideo(p)}
                      className="p-1.5 rounded-lg bg-slate-900 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-600 hover:text-white flex items-center justify-center gap-1 transition-all"
                      title="Tạo Video AI từ sản phẩm"
                    >
                      <Video className="w-3 h-3" />
                      <span>Video</span>
                    </button>
                    <button
                      onClick={() => {
                        setColTargetProductIds([p.id]);
                        setColTargetProductNames([p.name]);
                        setIsAddToColOpen(true);
                      }}
                      className="p-1.5 rounded-lg bg-slate-900 border border-purple-500/30 text-purple-300 hover:bg-purple-600 hover:text-white flex items-center justify-center gap-1 transition-all"
                      title="Thêm vào Bộ Sưu Tập"
                    >
                      <FolderPlus className="w-3 h-3" />
                      <span>+BST</span>
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
          <table className="w-full text-left border-collapse text-xs min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold">
                <th className="p-3">
                  <input type="checkbox" onChange={toggleSelectAll} checked={selectedIds.length === products.length} />
                </th>
                <th className="p-3">Sản Phẩm</th>
                <th className="p-3">Giá Bán</th>
                <th className="p-3">Đã Bán</th>
                <th className="p-3">Mức Bán</th>
                <th className="p-3">Doanh Thu ƯT</th>
                <th className="p-3">HH %</th>
                <th className="p-3">HH/Đơn</th>
                <th className="p-3">HH Max</th>
                <th className="p-3">Voucher</th>
                <th className="p-3">Ads</th>
                <th className="p-3">Tổng HH Tiềm Năng</th>
                <th className="p-3">Score</th>
                <th className="p-3">Trạng Thái</th>
                <th className="p-3">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {products.map((p) => {
                const tier = getSoldTier(p.sold);
                const commPerOrder = Math.round(p.salePrice * p.commissionRate / 100);
                const estRevenue = p.sold * p.salePrice;
                const totalCommPotential = Math.round(p.sold * p.salePrice * p.commissionRate / 100);
                return (
                <tr key={p.id} className="hover:bg-slate-800/40 transition-colors odd:bg-slate-900/30">
                  <td className="p-3">
                    <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => toggleSelect(p.id)} />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <img src={p.image} alt={p.name} className="w-10 h-10 rounded-lg object-cover bg-slate-900 flex-shrink-0" />
                      <div>
                        <div className="font-bold text-white truncate max-w-[280px]">{p.name}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                          <span>{p.shop?.name}</span>
                          <span className={`px-1 py-0.2 rounded text-[8px] font-bold ${
                            p.platform === 'TIKTOK' ? 'text-cyan-400 bg-cyan-500/10' : 'text-orange-400 bg-orange-500/10'
                          }`}>
                            {p.platform === 'TIKTOK' ? 'TikTok' : 'Shopee'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 font-semibold text-emerald-400">{formatCurrency(p.salePrice)}</td>
                  <td className="p-3 font-bold text-white">{formatNumber(p.sold)}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] whitespace-nowrap ${tier.bgColor} ${tier.color}`}>
                      {tier.emoji} {tier.label}
                    </span>
                  </td>
                  <td className="p-3 text-purple-300 font-semibold" title={`${p.sold} × ${formatCurrency(p.salePrice)}`}>{formatCurrency(estRevenue)}</td>
                  <td className="p-3 font-bold text-purple-300">{p.commissionRate}%</td>
                  <td className="p-3 text-emerald-400 font-semibold">~{formatCurrency(commPerOrder)}</td>
                  <td className="p-3 text-rose-300 font-semibold whitespace-nowrap">
                    {p.maxCommission ? formatCurrency(p.maxCommission) : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {p.voucherAffiliate || p.voucherShop || p.voucherPlatform ? (
                      <div className="space-y-0.5">
                        {p.voucherAffiliate && <div className="text-emerald-400 text-[9px] truncate max-w-[80px]" title={p.voucherAffiliate}>🎟 {p.voucherAffiliate}</div>}
                        {p.voucherShop && <div className="text-blue-400 text-[9px] truncate max-w-[80px]" title={p.voucherShop}>🏪 {p.voucherShop}</div>}
                        {p.voucherPlatform && <div className="text-amber-400 text-[9px] truncate max-w-[80px]" title={p.voucherPlatform}>🛒 {p.voucherPlatform}</div>}
                      </div>
                    ) : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="p-3">
                    {p.allowAds === true ? <span className="text-emerald-400 font-bold text-[10px]">✅</span> : p.allowAds === false ? <span className="text-rose-400 font-bold text-[10px]">❌</span> : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="p-3 text-amber-300 font-bold" title={`${formatNumber(p.sold)} đơn × ~${formatCurrency(commPerOrder)}/đơn`}>
                    ~{formatCurrency(totalCommPotential)}
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">
                      {p.affiliateScore}
                    </span>
                  </td>
                  <td className="p-3">
                    {p.affiliateUrl ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                        ✓ Sẵn sàng
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-[10px]">
                        Chờ cấu hình
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    {p.affiliateUrl ? (
                      <button
                        onClick={() => handleCopyAffLink(p.affiliateUrl, p.originalUrl, p.id)}
                        className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1 ${
                          copiedId === p.id ? 'bg-emerald-500 text-slate-950' : 'gradient-shopee text-white hover:brightness-110'
                        }`}
                      >
                        {copiedId === p.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedId === p.id ? '✓ ĐÃ COPY' : 'COPY'}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleGenerateSingleLink(p.id)}
                        className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] transition-all"
                      >
                        TẠO LINK
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenEdit(p)}
                      className="ml-1.5 p-1.5 rounded-lg bg-slate-800 hover:bg-purple-600 text-slate-400 hover:text-white transition-all inline-flex items-center"
                      title="Chỉnh sửa tỷ lệ hoa hồng"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setColTargetProductIds([p.id]);
                        setColTargetProductNames([p.name]);
                        setIsAddToColOpen(true);
                      }}
                      className="ml-1 p-1.5 rounded-lg bg-slate-800 hover:bg-purple-600 text-purple-300 hover:text-white transition-all inline-flex items-center"
                      title="Thêm vào Bộ Sưu Tập"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* EDIT AFFILIATE INFO MODAL */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-purple-400" />
                <span>Chỉnh Sửa Thông Tin Affiliate</span>
              </h3>
              <button
                onClick={() => setEditingProduct(null)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block mb-1">Sản phẩm:</span>
                <p className="font-bold text-white line-clamp-2">{editingProduct.name}</p>
              </div>

              {/* Commission Rate */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Hoa hồng (%)</label>
                  <div className="relative">
                    <input type="number" step="0.1" min="0" max="100" value={newCommRate} onChange={(e) => setNewCommRate(e.target.value)} placeholder="VD: 12" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-sm focus:outline-none focus:border-purple-500" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                  </div>
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">HH tối đa (VND)</label>
                  <input type="number" value={editMaxComm} onChange={(e) => setEditMaxComm(e.target.value)} placeholder="VD: 50000" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-sm focus:outline-none focus:border-purple-500" />
                </div>
              </div>

              {/* CPS Actual */}
              <div>
                <label className="text-slate-300 font-semibold block mb-1">CPS / Commission thực tế (%)</label>
                <div className="relative">
                  <input type="number" step="0.1" min="0" max="100" value={editCpsActual} onChange={(e) => setEditCpsActual(e.target.value)} placeholder="VD: 10.5" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-sm focus:outline-none focus:border-purple-500" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                </div>
              </div>

              {/* Affiliate Program */}
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Chương trình Affiliate</label>
                <input type="text" value={editAffProgram} onChange={(e) => setEditAffProgram(e.target.value)} placeholder="VD: Shopee Affiliate Program" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500" />
              </div>

              {/* Vouchers */}
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <label className="text-emerald-400 font-semibold block mb-1">🎟 Voucher Affiliate</label>
                  <input type="text" value={editVoucherAff} onChange={(e) => setEditVoucherAff(e.target.value)} placeholder="VD: Giảm 10% tối đa 30k" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="text-blue-400 font-semibold block mb-1">🏪 Voucher Shop</label>
                  <input type="text" value={editVoucherShop} onChange={(e) => setEditVoucherShop(e.target.value)} placeholder="VD: Giảm 5% đơn từ 200k" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-amber-400 font-semibold block mb-1">🛒 Voucher Sàn</label>
                  <input type="text" value={editVoucherPlatform} onChange={(e) => setEditVoucherPlatform(e.target.value)} placeholder="VD: Freeship đơn từ 50k" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
                </div>
              </div>

              {/* Commission Condition */}
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Điều kiện nhận hoa hồng</label>
                <textarea value={editCondition} onChange={(e) => setEditCondition(e.target.value)} placeholder="VD: Đơn hàng được xác nhận, không hoàn trả trong 7 ngày" rows={2} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 resize-none" />
              </div>

              {/* Campaign Validity */}
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Thời gian hiệu lực campaign</label>
                <input type="text" value={editCampaignValidity} onChange={(e) => setEditCampaignValidity(e.target.value)} placeholder="VD: 01/08/2026 - 31/08/2026" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500" />
              </div>

              {/* Allow Ads */}
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Cho phép chạy quảng cáo?</label>
                <select value={editAllowAds} onChange={(e) => setEditAllowAds(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500">
                  <option value="">— Chưa rõ —</option>
                  <option value="yes">✅ Có — Được phép chạy Ads</option>
                  <option value="no">❌ Không — Cấm chạy Ads</option>
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="text-slate-300 font-semibold block mb-1">📦 Ngành hàng</label>
                <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500">
                  <option value="">— Chưa phân loại —</option>
                  {(() => {
                    const allCats = Array.from(new Set([...CATEGORY_OPTIONS, ...dbCategories]));
                    return allCats.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ));
                  })()}
                </select>
              </div>

              {/* Target Customer */}
              <div>
                <label className="text-slate-300 font-semibold block mb-1">👥 Đối tượng khách hàng</label>
                <select value={editTargetCustomer} onChange={(e) => setEditTargetCustomer(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500">
                  <option value="">— Chưa xác định —</option>
                  {(() => {
                    const allTcs = Array.from(new Set([...TARGET_CUSTOMER_OPTIONS, ...dbTargetCustomers]));
                    return allTcs.map((tc) => (
                      <option key={tc} value={tc}>{tc}</option>
                    ));
                  })()}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                onClick={() => setEditingProduct(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveCommission}
                className="px-5 py-2 rounded-xl gradient-shopee text-white text-xs font-extrabold shadow-glow hover:brightness-110"
              >
                LƯU CẬP NHẬT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add To Collection Modal */}
      <AddToCollectionModal
        isOpen={isAddToColOpen}
        productIds={colTargetProductIds}
        productNames={colTargetProductNames}
        onClose={() => setIsAddToColOpen(false)}
        onSuccess={(collectionName) => {
          showToast(`Đã thêm vào bộ sưu tập "${collectionName}"!`);
        }}
      />

      {/* Video Pipeline Progress Modal */}
      {videoCreating && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <Video className="w-5 h-5 text-cyan-400" />
              <span>🎬 Đang Tạo Video AI</span>
            </div>
            <div className="text-xs text-slate-400 truncate">{videoProductName}</div>
            
            {/* Step Indicators */}
            <div className="space-y-2 text-xs">
              {[
                { key: 'analyzeStatus', label: 'Phân tích ảnh trên ChatGPT' },
                { key: 'promptStatus', label: 'Tách prompt video' },
                { key: 'video1Status', label: 'Tạo video 1 trên Google Flow' },
                { key: 'video2Status', label: 'Tạo video 2 trên Google Flow' },
                { key: 'mergeStatus', label: 'Ghép video' },
              ].map(({ key, label }) => {
                const status = videoPipelineState?.[key] || 'pending';
                return (
                  <div key={key} className={`flex items-center gap-2 ${
                    status === 'active' ? 'text-cyan-300' :
                    status === 'done' ? 'text-emerald-400' :
                    status === 'error' ? 'text-red-400' : 'text-slate-500'
                  }`}>
                    {status === 'active' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {status === 'done' && <Check className="w-3.5 h-3.5" />}
                    {status === 'error' && <X className="w-3.5 h-3.5" />}
                    {status === 'pending' && <Clock className="w-3.5 h-3.5" />}
                    <span>{label}</span>
                  </div>
                );
              })}
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-cyan-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${videoPipelineState?.progress || 0}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-400">
              {videoPipelineState?.statusText || 'Đang khởi tạo...'}
            </div>

            {/* Result */}
            {videoPipelineState?.finalVideoUrl && (
              <div className="space-y-2">
                <video 
                  src={videoPipelineState.finalVideoUrl} 
                  controls 
                  className="w-full rounded-xl border border-slate-700"
                />
                <div className="flex gap-2">
                  <a
                    href={videoPipelineState.finalVideoUrl}
                    download
                    className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold text-center hover:bg-emerald-500 transition-all"
                  >
                    ⬇️ Tải Video
                  </a>
                  <button
                    onClick={() => { setVideoCreating(false); setVideoPipelineState(null); }}
                    className="flex-1 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold text-center hover:bg-slate-700 transition-all"
                  >
                    ✕ Đóng
                  </button>
                </div>
              </div>
            )}

            {/* Error close button */}
            {videoPipelineState?.error && (
              <button
                onClick={() => { setVideoCreating(false); setVideoPipelineState(null); }}
                className="w-full py-2 rounded-xl bg-red-900/50 border border-red-500/30 text-red-300 text-xs font-bold hover:bg-red-800/50 transition-all"
              >
                ✕ Đóng
              </button>
            )}
          </div>
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

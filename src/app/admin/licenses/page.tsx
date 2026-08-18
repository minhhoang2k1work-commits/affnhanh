'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  KeyRound,
  Plus,
  Copy,
  Check,
  Trash2,
  Power,
  Laptop,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Search,
  Clock,
  Calendar,
  X,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Monitor,
  User,
  Sparkles,
  Shield,
  Layers,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface LicenseDevice {
  id: string;
  licenseId: string;
  deviceToken: string;
  deviceName: string | null;
  lastSeenAt: string;
  createdAt: string;
}

interface License {
  id: string;
  key: string;
  name: string | null;
  maxDevices: number;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  devices: LicenseDevice[];
}

type ExpiryOption = 'permanent' | '30days' | '90days' | '1year' | 'custom';
type StatusFilter = 'all' | 'active' | 'inactive' | 'expired';

// ============================================================================
// Helpers
// ============================================================================

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Vĩnh viễn';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Không xác định';
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Chưa kết nối';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Không xác định';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffHour < 24) return `${diffHour} giờ trước`;
  if (diffDay < 30) return `${diffDay} ngày trước`;
  return formatDate(dateStr);
}

function isLicenseExpired(license: License): boolean {
  if (!license.expiresAt) return false;
  return new Date(license.expiresAt) < new Date();
}

function getDaysRemaining(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const expiry = new Date(expiresAt).getTime();
  const now = Date.now();
  const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
  return diffDays;
}

// ============================================================================
// Main Component
// ============================================================================

export default function AdminLicensesPage() {
  // Data state
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Copy Feedback state: map key string to boolean
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Toast / Banner feedback
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Modal: Create License
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createMaxDevices, setCreateMaxDevices] = useState(2);
  const [createExpiryOption, setCreateExpiryOption] = useState<ExpiryOption>('permanent');
  const [createCustomDate, setCreateCustomDate] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

  // Modal: Devices Management
  const [selectedLicenseForDevices, setSelectedLicenseForDevices] = useState<License | null>(null);
  const [deletingDeviceId, setDeletingDeviceId] = useState<string | null>(null);

  // Modal: Delete License Confirmation
  const [licenseToDelete, setLicenseToDelete] = useState<License | null>(null);
  const [isDeletingLicense, setIsDeletingLicense] = useState(false);

  // Action status loading (for toggle active)
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 3500);
  }, []);

  // Fetch licenses
  const fetchLicenses = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/admin/licenses', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Máy chủ phản hồi mã lỗi ${res.status}`);
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setLicenses(data);
        // Sync selected license if device modal is open
        if (selectedLicenseForDevices) {
          const updated = data.find((l) => l.id === selectedLicenseForDevices.id);
          setSelectedLicenseForDevices(updated || null);
        }
      } else {
        setLicenses([]);
      }
    } catch (err: any) {
      console.error('[Fetch Licenses Error]:', err);
      setErrorMessage(err?.message || 'Không thể tải danh sách bản quyền');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedLicenseForDevices]);

  useEffect(() => {
    fetchLicenses();
  }, []);

  // Copy License Key
  const handleCopyKey = useCallback((key: string) => {
    if (!navigator?.clipboard) return;
    navigator.clipboard.writeText(key).then(() => {
      setCopiedKey(key);
      showToast(`Đã sao chép License Key: ${key}`, 'success');
      setTimeout(() => {
        setCopiedKey((curr) => (curr === key ? null : curr));
      }, 2000);
    });
  }, [showToast]);

  // Toggle Active Status
  const handleToggleActive = async (license: License) => {
    setTogglingId(license.id);
    const newStatus = !license.isActive;

    // Optimistic update
    setLicenses((prev) =>
      prev.map((item) => (item.id === license.id ? { ...item, isActive: newStatus } : item))
    );

    try {
      const res = await fetch(`/api/admin/licenses/${license.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newStatus }),
      });

      if (!res.ok) {
        throw new Error('Cập nhật trạng thái thất bại');
      }

      const updated = await res.json();
      setLicenses((prev) =>
        prev.map((item) => (item.id === license.id ? { ...item, ...updated } : item))
      );
      showToast(
        `Đã ${newStatus ? 'kích hoạt' : 'tạm khóa'} license ${license.name || license.key}`,
        newStatus ? 'success' : 'info'
      );
    } catch (err: any) {
      // Revert on error
      setLicenses((prev) =>
        prev.map((item) => (item.id === license.id ? { ...item, isActive: license.isActive } : item))
      );
      showToast(err?.message || 'Lỗi khi thay đổi trạng thái', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  // Create License
  const handleCreateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      let expiresAt: string | null = null;
      const now = new Date();

      if (createExpiryOption === '30days') {
        const d = new Date(now);
        d.setDate(d.getDate() + 30);
        expiresAt = d.toISOString();
      } else if (createExpiryOption === '90days') {
        const d = new Date(now);
        d.setDate(d.getDate() + 90);
        expiresAt = d.toISOString();
      } else if (createExpiryOption === '1year') {
        const d = new Date(now);
        d.setFullYear(d.getFullYear() + 1);
        expiresAt = d.toISOString();
      } else if (createExpiryOption === 'custom' && createCustomDate) {
        expiresAt = new Date(createCustomDate).toISOString();
      }

      const res = await fetch('/api/admin/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createName.trim() || 'New Customer License',
          maxDevices: Number(createMaxDevices) || 2,
          expiresAt,
        }),
      });

      if (!res.ok) {
        throw new Error('Không thể tạo license mới');
      }

      const createdLicense = await res.json();
      setLicenses((prev) => [ { ...createdLicense, devices: [] }, ...prev ]);
      setNewlyCreatedKey(createdLicense.key);
      showToast(`Đã tạo thành công License: ${createdLicense.key}`, 'success');

      // Reset form
      setCreateName('');
      setCreateMaxDevices(2);
      setCreateExpiryOption('permanent');
      setCreateCustomDate('');
    } catch (err: any) {
      showToast(err?.message || 'Lỗi khi tạo license', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  // Delete License
  const handleDeleteLicense = async () => {
    if (!licenseToDelete) return;
    setIsDeletingLicense(true);

    try {
      const res = await fetch(`/api/admin/licenses/${licenseToDelete.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Không thể xóa license');
      }

      setLicenses((prev) => prev.filter((item) => item.id !== licenseToDelete.id));
      showToast(`Đã xóa license ${licenseToDelete.name || licenseToDelete.key}`, 'success');
      setLicenseToDelete(null);

      if (selectedLicenseForDevices?.id === licenseToDelete.id) {
        setSelectedLicenseForDevices(null);
      }
    } catch (err: any) {
      showToast(err?.message || 'Lỗi khi xóa license', 'error');
    } finally {
      setIsDeletingLicense(false);
    }
  };

  // Delete / Unbind Device
  const handleDeleteDevice = async (licenseId: string, deviceId: string) => {
    setDeletingDeviceId(deviceId);

    try {
      const res = await fetch(`/api/admin/licenses/${licenseId}/devices/${deviceId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Không thể gỡ thiết bị');
      }

      // Update state
      setLicenses((prev) =>
        prev.map((lic) => {
          if (lic.id === licenseId) {
            const updatedDevices = lic.devices.filter((d) => d.id !== deviceId);
            return { ...lic, devices: updatedDevices };
          }
          return lic;
        })
      );

      if (selectedLicenseForDevices && selectedLicenseForDevices.id === licenseId) {
        setSelectedLicenseForDevices((prev) =>
          prev ? { ...prev, devices: prev.devices.filter((d) => d.id !== deviceId) } : null
        );
      }

      showToast('Đã gỡ thiết bị khỏi license thành công', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Lỗi khi gỡ thiết bị', 'error');
    } finally {
      setDeletingDeviceId(null);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const total = licenses.length;
    let active = 0;
    let registeredDevices = 0;
    let expiredOrInactive = 0;

    for (const lic of licenses) {
      const expired = isLicenseExpired(lic);
      if (lic.isActive && !expired) {
        active++;
      } else {
        expiredOrInactive++;
      }
      registeredDevices += lic.devices?.length || 0;
    }

    return { total, active, registeredDevices, expiredOrInactive };
  }, [licenses]);

  // Filtered Licenses
  const filteredLicenses = useMemo(() => {
    return licenses.filter((lic) => {
      // Query filter
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        lic.key.toLowerCase().includes(q) ||
        (lic.name && lic.name.toLowerCase().includes(q)) ||
        lic.devices?.some((d) => d.deviceName?.toLowerCase().includes(q) || d.deviceToken.toLowerCase().includes(q));

      if (!matchQuery) return false;

      // Status filter
      const expired = isLicenseExpired(lic);
      if (statusFilter === 'active') {
        return lic.isActive && !expired;
      }
      if (statusFilter === 'inactive') {
        return !lic.isActive;
      }
      if (statusFilter === 'expired') {
        return expired;
      }

      return true;
    });
  }, [licenses, searchQuery, statusFilter]);

  return (
    <div className="min-h-screen space-y-8 pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
                : toastMessage.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
                : 'bg-slate-900/90 border-slate-700 text-slate-200'
            }`}
          >
            {toastMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
            {toastMessage.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
            {toastMessage.type === 'info' && <Shield className="w-5 h-5 text-purple-400 shrink-0" />}
            <span className="text-sm font-medium">{toastMessage.text}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-semibold mb-2">
            <KeyRound className="w-3.5 h-3.5" />
            <span>AFF Extension Security & Licensing</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            Quản Lý Bản Quyền Extension
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Cấp phát, quản lý thời hạn và kiểm soát thiết bị đăng ký kích hoạt cho Chrome Extension.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchLicenses(true)}
            disabled={refreshing || loading}
            className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-200 font-medium text-xs md:text-sm transition-all flex items-center gap-2 hover:border-slate-600 disabled:opacity-50"
            title="Tải lại danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-purple-400' : ''}`} />
            <span>Làm mới</span>
          </button>

          <button
            onClick={() => {
              setNewlyCreatedKey(null);
              setIsCreateModalOpen(true);
            }}
            className="px-5 py-2.5 rounded-xl gradient-brand text-white font-bold text-xs md:text-sm shadow-glow hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo License Mới</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Licenses */}
        <div className="glass-card p-5 rounded-2xl border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tổng Bản Quyền</span>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <KeyRound className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-white tracking-tight">{stats.total}</div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>Bản quyền đã cấp</span>
            </div>
          </div>
        </div>

        {/* Active Licenses */}
        <div className="glass-card p-5 rounded-2xl border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Đang Hoạt Động</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-emerald-400 tracking-tight">{stats.active}</div>
            <div className="text-xs text-slate-400 mt-1">
              {stats.total > 0 ? `${Math.round((stats.active / stats.total) * 100)}% tổng số key` : 'Chưa có dữ liệu'}
            </div>
          </div>
        </div>

        {/* Registered Devices */}
        <div className="glass-card p-5 rounded-2xl border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/10 rounded-full blur-2xl group-hover:bg-sky-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Thiết Bị Kết Nối</span>
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Laptop className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-sky-400 tracking-tight">{stats.registeredDevices}</div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
              <Monitor className="w-3.5 h-3.5 text-sky-400" />
              <span>Máy trạm đã gán Token</span>
            </div>
          </div>
        </div>

        {/* Expired / Inactive */}
        <div className="glass-card p-5 rounded-2xl border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl group-hover:bg-rose-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Hết Hạn / Tạm Khóa</span>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-rose-400 tracking-tight">{stats.expiredOrInactive}</div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-rose-400" />
              <span>Cần gia hạn hoặc mở lại</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-white/10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm theo License Key (AFF-...), Tên khách hàng, Tên máy..."
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
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

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/60 rounded-xl border border-slate-800 self-start md:self-auto overflow-x-auto max-w-full">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            Tất cả ({licenses.length})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              statusFilter === 'active'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            Hoạt động ({stats.active})
          </button>
          <button
            onClick={() => setStatusFilter('expired')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              statusFilter === 'expired'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            Hết hạn ({licenses.filter(isLicenseExpired).length})
          </button>
          <button
            onClick={() => setStatusFilter('inactive')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              statusFilter === 'inactive'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            Đã khóa ({licenses.filter((l) => !l.isActive).length})
          </button>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-rose-300 text-sm">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => fetchLicenses(true)}
            className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 rounded-lg text-xs font-semibold text-rose-200 transition-colors"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Licenses Table / List */}
      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mb-4" />
            <div className="text-sm font-semibold text-white">Đang tải danh sách bản quyền...</div>
            <div className="text-xs text-slate-400 mt-1">Vui lòng chờ trong giây lát</div>
          </div>
        ) : filteredLicenses.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4">
              <KeyRound className="w-7 h-7" />
            </div>
            <div className="text-base font-bold text-white">Không tìm thấy bản quyền nào</div>
            <p className="text-xs text-slate-400 max-w-sm mt-1 mb-5">
              {searchQuery || statusFilter !== 'all'
                ? 'Không có kết quả nào khớp với bộ lọc hiện tại. Thử xóa tìm kiếm hoặc đổi trạng thái.'
                : 'Chưa có license nào được tạo trên hệ thống. Hãy tạo license đầu tiên cho khách hàng của bạn.'}
            </p>
            {searchQuery || statusFilter !== 'all' ? (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700 transition-colors"
              >
                Xóa bộ lọc
              </button>
            ) : (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-4 py-2.5 rounded-xl gradient-brand text-white text-xs font-bold shadow-glow hover:brightness-110 transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Tạo License Ngay</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-slate-950/70 border-b border-slate-800/80 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Tên & License Key</th>
                  <th className="py-3.5 px-4 font-semibold">Trạng Thái</th>
                  <th className="py-3.5 px-4 font-semibold">Thời Hạn</th>
                  <th className="py-3.5 px-4 font-semibold">Thiết Bị (Đã dùng / Max)</th>
                  <th className="py-3.5 px-4 font-semibold">Ngày Tạo</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredLicenses.map((license) => {
                  const expired = isLicenseExpired(license);
                  const daysRemaining = getDaysRemaining(license.expiresAt);
                  const isFull = license.devices.length >= license.maxDevices;
                  const isCopied = copiedKey === license.key;
                  const isToggling = togglingId === license.id;

                  return (
                    <tr
                      key={license.id}
                      className="hover:bg-slate-800/30 transition-colors group"
                    >
                      {/* Name & Key */}
                      <td className="py-4 px-4 align-middle">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">
                              {license.name || 'Chưa đặt tên'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <code className="px-2 py-1 rounded bg-slate-950/80 border border-purple-500/20 text-purple-300 font-mono text-xs select-all">
                              {license.key}
                            </code>
                            <button
                              onClick={() => handleCopyKey(license.key)}
                              className={`p-1 rounded-md transition-all ${
                                isCopied
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
                              }`}
                              title="Sao chép License Key"
                            >
                              {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 align-middle whitespace-nowrap">
                        {!license.isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-semibold text-xs">
                            <Power className="w-3.5 h-3.5" />
                            <span>Đã khóa</span>
                          </span>
                        ) : expired ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold text-xs">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>Hết hạn</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold text-xs">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Hoạt động</span>
                          </span>
                        )}
                      </td>

                      {/* Expiry */}
                      <td className="py-4 px-4 align-middle whitespace-nowrap">
                        {license.expiresAt ? (
                          <div className="flex flex-col">
                            <span className={`font-medium ${expired ? 'text-rose-400' : 'text-slate-200'}`}>
                              {formatDate(license.expiresAt)}
                            </span>
                            {expired ? (
                              <span className="text-[11px] text-rose-400/80 font-medium">Đã hết hạn</span>
                            ) : daysRemaining !== null && daysRemaining <= 7 ? (
                              <span className="text-[11px] text-amber-400 font-semibold flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Còn {daysRemaining} ngày
                              </span>
                            ) : daysRemaining !== null ? (
                              <span className="text-[11px] text-slate-400">Còn {daysRemaining} ngày</span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-300 font-medium">
                            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                            <span>Vĩnh viễn</span>
                          </span>
                        )}
                      </td>

                      {/* Devices */}
                      <td className="py-4 px-4 align-middle whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedLicenseForDevices(license)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all hover:scale-105 ${
                              isFull
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                                : license.devices.length > 0
                                ? 'bg-sky-500/10 border-sky-500/30 text-sky-300 hover:bg-sky-500/20'
                                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                            }`}
                            title="Bấm để xem danh sách thiết bị"
                          >
                            <Laptop className="w-3.5 h-3.5" />
                            <span>
                              {license.devices.length} / {license.maxDevices} máy
                            </span>
                            <ChevronRight className="w-3 h-3 text-slate-400" />
                          </button>
                        </div>
                      </td>

                      {/* Created At */}
                      <td className="py-4 px-4 align-middle text-slate-400 whitespace-nowrap">
                        {formatDate(license.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 align-middle text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Toggle Active Button */}
                          <button
                            onClick={() => handleToggleActive(license)}
                            disabled={isToggling}
                            className={`p-2 rounded-xl border transition-all ${
                              license.isActive
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-rose-500/20 hover:border-rose-500/40 hover:text-rose-300'
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-emerald-500/20 hover:border-emerald-500/40 hover:text-emerald-300'
                            }`}
                            title={license.isActive ? 'Bấm để Tạm Khóa license' : 'Bấm để Kích Hoạt lại license'}
                          >
                            <Power className={`w-4 h-4 ${isToggling ? 'animate-spin' : ''}`} />
                          </button>

                          {/* Manage Devices Button */}
                          <button
                            onClick={() => setSelectedLicenseForDevices(license)}
                            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 hover:text-white transition-all"
                            title="Quản lý thiết bị đã đăng ký"
                          >
                            <Laptop className="w-4 h-4" />
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => setLicenseToDelete(license)}
                            className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 border border-slate-700/60 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 transition-all"
                            title="Xóa License"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* MODAL: CREATE LICENSE                                                */}
      {/* ==================================================================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg glass-panel rounded-3xl border border-white/15 p-6 md:p-8 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Tạo Bản Quyền Mới</h3>
                  <p className="text-xs text-slate-400">Cấp License Key mới cho extension Chrome</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Success Banner if newly created */}
            {newlyCreatedKey ? (
              <div className="my-6 p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>License đã được tạo thành công!</span>
                </div>
                <p className="text-xs text-slate-300">
                  Gửi mã bản quyền bên dưới cho khách hàng để kích hoạt extension:
                </p>
                <div className="flex items-center gap-2 p-3 bg-slate-950/90 rounded-xl border border-emerald-500/40">
                  <code className="text-sm font-mono text-emerald-300 font-bold flex-1 select-all break-all">
                    {newlyCreatedKey}
                  </code>
                  <button
                    onClick={() => handleCopyKey(newlyCreatedKey)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shrink-0"
                  >
                    {copiedKey === newlyCreatedKey ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Đã copy</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Key</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    onClick={() => setNewlyCreatedKey(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
                  >
                    Tạo thêm license khác
                  </button>
                  <button
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 rounded-xl gradient-brand text-xs font-bold text-white transition-colors"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateLicense} className="mt-6 space-y-5">
                {/* Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Tên Khách Hàng / Ghi Chú
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      placeholder="Ví dụ: Hoàng Minh (VIP 1 Năm) hoặc Shop ABC"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                    />
                  </div>
                </div>

                {/* Max Devices */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Số Thiết Bị Tối Đa Cho Phép (Max Devices)
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <Laptop className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="number"
                        min={1}
                        max={100}
                        required
                        value={createMaxDevices}
                        onChange={(e) => setCreateMaxDevices(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-sm text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-mono"
                      />
                    </div>
                    {/* Presets */}
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 5, 10].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setCreateMaxDevices(val)}
                          className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                            createMaxDevices === val
                              ? 'bg-purple-600 border-purple-500 text-white'
                              : 'bg-slate-900 border-slate-700/80 text-slate-400 hover:text-white hover:bg-slate-800'
                          }`}
                        >
                          {val} máy
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Mỗi khi người dùng đăng nhập trên Chrome mới, hệ thống sẽ gán 1 thiết bị cho tới giới hạn này.
                  </p>
                </div>

                {/* Expiry Options */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Thời Hạn Bản Quyền
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setCreateExpiryOption('permanent')}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                        createExpiryOption === 'permanent'
                          ? 'bg-purple-600/20 border-purple-500 text-white shadow-sm'
                          : 'bg-slate-900/80 border-slate-700/80 text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold text-purple-400">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Vĩnh viễn</span>
                      </div>
                      <span className="text-[11px] text-slate-400">Không bao giờ hết hạn</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCreateExpiryOption('30days')}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                        createExpiryOption === '30days'
                          ? 'bg-purple-600/20 border-purple-500 text-white shadow-sm'
                          : 'bg-slate-900/80 border-slate-700/80 text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span>30 Ngày</span>
                      </div>
                      <span className="text-[11px] text-slate-400">Gói 1 tháng</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCreateExpiryOption('90days')}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                        createExpiryOption === '90days'
                          ? 'bg-purple-600/20 border-purple-500 text-white shadow-sm'
                          : 'bg-slate-900/80 border-slate-700/80 text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span>90 Ngày</span>
                      </div>
                      <span className="text-[11px] text-slate-400">Gói 3 tháng (Quý)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCreateExpiryOption('1year')}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                        createExpiryOption === '1year'
                          ? 'bg-purple-600/20 border-purple-500 text-white shadow-sm'
                          : 'bg-slate-900/80 border-slate-700/80 text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>1 Năm</span>
                      </div>
                      <span className="text-[11px] text-slate-400">Gói thường niên (365d)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCreateExpiryOption('custom')}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1 col-span-2 sm:col-span-2 ${
                        createExpiryOption === 'custom'
                          ? 'bg-purple-600/20 border-purple-500 text-white shadow-sm'
                          : 'bg-slate-900/80 border-slate-700/80 text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold text-pink-400">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Tùy Chọn Ngày</span>
                      </div>
                      <span className="text-[11px] text-slate-400">Chọn ngày hết hạn cụ thể</span>
                    </button>
                  </div>

                  {/* Custom Date Input */}
                  {createExpiryOption === 'custom' && (
                    <div className="mt-3 p-3 rounded-xl bg-slate-900/90 border border-slate-700 animate-in fade-in duration-200">
                      <label className="block text-xs text-slate-400 mb-1.5">Ngày & giờ hết hạn:</label>
                      <input
                        type="datetime-local"
                        required={createExpiryOption === 'custom'}
                        value={createCustomDate}
                        onChange={(e) => setCreateCustomDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                      />
                    </div>
                  )}
                </div>

                {/* Footer Buttons */}
                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs md:text-sm transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="px-5 py-2.5 rounded-xl gradient-brand text-white font-bold text-xs md:text-sm shadow-glow hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {isCreating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Đang tạo...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Tạo License Key</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: REGISTERED DEVICES MANAGEMENT                                */}
      {/* ==================================================================== */}
      {selectedLicenseForDevices && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl glass-panel rounded-3xl border border-white/15 p-6 md:p-8 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                  <Laptop className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>Thiết Bị Đã Đăng Ký</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                      {selectedLicenseForDevices.devices.length} / {selectedLicenseForDevices.maxDevices} máy
                    </span>
                  </h3>
                  <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                    <span>{selectedLicenseForDevices.name || 'License'}</span>
                    <span>•</span>
                    <code className="text-purple-300 font-mono">{selectedLicenseForDevices.key}</code>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedLicenseForDevices(null)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="my-6">
              {selectedLicenseForDevices.devices.length === 0 ? (
                <div className="p-10 text-center rounded-2xl bg-slate-950/60 border border-slate-800">
                  <Monitor className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                  <div className="text-sm font-semibold text-white">Chưa có thiết bị nào kích hoạt</div>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
                    Khi người dùng nhập License Key trên Chrome Extension, thiết bị sẽ tự động được ghi nhận tại đây.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {selectedLicenseForDevices.devices.map((device, idx) => (
                    <div
                      key={device.id}
                      className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/90 flex items-center justify-between gap-4 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                          <Laptop className="w-4 h-4 text-sky-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm truncate">
                              {device.deviceName || `Thiết bị #${idx + 1}`}
                            </span>
                            <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Đã xác thực
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span>
                              Token: <code className="font-mono text-slate-300">{device.deviceToken.substring(0, 16)}...</code>
                            </span>
                            <span>•</span>
                            <span>Hoạt động: {formatRelativeTime(device.lastSeenAt)}</span>
                            <span>•</span>
                            <span>Đăng ký: {formatDate(device.createdAt)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Unbind Button */}
                      <button
                        onClick={() => handleDeleteDevice(selectedLicenseForDevices.id, device.id)}
                        disabled={deletingDeviceId === device.id}
                        className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                        title="Gỡ thiết bị khỏi bản quyền để giải phóng 1 slot"
                      >
                        {deletingDeviceId === device.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        <span>Gỡ thiết bị</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs text-slate-400">
              <div>
                Gỡ thiết bị sẽ thu hồi quyền đăng nhập của máy đó trong lần kiểm tra tiếp theo.
              </div>
              <button
                onClick={() => setSelectedLicenseForDevices(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: DELETE LICENSE CONFIRMATION                                  */}
      {/* ==================================================================== */}
      {licenseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md glass-panel rounded-3xl border border-rose-500/30 p-6 shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 text-rose-400 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Xác Nhận Xóa Bản Quyền</h3>
                <p className="text-xs text-slate-400">Hành động này không thể khôi phục lại</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Bạn có chắc chắn muốn xóa bản quyền <strong className="text-white">{licenseToDelete.name || licenseToDelete.key}</strong>?
              {licenseToDelete.devices.length > 0 && (
                <span className="block mt-2 text-rose-300">
                  ⚠️ Toàn bộ <strong className="text-white">{licenseToDelete.devices.length} thiết bị</strong> đang kết nối với license này sẽ bị đăng xuất ngay lập tức.
                </span>
              )}
            </p>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setLicenseToDelete(null)}
                disabled={isDeletingLicense}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleDeleteLicense}
                disabled={isDeletingLicense}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-glow-rose active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isDeletingLicense ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Xóa Vĩnh Viễn</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

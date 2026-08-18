'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, ScanLine, ShieldCheck, Menu, Link2, Puzzle, Download } from 'lucide-react';
import { InstallExtensionModal } from '../extension/InstallExtensionModal';

interface HeaderProps {
  onOpenMobileMenu?: () => void;
}

export function Header({ onOpenMobileMenu }: HeaderProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [isExtConnected, setIsExtConnected] = useState<boolean>(false);
  const [showInstallModal, setShowInstallModal] = useState<boolean>(false);
  const [showDeviceDetailsModal, setShowDeviceDetailsModal] = useState<boolean>(false);
  const [extensionInfo, setExtensionInfo] = useState<{
    installed: boolean;
    ready: boolean;
    deviceToken: string | null;
    licenseKey: string | null;
    licenseName: string | null;
    expiresAt: string | null;
    version: string;
  } | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      if (data.extension === 'connected') {
        setIsExtConnected(true);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.data?.type === 'AFF_EXTENSION_HANDSHAKE' || event.data?.type === 'AFF_EXTENSION_INSTALLED' || event.data?.type === 'AFF_PONG_EXTENSION') {
        const data = event.data;
        setIsExtConnected(true);
        setExtensionInfo({
          installed: true,
          ready: Boolean(data.ready),
          deviceToken: data.deviceToken || null,
          licenseKey: data.licenseKey || null,
          licenseName: data.licenseName || null,
          expiresAt: data.expiresAt || null,
          version: data.version || '1.8.2',
        });
      }
    };

    window.addEventListener('message', handleMessage);

    // Actively ping extension on current page
    window.postMessage({ type: 'AFF_PING_EXTENSION' }, '*');
    const pingTimer = setTimeout(() => {
      window.postMessage({ type: 'AFF_PING_EXTENSION' }, '*');
    }, 1200);

    return () => {
      clearInterval(interval);
      clearTimeout(pingTimer);
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/library?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleBadgeClick = () => {
    if (extensionInfo?.installed) {
      setShowDeviceDetailsModal(true);
    } else {
      setShowInstallModal(true);
    }
  };

  return (
    <>
      <header className="h-16 glass-panel border-b border-slate-800/80 sticky top-0 z-30 px-3 sm:px-6 flex items-center justify-between gap-2">
        {/* Mobile Hamburger & Logo */}
        <div className="flex items-center gap-2.5 md:hidden">
          <button
            onClick={onOpenMobileMenu}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors active:scale-95"
            aria-label="Mở Menu Mobile"
          >
            <Menu className="w-6 h-6" />
          </button>

          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center shadow-glow">
              <Link2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold text-sm text-white tracking-tight">
              AFF <span className="gradient-text">HUB</span>
            </span>
          </Link>
        </div>

        {/* Global Search Bar (Responsive) */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-[180px] sm:max-w-xs md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm sản phẩm..."
            className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-all"
          />
          <button type="submit" className="hidden">Search</button>
        </form>

        {/* Action Buttons & Status */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Clickable Extension Connection Badge with Live Device & License Details */}
          <button
            onClick={handleBadgeClick}
            title={extensionInfo?.installed ? 'Bấm để xem thông tin máy & bản quyền đang kết nối' : 'Bấm để tải & cài đặt Extension'}
            className={`flex items-center gap-2 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl border text-[11px] sm:text-xs font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm ${
              extensionInfo?.installed
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                : isExtConnected
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                  : 'bg-gradient-to-r from-purple-900/40 to-amber-900/30 border-amber-500/40 text-amber-300 hover:border-amber-400'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${extensionInfo?.installed || isExtConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
            <span className="hidden lg:inline">
              {extensionInfo?.installed
                ? `Extension: ${extensionInfo.licenseName || (extensionInfo.deviceToken ? `${extensionInfo.deviceToken.slice(0, 10)}...` : 'Sẵn sàng')}`
                : isExtConnected
                  ? 'Extension ● Đã kết nối'
                  : '📥 Tải Extension'}
            </span>
            <span className="lg:hidden">
              {extensionInfo?.installed ? (extensionInfo.ready ? 'Ext Sẵn sàng' : 'Ext Chưa kích hoạt') : isExtConnected ? 'Ext On' : 'Cài Ext'}
            </span>
          </button>

          {/* Quick Shop Scanner CTA */}
          <button
            onClick={() => router.push('/scanner')}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl gradient-shopee text-white font-medium text-xs shadow-glow hover:brightness-110 active:scale-95 transition-all flex-shrink-0"
          >
            <ScanLine className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">QUÉT SHOP MỚI</span>
            <span className="sm:hidden font-bold">QUÉT</span>
          </button>

          {/* Profile / Account Badge */}
          <div className="flex items-center gap-2 sm:gap-3 pl-1 sm:pl-2 border-l border-slate-800 flex-shrink-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shadow-md">
              CR
            </div>
            <div className="hidden xl:block text-left">
              <div className="text-xs font-semibold text-white flex items-center gap-1">
                Creator Pro <ShieldCheck className="w-3 h-3 text-emerald-400" />
              </div>
              <div className="text-[10px] text-slate-400">Shopee Affiliate</div>
            </div>
          </div>
        </div>
      </header>

      {/* Extension Install Modal */}
      <InstallExtensionModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        isConnected={isExtConnected}
      />

      {/* Connected Extension Device & License Details Modal */}
      {showDeviceDetailsModal && extensionInfo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Extension Đang Kết Nối</h3>
                  <p className="text-[11px] text-slate-400">Thiết bị cục bộ trên trình duyệt này</p>
                </div>
              </div>
              <button
                onClick={() => setShowDeviceDetailsModal(false)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mã Thiết Bị (Device Token)</p>
                <p className="text-xs font-mono font-bold text-cyan-400 break-all">
                  {extensionInfo.deviceToken || 'Chưa định danh'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bản Quyền (License Key)</p>
                <p className="text-xs font-mono font-bold text-violet-400">
                  {extensionInfo.licenseKey || 'Chưa kích hoạt key'}
                </p>
                {extensionInfo.licenseName && (
                  <p className="text-[11px] text-slate-300 font-medium">
                    👤 Chủ sở hữu: <span className="font-bold text-white">{extensionInfo.licenseName}</span>
                  </p>
                )}
                <p className="text-[11px] text-slate-400">
                  📅 Hạn dùng: <span className="text-emerald-400 font-bold">{extensionInfo.expiresAt ? new Date(extensionInfo.expiresAt).toLocaleDateString('vi-VN') : 'Vĩnh viễn'}</span>
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 flex items-center gap-3 text-xs text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span>Mọi lệnh thao tác (Quét shop, Tạo video) từ tab này sẽ gửi trực tiếp đến Extension trên máy này.</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
              <Link
                href="/admin/licenses"
                onClick={() => setShowDeviceDetailsModal(false)}
                className="text-violet-400 hover:text-violet-300 font-semibold hover:underline"
              >
                Quản lý tất cả License →
              </Link>
              <button
                onClick={() => setShowDeviceDetailsModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

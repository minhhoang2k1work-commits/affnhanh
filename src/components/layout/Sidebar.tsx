'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  ScanLine, 
  ShoppingBag, 
  Video, 
  FolderHeart, 
  Store, 
  KeyRound, 
  Settings,
  Sparkles,
  Link2,
  Zap,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  {
    name: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    badge: 'Live',
  },
  {
    name: 'Quét Shop (Scanner)',
    href: '/scanner',
    icon: ScanLine,
    badge: 'Core',
    highlight: true,
  },
  {
    name: 'Tạo Link Rút Gọn',
    href: '/link-generator',
    icon: Link2,
    badge: 'Mới',
    highlight: true,
  },
  {
    name: 'Thư Viện Sản Phẩm',
    href: '/library',
    icon: ShoppingBag,
  },
  {
    name: 'Link Cho Video',
    href: '/videos',
    icon: Video,
    badge: 'Sub-ID',
  },
  {
    name: 'Bộ Sưu Tập (Collections)',
    href: '/collections',
    icon: FolderHeart,
  },
  {
    name: 'Quản Lý Shop',
    href: '/shops',
    icon: Store,
    badge: 'Sync',
  },
  {
    name: 'Accesstrade Hub',
    href: '/accesstrade',
    icon: Zap,
    badge: 'API Live',
    highlight: true,
  },
  {
    name: 'Tài Khoản Affiliate',
    href: '/accounts',
    icon: KeyRound,
  },
  {
    name: 'Cài Đặt Shopee',
    href: '/settings/shopee',
    icon: Settings,
    badge: 'Status',
  },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [dbStatus, setDbStatus] = useState<'connected' | 'error' | 'checking'>('checking');
  const [affStatus, setAffStatus] = useState<boolean>(false);
  const [extStatus, setExtStatus] = useState<string>('not_connected');

  // Close mobile drawer on route change
  useEffect(() => {
    if (onClose) {
      onClose();
    }
  }, [pathname]);

  useEffect(() => {
    // Real DB Health Check & Extension Health Check
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.database === 'connected') {
          setDbStatus('connected');
        } else {
          setDbStatus('error');
        }
        if (data.extension === 'connected') {
          setExtStatus('connected');
        } else {
          setExtStatus('not_connected');
        }
      })
      .catch(() => {
        setDbStatus('error');
        setExtStatus('not_connected');
      });

    fetch('/api/dashboard/summary')
      .then((res) => res.json())
      .then((data) => {
        if (data?.integrationStatus?.affiliateDeepLink?.connected) {
          setAffStatus(true);
        }
      })
      .catch(() => setAffStatus(false));
  }, []);

  const SidebarContent = () => (
    <div className="flex flex-col h-full select-none">
      {/* App Logo */}
      <div className="p-6 border-b border-slate-800/80 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group" onClick={onClose}>
          <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center shadow-glow group-hover:scale-105 transition-transform duration-200">
            <Link2 className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="font-extrabold text-lg text-white tracking-tight flex items-center gap-1.5">
              AFF <span className="gradient-text">HUB</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">Link Automation</p>
          </div>
        </Link>

        {/* Mobile Drawer Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/80 transition-colors"
            aria-label="Đóng Menu"
          >
            <X className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Quick Creator Badge */}
      <div className="px-4 py-3 mx-4 my-3 rounded-xl bg-gradient-to-r from-violet-900/30 to-purple-900/20 border border-violet-500/20 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-violet-500/20 text-violet-400">
          <Zap className="w-4 h-4" />
        </div>
        <div className="text-xs">
          <p className="font-semibold text-violet-200">Affiliate Mode</p>
          <p className="text-violet-400/80 text-[11px]">1-Click DeepLink Active</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        <div className="px-3 mb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Menu Chính
        </div>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative',
                isActive
                  ? 'bg-gradient-to-r from-violet-600/90 to-purple-600/80 text-white shadow-lg shadow-purple-900/30 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className={cn('w-4 h-4 transition-transform group-hover:scale-110', isActive ? 'text-white' : 'text-slate-400 group-hover:text-purple-400')} />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span
                  className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider',
                    isActive
                      ? 'bg-white/20 text-white'
                      : item.highlight
                      ? 'bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-400'
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Footer - Real Dynamic Health Status Badges */}
      <div className="p-4 border-t border-slate-800/80 space-y-2">
        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Database:</span>
            {dbStatus === 'connected' ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Connected
              </span>
            ) : dbStatus === 'error' ? (
              <span className="text-rose-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Error
              </span>
            ) : (
              <span className="text-slate-500">Checking...</span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Extension Bridge:</span>
            <span className={extStatus === 'connected' ? 'text-emerald-400 font-bold flex items-center gap-1' : 'text-amber-300 font-bold'}>
              {extStatus === 'connected' ? '● Connected' : '○ Not Connected'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Shopee Affiliate:</span>
            <span className={affStatus ? 'text-emerald-400 font-bold' : 'text-amber-300 font-bold'}>
              {affStatus ? 'Connected' : 'Unconfigured'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (hidden on mobile) */}
      <aside className="hidden md:flex w-64 glass-panel border-r border-slate-800 flex-col h-screen sticky top-0 z-40">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer (visible on mobile when isOpen is true) */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop Blur Overlay */}
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity animate-fade-in"
            onClick={onClose}
          />

          {/* Drawer Body */}
          <aside className="relative w-80 max-w-[85vw] bg-slate-950 border-r border-slate-800 shadow-2xl flex flex-col h-full z-10 overflow-hidden">
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  );
}

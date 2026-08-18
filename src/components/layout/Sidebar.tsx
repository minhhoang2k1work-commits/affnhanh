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
  Link2,
  Zap,
  X,
  Clapperboard,
  Workflow,
  Film,
  Coins,
  ChevronDown,
  Boxes,
  Bot,
  SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navGroups = [
  {
    id: 'overview',
    name: 'Tổng quan',
    icon: LayoutDashboard,
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard, badge: 'Live' },
      { name: 'Tra Cứu Hoa Hồng', href: '/quick-lookup', icon: Coins, badge: 'Live HH', highlight: true },
    ],
  },
  {
    id: 'products',
    name: 'Sản phẩm & Shop',
    icon: Boxes,
    items: [
      { name: 'Quét Shop (Scanner)', href: '/scanner', icon: ScanLine, badge: 'Core', highlight: true },
      { name: 'Thư Viện Sản Phẩm', href: '/library', icon: ShoppingBag },
      { name: 'Bộ Sưu Tập', href: '/collections', icon: FolderHeart },
      { name: 'Quản Lý Shop', href: '/shops', icon: Store, badge: 'Sync' },
      { name: 'Cài Đặt Shopee', href: '/settings/shopee', icon: Settings, badge: 'Status' },
    ],
  },
  {
    id: 'affiliate',
    name: 'Link & Affiliate',
    icon: Link2,
    items: [
      { name: 'Tạo Link Rút Gọn', href: '/link-generator', icon: Link2, badge: 'Mới', highlight: true },
      { name: 'Link Cho Video', href: '/videos', icon: Video, badge: 'Sub-ID' },
      { name: 'Accesstrade Hub', href: '/accesstrade', icon: Zap, badge: 'API Live', highlight: true },
      { name: 'Tài Khoản Affiliate', href: '/accounts', icon: KeyRound },
    ],
  },
  {
    id: 'ai',
    name: 'AI & Tự động hóa',
    icon: Bot,
    accent: true,
    items: [
      { name: 'AI Video Studio', href: '/ai-video', icon: Clapperboard, badge: 'AI', highlight: true },
      { name: 'Thư Viện Video', href: '/ai-video/library', icon: Film },
      { name: 'Quy trình tự động hóa', href: '/flows', icon: Workflow, badge: 'Auto' },
      { name: 'Cài AI & Link ChatGPT', href: '/ai-settings#video-automation', icon: SlidersHorizontal, badge: 'Cài đặt', highlight: true },
    ],
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
  const activeGroupId = navGroups.find((group) => group.items.some((item) =>
    item.href.split('#')[0] === pathname || (item.href !== '/' && pathname.startsWith(`${item.href.split('#')[0]}/`))
  ))?.id || 'overview';
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => ({ [activeGroupId]: true }));

  // Close mobile drawer on route change
  useEffect(() => {
    if (onClose) {
      onClose();
    }
    setOpenGroups((current) => ({ ...current, [activeGroupId]: true }));
  }, [pathname, activeGroupId, onClose]);

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
      <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
        <div className="px-3 mb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Chức năng
        </div>
        {navGroups.map((group) => {
          const GroupIcon = group.icon;
          const isOpen = Boolean(openGroups[group.id]);
          const hasActiveItem = group.id === activeGroupId;
          return (
            <div key={group.id} className={cn('rounded-xl border transition-colors', hasActiveItem ? 'border-violet-500/25 bg-violet-950/10' : 'border-transparent')}>
              <button
                type="button"
                onClick={() => setOpenGroups((current) => ({ ...current, [group.id]: !current[group.id] }))}
                className={cn(
                  'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all',
                  group.accent ? 'text-amber-300 hover:bg-amber-500/10' : 'text-slate-200 hover:bg-slate-800/70',
                  hasActiveItem && (group.accent ? 'bg-amber-500/10' : 'bg-violet-500/10'),
                )}
                aria-expanded={isOpen}
              >
                <span className="flex items-center gap-3">
                  <GroupIcon className={cn('w-4 h-4', group.accent ? 'text-amber-400' : hasActiveItem ? 'text-violet-400' : 'text-slate-500')} />
                  {group.name}
                </span>
                <ChevronDown className={cn('w-4 h-4 text-slate-500 transition-transform duration-200', isOpen && 'rotate-180')} />
              </button>

              {isOpen && (
                <div className="px-1.5 pb-1.5 space-y-1">
                  {group.items.map((item) => {
                    const itemPath = item.href.split('#')[0];
                    const isActive = pathname === itemPath || (itemPath !== '/' && pathname.startsWith(`${itemPath}/`));
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          'flex items-center justify-between gap-2 pl-7 pr-2.5 py-2 rounded-lg text-[13px] font-medium transition-all group',
                          isActive
                            ? group.accent
                              ? 'bg-gradient-to-r from-amber-600/80 to-orange-600/70 text-white shadow-md shadow-orange-950/20'
                              : 'bg-gradient-to-r from-violet-600/90 to-purple-600/80 text-white shadow-md shadow-purple-950/20'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/60',
                        )}
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <Icon className={cn('w-3.5 h-3.5 shrink-0', isActive ? 'text-white' : 'text-slate-500 group-hover:text-violet-300')} />
                          <span className="leading-tight">{item.name}</span>
                        </span>
                        {item.badge && (
                          <span className={cn(
                            'shrink-0 text-[8px] px-1.5 py-0.5 rounded-full font-extrabold uppercase tracking-wide',
                            isActive ? 'bg-white/20 text-white' : item.highlight ? 'bg-orange-500/90 text-white' : 'bg-slate-800 text-slate-500',
                          )}>
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
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

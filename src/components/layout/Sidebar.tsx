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
  AlertCircle
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

export function Sidebar() {
  const pathname = usePathname();
  const [dbStatus, setDbStatus] = useState<'connected' | 'error' | 'checking'>('checking');
  const [affStatus, setAffStatus] = useState<boolean>(false);

  useEffect(() => {
    // Real DB Health Check (Section 5 & Task 8)
    fetch('/api/health/database')
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'connected') {
          setDbStatus('connected');
        } else {
          setDbStatus('error');
        }
      })
      .catch(() => setDbStatus('error'));

    fetch('/api/dashboard/summary')
      .then((res) => res.json())
      .then((data) => {
        if (data?.integrationStatus?.affiliateDeepLink?.connected) {
          setAffStatus(true);
        }
      })
      .catch(() => setAffStatus(false));
  }, []);

  return (
    <aside className="w-64 glass-panel border-r border-slate-800 flex flex-col h-screen sticky top-0 z-40 select-none">
      {/* App Logo */}
      <div className="p-6 border-b border-slate-800/80 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
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

      {/* Bottom Footer - Real Dynamic Health Status Badges (Section 8 Requirement) */}
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
    </aside>
  );
}

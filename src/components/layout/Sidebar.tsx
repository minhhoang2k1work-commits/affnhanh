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
  CalendarDays,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDialogFocus } from '@/lib/ui/use-dialog-focus';

const navGroups: { id: string; name: string; icon: typeof LayoutDashboard; accent?: boolean; items: { name: string; href: string; icon: typeof LayoutDashboard; badge?: string; highlight?: boolean }[] }[] = [
  { id: 'work', name: 'Công việc hằng ngày', icon: Clapperboard, items: [
    { name: 'Tổng quan', href: '/', icon: LayoutDashboard },
    { name: 'Chọn sản phẩm', href: '/library', icon: ShoppingBag },
    { name: 'Tạo video', href: '/ai-video', icon: Clapperboard },
    { name: 'Duyệt & đăng bài', href: '/publishing', icon: CalendarDays },
    { name: 'Video thành phẩm', href: '/ai-video/library', icon: Film },
    { name: 'Tiến độ & lỗi', href: '/flows', icon: Workflow },
  ] },
  { id: 'products', name: 'Nguồn sản phẩm', icon: Boxes, items: [
    { name: 'Thêm từ shop', href: '/scanner', icon: ScanLine },
    { name: 'Tra cứu hoa hồng', href: '/quick-lookup', icon: Coins },
    { name: 'Ngành hàng & nội dung', href: '/industries', icon: Boxes },
    { name: 'Bộ sưu tập', href: '/collections', icon: FolderHeart },
    { name: 'Shop đã lưu', href: '/shops', icon: Store },
  ] },
  { id: 'settings', name: 'Kết nối & cài đặt', icon: Settings, items: [
    { name: 'AI & ChatGPT', href: '/ai-settings', icon: SlidersHorizontal },
    { name: 'Duyệt qua Telegram', href: '/telegram', icon: Bot },
    { name: 'Tài khoản affiliate', href: '/accounts', icon: KeyRound },
    { name: 'Shopee & tiện ích Chrome', href: '/settings/shopee', icon: Settings },
    { name: 'Bản quyền tiện ích', href: '/admin/licenses', icon: KeyRound },
  ] },
  { id: 'tools', name: 'Công cụ bổ sung', icon: Link2, items: [
    { name: 'Tạo link rút gọn', href: '/link-generator', icon: Link2 },
    { name: 'Link theo video', href: '/videos', icon: Video },
    { name: 'Accesstrade', href: '/accesstrade', icon: Zap },
  ] },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const drawerRef = useDialogFocus(isOpen, () => onClose?.());
  const [dbStatus, setDbStatus] = useState<'connected' | 'error' | 'checking'>('checking');
  const [affStatus, setAffStatus] = useState<boolean>(false);
  const [extStatus, setExtStatus] = useState<string>('not_connected');
  const activeHref = navGroups.flatMap(group => group.items).filter(item => pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'))).sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const activeGroupId = navGroups.find(group => group.items.some(item => item.href === activeHref))?.id || 'work';
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => ({ work: true, [activeGroupId]: true }));

  // Close mobile drawer on route change
  useEffect(() => {
    if (onClose) {
      onClose();
    }
    setOpenGroups((current) => ({ ...current, [activeGroupId]: true }));
  }, [pathname, activeGroupId, onClose]);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch('/api/health', { signal: AbortSignal.timeout(12000) });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!active) return;
        setDbStatus(data.database === 'connected' ? 'connected' : 'error');
        setExtStatus(data.extension === 'connected' ? 'connected' : 'not_connected');
        setAffStatus(data.shopeeAffiliate === 'connected');
      } catch { if (active) { setDbStatus('error'); setExtStatus('not_connected'); setAffStatus(false); } }
    };
    void refresh();
    const timer = setInterval(() => { if (!document.hidden) void refresh(); }, 30000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  const sidebarContent = (
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
            <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">Video affiliate</p>
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
          <p className="font-semibold text-violet-200">Bạn duyệt trước khi đăng</p>
          <p className="text-violet-400/80 text-[11px]">Sản phẩm → video → Page</p>
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
                    
                    const isActive = item.href === activeHref;
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
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
            <span className="text-slate-400">Dữ liệu AFF:</span>
            {dbStatus === 'connected' ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Đã kết nối
              </span>
            ) : dbStatus === 'error' ? (
              <span className="text-rose-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Cần kiểm tra
              </span>
            ) : (
              <span className="text-slate-500">Đang kiểm tra…</span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Tiện ích Chrome:</span>
            <span className={extStatus === 'connected' ? 'text-emerald-400 font-bold flex items-center gap-1' : 'text-amber-300 font-bold'}>
              {extStatus === 'connected' ? '● Đã kết nối' : 'Chưa kết nối'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Shopee Affiliate:</span>
            <span className={affStatus ? 'text-emerald-400 font-bold' : 'text-amber-300 font-bold'}>
              {affStatus ? 'Đã cấu hình' : 'Chưa xác minh'}
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
        {sidebarContent}
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
          <aside ref={drawerRef} role="dialog" aria-modal="true" aria-label="Điều hướng AFF" tabIndex={-1} className="relative w-80 max-w-[85vw] bg-slate-950 border-r border-slate-800 shadow-2xl flex flex-col h-full z-10 overflow-hidden">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}

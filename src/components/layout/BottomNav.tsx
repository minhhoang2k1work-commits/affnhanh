'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  ScanLine, 
  ShoppingBag, 
  Zap, 
  Menu 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BottomNavProps {
  onOpenMobileMenu: () => void;
}

export function BottomNav({ onOpenMobileMenu }: BottomNavProps) {
  const pathname = usePathname();

  const navItems = [
    {
      name: 'Dashboard',
      href: '/',
      icon: LayoutDashboard,
    },
    {
      name: 'Thư Viện',
      href: '/library',
      icon: ShoppingBag,
    },
    {
      name: 'Quét Shop',
      href: '/scanner',
      icon: ScanLine,
      isSpecial: true,
    },
    {
      name: 'Accesstrade',
      href: '/accesstrade',
      icon: Zap,
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/90 backdrop-blur-xl border-t border-slate-800/80 px-2 py-1.5 flex items-center justify-around shadow-2xl">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;

        if (item.isSpecial) {
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center relative -top-3 group"
            >
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform active:scale-90",
                isActive 
                  ? "gradient-shopee text-white shadow-orange-900/50 ring-2 ring-orange-400/50" 
                  : "gradient-brand text-white shadow-purple-900/50 group-hover:scale-105"
              )}>
                <Icon className="w-6 h-6 animate-pulse" />
              </div>
              <span className="text-[10px] font-bold text-slate-200 mt-1">
                {item.name}
              </span>
            </Link>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center px-3 py-1 rounded-xl transition-all duration-150",
              isActive 
                ? "text-purple-400 font-bold" 
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            <Icon className={cn("w-5 h-5 mb-0.5", isActive && "text-purple-400 scale-110")} />
            <span className="text-[10px] font-medium tracking-tight">
              {item.name}
            </span>
          </Link>
        );
      })}

      {/* Menu Drawer Toggle Button */}
      <button
        onClick={onOpenMobileMenu}
        type="button"
        className="flex flex-col items-center justify-center px-3 py-1 rounded-xl text-slate-400 hover:text-slate-200 transition-all duration-150 active:scale-95"
      >
        <Menu className="w-5 h-5 mb-0.5" />
        <span className="text-[10px] font-medium tracking-tight">Tất Cả</span>
      </button>
    </nav>
  );
}

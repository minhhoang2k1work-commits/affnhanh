'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, ScanLine, ShieldCheck, Menu, Link2 } from 'lucide-react';

interface HeaderProps {
  onOpenMobileMenu?: () => void;
}

export function Header({ onOpenMobileMenu }: HeaderProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [isExtConnected, setIsExtConnected] = useState<boolean>(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setIsExtConnected(data.extension === 'connected');
    } catch (err) {
      setIsExtConnected(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/library?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
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
        {/* Real Extension Connection Badge */}
        <div
          className={`hidden sm:flex items-center gap-2 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border text-[11px] sm:text-xs font-semibold transition-all ${
            isExtConnected
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isExtConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
          <span className="hidden lg:inline">Extension {isExtConnected ? '● Connected' : '○ Not Connected'}</span>
          <span className="lg:hidden">{isExtConnected ? 'Ext On' : 'Ext Off'}</span>
        </div>

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
  );
}

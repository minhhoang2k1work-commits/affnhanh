'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ScanLine, Bell, ShieldCheck, Sparkles, Store } from 'lucide-react';

export function Header() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/library?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="h-16 glass-panel border-b border-slate-800/80 sticky top-0 z-30 px-6 flex items-center justify-between">
      {/* Global Search Bar */}
      <form onSubmit={handleSearchSubmit} className="relative w-96">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm sản phẩm (bình nước, nồi chiên, son...)"
          className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-all"
        />
        <button type="submit" className="hidden">Search</button>
      </form>

      {/* Action Buttons & Status */}
      <div className="flex items-center gap-4">
        {/* Monitored Shops Counter */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs text-slate-300">
          <Store className="w-3.5 h-3.5 text-purple-400" />
          <span>Shopee Adapter Active</span>
        </div>

        {/* Quick Shop Scanner CTA */}
        <button
          onClick={() => router.push('/scanner')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-shopee text-white font-medium text-xs shadow-glow hover:brightness-110 active:scale-95 transition-all"
        >
          <ScanLine className="w-4 h-4" />
          <span>QUÉT SHOP MOI</span>
        </button>

        {/* Profile / Account Badge */}
        <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shadow-md">
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

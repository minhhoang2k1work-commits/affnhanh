'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ScanLine, ShieldCheck, Zap } from 'lucide-react';

export function Header() {
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
        {/* Real Extension Connection Badge (Requirement 16) */}
        <div
          className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
            isExtConnected
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isExtConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
          <span>Extension {isExtConnected ? '● Connected' : '○ Not Connected'}</span>
        </div>

        {/* Quick Shop Scanner CTA */}
        <button
          onClick={() => router.push('/scanner')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-shopee text-white font-medium text-xs shadow-glow hover:brightness-110 active:scale-95 transition-all"
        >
          <ScanLine className="w-4 h-4" />
          <span>QUÉT SHOP MỚI</span>
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

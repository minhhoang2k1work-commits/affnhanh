'use client';

import React, { useCallback, useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const closeMobileMenu = useCallback(() => setIsMobileMenuOpen(false), []);
  const openMobileMenu = useCallback(() => setIsMobileMenuOpen(true), []);

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen flex antialiased relative">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-violet-600 focus:px-4 focus:py-3 focus:text-white">Đến nội dung chính</a>
      {/* Sidebar - Desktop Sticky & Mobile Drawer */}
      <Sidebar 
        isOpen={isMobileMenuOpen} 
        onClose={closeMobileMenu}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <Header onOpenMobileMenu={openMobileMenu} />
        <main id="main-content" tabIndex={-1} className="flex-1 p-4 sm:p-6 md:p-8 pb-28 md:pb-8 overflow-y-auto max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav onOpenMobileMenu={openMobileMenu} />
    </div>
  );
}

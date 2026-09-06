'use client';

import React, { useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, ShieldCheck } from 'lucide-react';
import { useEffect } from 'react';

interface AdminLayoutShellProps {
  isAuthenticated: boolean;
  children: React.ReactNode;
}

export function AdminLayoutShell({ isAuthenticated, children }: AdminLayoutShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === '/admin/login';

  // Redirect to login if not authenticated and not on login page
  useEffect(() => {
    if (!isAuthenticated && !isLoginPage) {
      router.replace('/admin/login');
    }
  }, [isAuthenticated, isLoginPage, router]);

  // If on login page, render children directly (login page has its own layout)
  if (isLoginPage) {
    return <>{children}</>;
  }

  // If not authenticated, show nothing (redirect is happening)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      {/* Admin Top Bar */}
      <div className="sticky top-0 z-50 bg-slate-900/95 border-b border-slate-800 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-medium text-indigo-400 uppercase tracking-wider">
              Admin Panel
            </span>
          </div>
          <AdminLogoutButton />
        </div>
      </div>
      {children}
    </>
  );
}

function AdminLogoutButton() {
  const router = useRouter();

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/admin/auth', { method: 'DELETE' });
    } catch {
      // ignore
    }
    router.push('/admin/login');
    router.refresh();
  }, [router]);

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors"
    >
      <LogOut className="w-3.5 h-3.5" />
      Đăng xuất
    </button>
  );
}

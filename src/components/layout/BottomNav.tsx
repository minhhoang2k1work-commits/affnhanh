'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ShoppingBag, Clapperboard, ShieldCheck, Menu } from 'lucide-react';
export function BottomNav({ onOpenMobileMenu }: { onOpenMobileMenu: () => void }) {
  const pathname = usePathname();
  const items = [
    { name: 'Tổng quan', href: '/', icon: LayoutDashboard },
    { name: 'Sản phẩm', href: '/library', icon: ShoppingBag },
    { name: 'Tạo video', href: '/ai-video', icon: Clapperboard },
    { name: 'Duyệt đăng', href: '/publishing', icon: ShieldCheck },
  ];
  return <nav aria-label="Điều hướng nhanh" className="md:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-5 border-t border-slate-800 bg-slate-950/95 px-1 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
    {items.map(item => <Link key={item.href} href={item.href} aria-current={pathname === item.href ? 'page' : undefined} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px] ${pathname === item.href ? 'bg-violet-500/10 text-violet-300' : 'text-slate-400'}`}><item.icon size={20} />{item.name}</Link>)}
    <button type="button" onClick={onOpenMobileMenu} className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px] text-slate-400"><Menu size={20} />Thêm</button>
  </nav>;
}

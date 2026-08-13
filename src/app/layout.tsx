import type { Metadata } from 'next';
import './globals.css';
import { LayoutWrapper } from '@/components/layout/LayoutWrapper';

export const metadata: Metadata = {
  title: 'Affiliate Product Link Hub - Thư viện & Tự động tạo Link Tiếp Thị Liên Kết',
  description: 'Tự động bóc tách sản phẩm Shop, kiểm tra Affiliate và tạo Deep Link 1-click cho Creators.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased">
        <LayoutWrapper>{children}</LayoutWrapper>
      </body>
    </html>
  );
}

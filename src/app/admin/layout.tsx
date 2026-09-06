import { redirect } from 'next/navigation';
import { verifyAdminSessionFromCookies } from '@/lib/admin-auth';
import { AdminLayoutShell } from '@/components/layout/AdminLayoutShell';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check if the current path is the login page
  // We can't use usePathname in server components, so we use a different approach:
  // The login page will NOT use the LayoutWrapper (it has its own full-screen layout)
  // All other admin pages will be wrapped with auth check

  const isAuthenticated = await verifyAdminSessionFromCookies();

  // Note: The login page has its own standalone layout.
  // This layout wraps ALL /admin/* pages including /admin/login.
  // If not authenticated, we let the login page render normally.
  // For other pages, we redirect to login.

  return (
    <AdminLayoutShell isAuthenticated={isAuthenticated}>
      {children}
    </AdminLayoutShell>
  );
}

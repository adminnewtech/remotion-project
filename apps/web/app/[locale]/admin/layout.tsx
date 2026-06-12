import type { ReactNode } from 'react';
import { AuthProvider } from '@/components/auth-context';
import { RoleGuard } from '@/components/role-guard';
import { AdminSidebar } from '@/components/admin/sidebar';
import { AdminTopbar } from '@/components/admin/topbar';
import { AdminStatusBar } from '@/components/admin/status-bar';

// Admin pages are data- and auth-driven — render per request, not at build time.
export const dynamic = 'force-dynamic';

/**
 * OSALPHA admin shell — gold design system.
 * Auth context + role gate (employee/admin) + 240px sidebar, global topbar
 * (greeting/search/actions) and the bottom integration status bar. The
 * `.osa-root` scope applies the Cairo/IBM-Plex typography + gold canvas.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <RoleGuard allow={['admin', 'employee']}>
        <div className="osa-root flex min-h-screen" data-theme-scope="osalpha">
          <AdminSidebar />
          <div className="flex-1 overflow-x-hidden">
            <main className="mx-auto max-w-[1380px] px-7 pb-[60px] pt-[22px]">
              <AdminTopbar />
              {children}
            </main>
          </div>
          <AdminStatusBar />
        </div>
      </RoleGuard>
    </AuthProvider>
  );
}

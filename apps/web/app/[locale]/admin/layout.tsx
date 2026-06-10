import type { ReactNode } from 'react';
import { AuthProvider } from '@/components/auth-context';
import { RoleGuard } from '@/components/role-guard';
import { AdminSidebar } from '@/components/admin/sidebar';

// Admin pages are data- and auth-driven — render per request, not at build time.
export const dynamic = 'force-dynamic';

/** Admin shell: auth context + role gate (employee/admin) + sidebar nav. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <RoleGuard allow={['admin', 'employee']}>
        <div className="flex min-h-screen bg-background">
          <AdminSidebar />
          <div className="flex-1 overflow-x-hidden">
            <main className="mx-auto max-w-6xl p-6">{children}</main>
          </div>
        </div>
      </RoleGuard>
    </AuthProvider>
  );
}

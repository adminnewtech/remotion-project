'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { UserRole } from '@elite/types';
import { Avatar } from '@elite/ui/web';
import { useT } from '@/lib/use-t';
import { useAuth } from '@/components/auth-context';
import { hasRole } from '@/components/auth-context';
import { LanguageSwitch } from '@/components/language-switch';

interface NavItem {
  key: string;
  href: string;
  labelKey: string;
  icon: string; // simple SVG path
  roles: UserRole[];
}

// Path snippets are simple stroke icons (24x24).
const ICONS: Record<string, string> = {
  dashboard: 'M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z',
  orders: 'M6 2h9l5 5v15H6zM15 2v5h5',
  catalog: 'M4 4h16v6H4zM4 14h16v6H4z',
  dispatch: 'M3 13l2-5h12l2 5v5h-2a2 2 0 1 1-4 0H9a2 2 0 1 1-4 0H3z',
  support: 'M21 11.5a8.38 8.38 0 0 1-9 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.2A8.5 8.5 0 1 1 21 11.5z',
  staff: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM23 21v-2a4 4 0 0 0-3-3.87',
  marketing: 'M3 11l18-5v12L3 14v-3zM11.6 16.8a3 3 0 1 1-5.2-3',
  finance: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
};

const NAV: NavItem[] = [
  { key: 'dashboard', href: '', labelKey: 'admin.dashboard', icon: 'dashboard', roles: ['admin', 'employee'] },
  { key: 'orders', href: '/orders', labelKey: 'admin.orders', icon: 'orders', roles: ['admin', 'employee'] },
  { key: 'catalog', href: '/catalog', labelKey: 'nav.catalog', icon: 'catalog', roles: ['admin', 'employee'] },
  { key: 'dispatch', href: '/dispatch', labelKey: 'admin.dispatch', icon: 'dispatch', roles: ['admin', 'employee'] },
  { key: 'support', href: '/support', labelKey: 'nav.support', icon: 'support', roles: ['admin', 'employee'] },
  { key: 'staff', href: '/staff', labelKey: 'admin.staffManagement', icon: 'staff', roles: ['admin'] },
  { key: 'marketing', href: '/marketing', labelKey: 'nav.marketing', icon: 'marketing', roles: ['admin'] },
  { key: 'finance', href: '/finance', labelKey: 'nav.finance', icon: 'finance', roles: ['admin'] },
];

export function AdminSidebar() {
  const { t, locale } = useT();
  const { profile } = useAuth();
  const pathname = usePathname() || '';
  const adminBase = `/${locale}/admin`;

  return (
    <aside className="flex w-64 shrink-0 flex-col border-e border-border bg-surface">
      <div className="flex items-center gap-2 px-5 py-4">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-lg font-black text-white">E</span>
        <div>
          <p className="text-sm font-extrabold leading-none">Elite Ops</p>
          <p className="text-[11px] text-muted">Newtech</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV.filter((item) => hasRole(profile, item.roles)).map((item) => {
          const href = `${adminBase}${item.href}`;
          const active = item.href === '' ? pathname === adminBase : pathname.startsWith(href);
          return (
            <Link
              key={item.key}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active ? 'bg-primary text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d={ICONS[item.icon]} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div className="mb-3 flex items-center gap-3 px-2">
          <Avatar name={profile?.full_name ?? 'Admin'} src={profile?.avatar_url ?? undefined} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{profile?.full_name ?? 'Admin'}</p>
            <p className="text-[11px] text-muted">{profile ? t(`roles.${profile.role}`) : ''}</p>
          </div>
        </div>
        <div className="flex items-center justify-between px-2">
          <LanguageSwitch />
          <Link href={`/${locale}`} className="text-xs text-muted hover:text-primary">
            {t('nav.home')}
          </Link>
        </div>
      </div>
    </aside>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { UserRole } from '@elite/types';
import { useT } from '@/lib/use-t';
import { useAuth, hasRole } from '@/components/auth-context';

interface NavItem {
  key: string;
  /** Route under the admin base, or `null` for a not-yet-built page → "قريباً". */
  href: string | null;
  labelAr: string;
  labelEn: string;
  icon: string; // inner SVG markup
  roles: UserRole[];
  badge?: string;
  badgeTone?: 'brand' | 'warn';
}

interface NavGroup {
  labelAr: string;
  labelEn: string;
  items: NavItem[];
}

// Stroke icons (24×24) matching the reference mockup.
const ICONS: Record<string, string> = {
  overview: '<path stroke-linecap="round" d="M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>',
  orders: '<path stroke-linecap="round" d="M3 3h2l2 13h11l2-9H7"/><circle cx="9" cy="20" r="1.4"/><circle cx="16" cy="20" r="1.4"/>',
  catalog: '<path stroke-linecap="round" d="M21 8l-9-5-9 5v8l9 5 9-5V8zM3.5 8.5L12 13l8.5-4.5M12 13v8"/>',
  cashier: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M3 17l2 3h14l2-3"/>',
  workshop: '<path stroke-linecap="round" d="M5 17h14M6 17l1.5-9h9L18 17M9 8V6a3 3 0 016 0v2"/>',
  installs: '<path stroke-linecap="round" d="M12 21s-7-5.2-7-11a7 7 0 0114 0c0 5.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  customers: '<circle cx="9" cy="8" r="3.2"/><path stroke-linecap="round" d="M3 20c0-3 2.7-5 6-5s6 2 6 5M16 4.5a3.2 3.2 0 010 7M21 20c0-2.5-1.8-4.2-4.2-4.8"/>',
  chats: '<path stroke-linecap="round" d="M21 12a8 8 0 01-11.6 7.2L4 21l1.8-5.4A8 8 0 1121 12z"/>',
  campaigns: '<path stroke-linecap="round" d="M11 5L4 9v6l7 4V5zM15 8.5a4 4 0 010 7M18 6a8 8 0 010 12"/>',
  crm: '<path stroke-linecap="round" d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m4-4a4 4 0 110-8 4 4 0 010 8zm6 4v-2a4 4 0 00-3-3.87M3 18v-2a4 4 0 013-3.87"/>',
  inbox: '<path stroke-linecap="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>',
  approvals: '<path stroke-linecap="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>',
  accounting: '<path stroke-linecap="round" d="M4 19V5a1 1 0 011-1h9l5 5v10a1 1 0 01-1 1H5a1 1 0 01-1-1zM14 4v5h5M8 13h8M8 16.5h5"/>',
  staff: '<circle cx="12" cy="7" r="3.2"/><path stroke-linecap="round" d="M5 21c0-3.5 3.1-6 7-6s7 2.5 7 6"/>',
  reports: '<path stroke-linecap="round" d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
  agents: '<circle cx="12" cy="8" r="3"/><path stroke-linecap="round" d="M6 20v-1a6 6 0 0112 0v1M9 12l2 2 4-4"/><path stroke-linecap="round" d="M19 9l1.5-1.5M5 9L3.5 7.5M12 4V2"/>',
  warranty: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z"/><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4"/>',
  wishlist: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path stroke-linecap="round" d="M19.4 13a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-2.92 1.06V21a2 2 0 11-4 0v-.07A1.65 1.65 0 006.6 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 003 13.4a2 2 0 010-4h.07A1.65 1.65 0 004.6 6.6l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 0011 3.07V3a2 2 0 014 0v.07a1.65 1.65 0 002.92 1.06l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0021 10.6a2 2 0 010 4z"/>',
};

const GROUPS: NavGroup[] = [
  {
    labelAr: 'الرئيسية',
    labelEn: 'Main',
    items: [
      { key: 'overview', href: '', labelAr: 'نظرة عامة', labelEn: 'Overview', icon: 'overview', roles: ['admin', 'employee'] },
      { key: 'orders', href: '/orders', labelAr: 'الطلبات', labelEn: 'Orders', icon: 'orders', roles: ['admin', 'employee'], badge: '23', badgeTone: 'brand' },
      { key: 'catalog', href: '/catalog', labelAr: 'المنتجات والمخزون', labelEn: 'Products & inventory', icon: 'catalog', roles: ['admin', 'employee'] },
      { key: 'purchasing', href: '/purchasing', labelAr: 'المشتريات', labelEn: 'Purchasing', icon: 'accounting', roles: ['admin', 'employee'] },
      { key: 'landed-costs', href: '/purchasing/costs', labelAr: 'تكاليف الشحن', labelEn: 'Landed costs', icon: 'accounting', roles: ['admin'] },
      { key: 'cashier', href: '/cashier', labelAr: 'الكاشير', labelEn: 'Cashier', icon: 'cashier', roles: ['admin', 'employee'], badge: 'وردية', badgeTone: 'warn' },
    ],
  },
  {
    labelAr: 'الخدمات',
    labelEn: 'Services',
    items: [
      { key: 'workshop', href: '/workshop', labelAr: 'الورشة', labelEn: 'Workshop', icon: 'workshop', roles: ['admin', 'employee'] },
      { key: 'appointments', href: '/appointments', labelAr: 'المواعيد', labelEn: 'Appointments', icon: 'installs', roles: ['admin', 'employee'] },
      { key: 'installs', href: '/dispatch', labelAr: 'التركيبات', labelEn: 'Installations', icon: 'installs', roles: ['admin', 'employee'], badge: '6', badgeTone: 'brand' },
      { key: 'warranties', href: '/warranties', labelAr: 'الضمانات', labelEn: 'Warranties', icon: 'warranty', roles: ['admin', 'employee'] },
    ],
  },
  {
    labelAr: 'العملاء والتسويق',
    labelEn: 'Customers & marketing',
    items: [
      { key: 'customers', href: '/customers', labelAr: 'العملاء', labelEn: 'Customers', icon: 'customers', roles: ['admin', 'employee'] },
      { key: 'crm', href: '/crm', labelAr: 'المبيعات (CRM)', labelEn: 'Sales Pipeline', icon: 'crm', roles: ['admin', 'employee'] },
      { key: 'inbox', href: '/inbox', labelAr: 'مركز الرسائل', labelEn: 'Inbox', icon: 'inbox', roles: ['admin', 'employee'] },
      { key: 'chats', href: '/support', labelAr: 'المحادثات', labelEn: 'Conversations', icon: 'chats', roles: ['admin', 'employee'], badge: '12', badgeTone: 'brand' },
      { key: 'automation', href: '/automation', labelAr: 'الأتمتة', labelEn: 'Automation', icon: 'campaigns', roles: ['admin'] },
      { key: 'campaigns', href: '/marketing', labelAr: 'الحملات', labelEn: 'Campaigns', icon: 'campaigns', roles: ['admin'] },
      { key: 'wishlists', href: '/marketing/wishlists', labelAr: 'قوائم الرغبات', labelEn: 'Wishlists', icon: 'wishlist', roles: ['admin'] },
    ],
  },
  {
    labelAr: 'الإدارة',
    labelEn: 'Management',
    items: [
      { key: 'accounting', href: '/finance', labelAr: 'المحاسبة', labelEn: 'Accounting', icon: 'accounting', roles: ['admin'] },
      { key: 'agents', href: '/agents', labelAr: 'الوكلاء الذكيون', labelEn: 'AI Agents', icon: 'agents', roles: ['admin'] },
      { key: 'approvals', href: '/approvals', labelAr: 'موافقات الذكاء', labelEn: 'AI Approvals', icon: 'approvals', roles: ['admin'] },
      { key: 'staff', href: '/staff', labelAr: 'الموظفون', labelEn: 'Staff', icon: 'staff', roles: ['admin'] },
      { key: 'analytics', href: '/analytics', labelAr: 'التحليلات', labelEn: 'Analytics', icon: 'reports', roles: ['admin', 'employee'] },
      { key: 'reports', href: '/ceo', labelAr: 'لوحة الرئيس', labelEn: 'Executive', icon: 'reports', roles: ['admin'] },
      { key: 'settings', href: '/settings', labelAr: 'الإعدادات', labelEn: 'Settings', icon: 'settings', roles: ['admin'] },
    ],
  },
];

function NavIcon({ markup }: { markup: string }) {
  return (
    <svg
      width="17"
      height="17"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      aria-hidden
      className="flex-shrink-0"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

export function AdminSidebar() {
  const { locale } = useT();
  const { profile } = useAuth();
  const pathname = usePathname() || '';
  const ar = locale === 'ar';
  const adminBase = `/${locale}/admin`;
  const soonHref = `${adminBase}/soon`;

  const fullName = profile?.full_name ?? (ar ? 'أحمد الرشيدي' : 'Admin');
  const roleLabel = profile?.role === 'admin' ? (ar ? 'المالك' : 'Owner') : ar ? 'موظف' : 'Staff';
  const initial = fullName.trim().charAt(0) || (ar ? 'أ' : 'A');

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col gap-0.5 overflow-y-auto border-e border-osa-border bg-osa-surface px-[14px] py-5">
      {/* Logo */}
      <div className="flex items-center gap-[11px] px-[10px] pb-4 pt-0.5">
        <div
          className="grid h-9 w-9 place-items-center rounded-[11px] text-[16px] font-extrabold text-white"
          style={{ background: 'linear-gradient(135deg,var(--osa-brand-grad-from),var(--osa-brand-grad-to))', fontFamily: 'var(--font-cairo)' }}
        >
          N
        </div>
        <div>
          <b className="block text-[16.5px] font-bold leading-tight text-osa-ink" style={{ fontFamily: 'var(--font-cairo)' }}>
            OSALPHA
          </b>
          <span className="mt-[-3px] block text-[11px] font-normal text-osa-faint">
            {ar ? 'نظام تشغيل نيوتك' : 'Newtech OS'}
          </span>
        </div>
      </div>

      {/* Store pill */}
      <button
        type="button"
        className="mx-1 mb-3 flex items-center gap-[9px] rounded-osa-sm border border-osa-border bg-osa-surface-2 px-3 py-2 text-[12.5px] font-medium text-osa-ink"
      >
        <span className="h-2 w-2 rounded-full bg-osa-green" />
        {ar ? 'نيوتك الكويت — الري' : 'Newtech Kuwait — Rai'}
        <small className="ms-auto text-[11px] text-osa-faint">{ar ? 'نشط' : 'Active'}</small>
      </button>

      {/* Nav groups */}
      <div className="flex-1">
        {GROUPS.map((group) => {
          const items = group.items.filter((it) => hasRole(profile, it.roles));
          if (!items.length) return null;
          return (
            <div key={group.labelEn}>
              <div className="px-3 pb-[5px] pt-3 text-[10.5px] font-semibold tracking-[0.05em] text-osa-faint">
                {ar ? group.labelAr : group.labelEn}
              </div>
              <nav className="flex flex-col gap-0.5">
                {items.map((it) => {
                  const href = it.href === null ? soonHref : `${adminBase}${it.href}`;
                  const active =
                    it.href === null
                      ? false
                      : it.href === ''
                        ? pathname === adminBase
                        : pathname.startsWith(`${adminBase}${it.href}`);
                  return (
                    <Link
                      key={it.key}
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={
                        'flex items-center gap-[11px] rounded-osa-sm px-3 py-[8.5px] text-[13.5px] font-medium transition-colors ' +
                        (active
                          ? 'bg-osa-brand-dim font-semibold text-osa-brand'
                          : 'text-osa-muted hover:bg-osa-surface-2 hover:text-osa-ink')
                      }
                    >
                      <NavIcon markup={ICONS[it.icon] ?? ''} />
                      <span>{ar ? it.labelAr : it.labelEn}</span>
                      {it.badge && (
                        <span
                          className={
                            'ms-auto rounded-full px-[7px] text-[11px] font-semibold ' +
                            (it.badgeTone === 'warn'
                              ? 'bg-osa-amber-dim text-osa-amber'
                              : 'bg-osa-brand-dim text-osa-brand')
                          }
                        >
                          {it.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          );
        })}
      </div>

      {/* User card */}
      <div className="mt-auto flex items-center gap-2.5 rounded-osa-sm border border-osa-border px-3 py-2.5">
        <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-osa-brand-dim text-[13px] font-semibold text-osa-brand">
          {initial}
        </span>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-osa-ink">{fullName}</div>
          <small className="mt-[-4px] block text-[11px] text-osa-faint">{roleLabel}</small>
        </div>
      </div>
    </aside>
  );
}

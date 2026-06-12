'use client';

import { useMemo, useState } from 'react';
import { useT } from '@/lib/use-t';
import { PageHeader } from '@/components/admin/ui';
import { RoleGuard } from '@/components/role-guard';
import type { WarrantiesData, WarrantyRow } from '@/lib/admin-warranties';

// ── Design tokens ─────────────────────────────────────────────────────────
const CARD = 'rounded-osa border border-osa-border bg-osa-surface shadow-osa';

// ── Status config ──────────────────────────────────────────────────────────
const STATUS_AR: Record<string, string> = {
  active: 'نشط',
  expired: 'منتهي',
  voided: 'ملغي',
  claimed: 'مطالَب به',
};

const STATUS_EN: Record<string, string> = {
  active: 'Active',
  expired: 'Expired',
  voided: 'Voided',
  claimed: 'Claimed',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-700',
  voided: 'bg-osa-surface-2 text-osa-faint',
  claimed: 'bg-amber-100 text-amber-700',
};

// ── Date helpers ───────────────────────────────────────────────────────────
function formatDate(dateStr: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-KW' : 'en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function daysLabel(days: number, ar: boolean): string {
  if (days > 0) {
    return ar ? `يتبقى ${days} يوم` : `${days}d left`;
  }
  if (days === 0) {
    return ar ? 'ينتهي اليوم' : 'Expires today';
  }
  return ar ? `انتهى منذ ${Math.abs(days)} يوم` : `Expired ${Math.abs(days)}d ago`;
}

function daysColor(days: number): string {
  if (days <= 0) return 'text-red-600';
  if (days <= 30) return 'text-osa-amber';
  return 'text-green-600';
}

// ── Summary chip ───────────────────────────────────────────────────────────
function Chip({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className={`${CARD} flex flex-col items-center justify-center p-4 text-center`}>
      <span className={`num text-[24px] font-extrabold ${color}`}>{value}</span>
      <span className="mt-0.5 text-[11.5px] text-osa-faint">{label}</span>
    </div>
  );
}

// ── Filter types ───────────────────────────────────────────────────────────
type StatusFilter = 'all' | 'active' | 'expired' | 'voided' | 'claimed';

// ── Main client ────────────────────────────────────────────────────────────
export function WarrantiesClient({ data }: { data: WarrantiesData }) {
  const { locale } = useT();
  const ar = locale === 'ar';

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // ── Summary counts ──────────────────────────────────────────────────────
  const totalActive = useMemo(
    () => data.rows.filter((r) => r.status === 'active' && r.days_remaining > 0).length,
    [data.rows],
  );
  const expiringIn30 = useMemo(
    () => data.rows.filter((r) => r.status === 'active' && r.days_remaining > 0 && r.days_remaining <= 30).length,
    [data.rows],
  );
  const totalExpired = useMemo(
    () => data.rows.filter((r) => r.status === 'expired' || (r.status === 'active' && r.days_remaining <= 0)).length,
    [data.rows],
  );

  // ── Filtered rows ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.rows.filter((r) => {
      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'expired') {
          if (r.status !== 'expired' && !(r.status === 'active' && r.days_remaining <= 0)) return false;
        } else if (r.status !== statusFilter) {
          return false;
        }
      }

      // Text search
      if (q) {
        const haystack = [
          r.serial,
          r.product_name_ar,
          r.product_name_en,
          r.variant_sku,
          r.customer_name,
          r.customer_email,
          r.customer_phone,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [data.rows, query, statusFilter]);

  // ── Filter pill ─────────────────────────────────────────────────────────
  const filterOptions: { value: StatusFilter; ar: string; en: string }[] = [
    { value: 'all', ar: 'الكل', en: 'All' },
    { value: 'active', ar: 'نشط', en: 'Active' },
    { value: 'expired', ar: 'منتهي', en: 'Expired' },
    { value: 'voided', ar: 'ملغي', en: 'Voided' },
    { value: 'claimed', ar: 'مطالَب به', en: 'Claimed' },
  ];

  return (
    <RoleGuard allow={['admin', 'employee']}>
      {/* Header */}
      <PageHeader
        title={ar ? 'إدارة الضمانات' : 'Warranties'}
        subtitle={ar ? 'تتبع ضمانات المنتجات المربوطة بالأرقام التسلسلية' : 'Track product warranties by serial number'}
      />

      {/* Summary chips */}
      <div className="mb-6 grid grid-cols-3 gap-3 sm:grid-cols-3">
        <Chip
          label={ar ? 'ضمانات نشطة' : 'Active'}
          value={totalActive}
          color="text-green-600"
        />
        <Chip
          label={ar ? 'تنتهي خلال 30 يوم' : 'Expiring in 30d'}
          value={expiringIn30}
          color={expiringIn30 > 0 ? 'text-osa-amber' : 'text-osa-ink'}
        />
        <Chip
          label={ar ? 'منتهية الصلاحية' : 'Expired'}
          value={totalExpired}
          color={totalExpired > 0 ? 'text-red-600' : 'text-osa-ink'}
        />
      </div>

      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Search box */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg
            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-osa-faint"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35M16.65 16.65A7 7 0 1 0 4 10a7 7 0 0 0 12.65 6.65z"
            />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={ar ? 'ابحث بالتسلسل أو المنتج أو العميل…' : 'Search serial, product, customer…'}
            className="w-full rounded-osa border border-osa-border bg-osa-surface ps-9 pe-3 py-2 text-[13.5px] text-osa-ink placeholder:text-osa-faint focus:outline-none focus:ring-2 focus:ring-osa-brand"
            dir={ar ? 'rtl' : 'ltr'}
          />
        </div>

        {/* Status filter pills */}
        <div className="flex flex-wrap gap-1.5">
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatusFilter(opt.value)}
              className={
                'rounded-full px-3 py-1 text-[12.5px] font-semibold transition-colors ' +
                (statusFilter === opt.value
                  ? 'bg-osa-brand text-white shadow-sm'
                  : 'bg-osa-surface-2 text-osa-muted hover:bg-osa-surface-3')
              }
            >
              {ar ? opt.ar : opt.en}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className={`${CARD} p-10 text-center`}>
          <p className="text-[14px] text-osa-faint">
            {ar ? 'لا توجد ضمانات مطابقة للبحث' : 'No warranties match your search'}
          </p>
        </div>
      ) : (
        <div className={`${CARD} overflow-x-auto`}>
          <table className="w-full border-collapse text-[13px]" dir={ar ? 'rtl' : 'ltr'}>
            <thead>
              <tr className="text-start">
                {[
                  ar ? 'الرقم التسلسلي' : 'Serial',
                  ar ? 'المنتج' : 'Product',
                  ar ? 'العميل' : 'Customer',
                  ar ? 'يبدأ' : 'Starts',
                  ar ? 'ينتهي' : 'Expires',
                  ar ? 'الحالة' : 'Status',
                  ar ? 'المتبقي' : 'Remaining',
                ].map((h) => (
                  <th
                    key={h}
                    className="border-b border-osa-border px-4 pb-2.5 pt-3.5 text-start text-[11.5px] font-medium text-osa-faint"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <WarrantyTableRow key={row.id} row={row} ar={ar} locale={locale} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Row count */}
      <p className="mt-2 text-end text-[11.5px] text-osa-faint">
        {ar
          ? `عرض ${filtered.length} من ${data.rows.length} ضمان`
          : `Showing ${filtered.length} of ${data.rows.length} warranties`}
      </p>

      {/* Sample data notice */}
      {!data.live && (
        <p className="mt-4 text-center text-[11.5px] text-osa-faint">
          {ar
            ? 'عرض بيانات تجريبية — الاتصال بقاعدة البيانات غير متوفر'
            : 'Showing sample data — database connection unavailable'}
        </p>
      )}
    </RoleGuard>
  );
}

// ── Row subcomponent ───────────────────────────────────────────────────────

function WarrantyTableRow({
  row,
  ar,
  locale,
}: {
  row: WarrantyRow;
  ar: boolean;
  locale: string;
}) {
  const productName = ar ? (row.product_name_ar ?? row.product_name_en) : (row.product_name_en ?? row.product_name_ar);

  return (
    <tr className="transition-colors hover:bg-osa-surface-2">
      {/* Serial */}
      <td className="border-b border-osa-border px-4 py-2.5">
        <span className="num font-mono font-semibold text-osa-ink">
          {row.serial ?? '—'}
        </span>
        {row.variant_sku && (
          <span className="ms-1.5 text-[11px] text-osa-faint">{row.variant_sku}</span>
        )}
      </td>

      {/* Product */}
      <td className="border-b border-osa-border px-4 py-2.5">
        <span className="font-medium text-osa-ink">{productName ?? '—'}</span>
      </td>

      {/* Customer */}
      <td className="border-b border-osa-border px-4 py-2.5">
        {row.customer_name ? (
          <div>
            <div className="font-medium text-osa-ink">{row.customer_name}</div>
            {row.customer_phone && (
              <div className="num text-[11px] text-osa-faint">{row.customer_phone}</div>
            )}
          </div>
        ) : (
          <span className="text-osa-faint">—</span>
        )}
      </td>

      {/* Starts */}
      <td className="border-b border-osa-border px-4 py-2.5 text-osa-muted">
        <span className="num text-[12px]">{formatDate(row.starts_at, locale)}</span>
      </td>

      {/* Expires */}
      <td className="border-b border-osa-border px-4 py-2.5 text-osa-muted">
        <span className="num text-[12px]">{formatDate(row.expires_at, locale)}</span>
      </td>

      {/* Status badge */}
      <td className="border-b border-osa-border px-4 py-2.5">
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${STATUS_COLORS[row.status] ?? 'bg-osa-surface-2 text-osa-muted'}`}
        >
          {ar ? STATUS_AR[row.status] : STATUS_EN[row.status]}
        </span>
      </td>

      {/* Days remaining */}
      <td className="border-b border-osa-border px-4 py-2.5">
        <span className={`num text-[12.5px] font-semibold ${daysColor(row.days_remaining)}`}>
          {daysLabel(row.days_remaining, ar)}
        </span>
      </td>
    </tr>
  );
}

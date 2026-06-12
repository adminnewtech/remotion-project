'use client';

import { PageHeader } from '@/components/admin/ui';
import { RoleGuard } from '@/components/role-guard';
import { useT } from '@/lib/use-t';
import type { WishlistInsights, WishlistedProduct, RecentWishlistItem } from '@/lib/admin-wishlists';

// ── Design tokens ──────────────────────────────────────────────────────────

const CARD = 'rounded-osa border border-osa-border bg-osa-surface shadow-osa';

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtKwd(val: number | null): string {
  if (val == null) return '—';
  return val.toFixed(3) + ' د.ك';
}

function fmtDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ar-KW', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ── Stock badge ────────────────────────────────────────────────────────────

function StockBadge({ stock, ar }: { stock: number | null; ar: boolean }) {
  if (stock == null) return <span className="text-[12px] text-osa-faint">—</span>;
  if (stock === 0) {
    return (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11.5px] font-semibold text-red-700">
        {ar ? 'نفد المخزون' : 'Out of stock'}
      </span>
    );
  }
  if (stock <= 5) {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11.5px] font-semibold text-amber-700">
        {stock} {ar ? 'قطع متبقية' : 'left'}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11.5px] font-semibold text-green-700">
      {stock} {ar ? 'متوفر' : 'in stock'}
    </span>
  );
}

// ── Top products table ─────────────────────────────────────────────────────

function TopProductsTable({ products, ar }: { products: WishlistedProduct[]; ar: boolean }) {
  const headers = ar
    ? ['#', 'المنتج', 'المُدرَج في قوائم الرغبات', 'أقل سعر', 'المخزون']
    : ['#', 'Product', 'Wishlist Count', 'From Price', 'Stock'];

  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="border-b border-osa-border px-5 py-3.5">
        <h2 className="text-[14px] font-bold text-osa-ink">
          {ar ? 'المنتجات الأكثر طلباً في القوائم' : 'Most-Wishlisted Products'}
        </h2>
        <p className="mt-0.5 text-[12px] text-osa-faint">
          {ar
            ? 'منتجات يضمّها العملاء إلى قوائم رغباتهم — استهدفها بالعروض والتخزين'
            : 'Products customers save — target these for promotions and restocking'}
        </p>
      </div>

      {products.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-[13px] text-osa-faint">
            {ar ? 'لا توجد بيانات بعد' : 'No data yet'}
          </p>
        </div>
      ) : (
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {headers.map((h) => (
                <th
                  key={h}
                  className="border-b border-osa-border px-4 pb-2.5 pt-3 text-start text-[11.5px] font-medium text-osa-faint"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map((p, idx) => (
              <tr key={p.productId} className="transition-colors hover:bg-osa-surface-2">
                {/* Rank */}
                <td className="w-10 border-b border-osa-border px-4 py-3">
                  <span
                    className={
                      'num inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ' +
                      (idx === 0
                        ? 'bg-osa-brand text-white'
                        : idx === 1
                          ? 'bg-osa-brand-dim text-osa-brand'
                          : idx === 2
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-osa-surface-2 text-osa-faint')
                    }
                  >
                    {idx + 1}
                  </span>
                </td>

                {/* Product name */}
                <td className="border-b border-osa-border px-4 py-3">
                  <div className="font-semibold text-osa-ink leading-tight">
                    {ar ? p.nameAr : p.nameEn}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-osa-faint">
                    {ar ? p.nameEn : p.nameAr}
                  </div>
                </td>

                {/* Wishlist count with bar */}
                <td className="border-b border-osa-border px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="num w-7 text-[15px] font-bold text-osa-brand">
                      {p.wishlistCount}
                    </span>
                    <div className="h-1.5 flex-1 max-w-[80px] overflow-hidden rounded-full bg-osa-surface-3">
                      <div
                        className="h-full rounded-full bg-osa-brand transition-all"
                        style={{
                          width: `${Math.min(100, Math.round((p.wishlistCount / (products[0]?.wishlistCount || 1)) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                </td>

                {/* Price */}
                <td className="border-b border-osa-border px-4 py-3">
                  <span className="num text-[13px] font-semibold text-osa-ink">
                    {fmtKwd(p.minPrice)}
                  </span>
                </td>

                {/* Stock */}
                <td className="border-b border-osa-border px-4 py-3">
                  <StockBadge stock={p.totalStock} ar={ar} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Recent activity list ───────────────────────────────────────────────────

function RecentActivityList({ items, ar }: { items: RecentWishlistItem[]; ar: boolean }) {
  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="border-b border-osa-border px-5 py-3.5">
        <h2 className="text-[14px] font-bold text-osa-ink">
          {ar ? 'آخر إضافات لقوائم الرغبات' : 'Recent Wishlist Activity'}
        </h2>
        <p className="mt-0.5 text-[12px] text-osa-faint">
          {ar ? 'آخر 20 منتجاً أضافه العملاء' : 'Last 20 items added by customers'}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-[13px] text-osa-faint">
            {ar ? 'لا يوجد نشاط بعد' : 'No activity yet'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-osa-border">
          {items.map((item, idx) => (
            <li
              key={`${item.productId}-${idx}`}
              className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-osa-surface-2"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-osa-ink">
                  {ar ? item.nameAr : item.nameEn}
                </div>
                <div className="mt-0.5 text-[12px] text-osa-faint">
                  {item.customerName}
                </div>
              </div>
              <span className="num shrink-0 text-[12px] text-osa-faint">
                {fmtDate(item.addedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Main client component ──────────────────────────────────────────────────

export function WishlistsClient({ data }: { data: WishlistInsights }) {
  const { locale } = useT();
  const ar = locale === 'ar';

  const outOfStockWishlisted = data.topProducts.filter(
    (p) => p.totalStock !== null && p.totalStock === 0,
  ).length;

  const summaryChips = [
    {
      label: ar ? 'إجمالي العناصر' : 'Total Items',
      value: data.totalItems.toLocaleString('ar-KW'),
      color: 'text-osa-brand',
    },
    {
      label: ar ? 'عملاء مشتركون' : 'Distinct Customers',
      value: data.distinctCustomers.toLocaleString('ar-KW'),
      color: 'text-osa-ink',
    },
    {
      label: ar ? 'منتجات مرغوبة' : 'Unique Products',
      value: data.topProducts.length.toLocaleString('ar-KW'),
      color: 'text-osa-ink',
    },
    {
      label: ar ? 'مرغوب + نفد المخزون' : 'Wishlisted & OOS',
      value: String(outOfStockWishlisted),
      color: outOfStockWishlisted > 0 ? 'text-red-600' : 'text-osa-ink',
    },
  ];

  return (
    <RoleGuard allow={['admin']}>
      <PageHeader
        title={ar ? 'تحليلات قوائم الرغبات' : 'Wishlists Insights'}
        subtitle={
          ar
            ? 'المنتجات الأكثر طلباً — استخدمها لتحديد الأولويات التسويقية وإعادة التخزين'
            : 'Most-wanted products — use to prioritise promotions and restocking'
        }
      />

      {/* Summary chips */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {summaryChips.map((chip) => (
          <div key={chip.label} className={`${CARD} p-4 text-center`}>
            <div className={`num text-[22px] font-bold ${chip.color}`}>{chip.value}</div>
            <div className="mt-0.5 text-[11.5px] text-osa-faint">{chip.label}</div>
          </div>
        ))}
      </div>

      {/* Out-of-stock alert */}
      {outOfStockWishlisted > 0 && (
        <div className="mb-5 flex items-start gap-3 rounded-osa border border-red-200 bg-red-50 px-4 py-3">
          <span className="mt-0.5 text-[16px]" aria-hidden="true">⚠</span>
          <p className="text-[13px] text-red-700 leading-snug">
            {ar
              ? `${outOfStockWishlisted} منتج مرغوب من العملاء نفد مخزونه — أعد الطلب الآن`
              : `${outOfStockWishlisted} wishlisted product${outOfStockWishlisted > 1 ? 's are' : ' is'} out of stock — consider restocking`}
          </p>
        </div>
      )}

      {/* Two-column layout on large screens */}
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <TopProductsTable products={data.topProducts} ar={ar} />
        <RecentActivityList items={data.recentItems} ar={ar} />
      </div>

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

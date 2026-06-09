import Link from 'next/link';
import { coerceLocale, localized, t } from '@/lib/i18n';
import { StatusBadge, PriceTag, EmptyState } from '@elite/ui/web';
import { fmtDate } from '@/lib/format';
import { fetchOrders } from '@/lib/data';

export default async function AccountOrdersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = coerceLocale(raw);
  const base = `/${locale}`;
  const orders = await fetchOrders();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('orders.title', locale)}</h1>
        <Link href={`${base}/account/support`} className="text-sm font-semibold text-primary hover:underline">
          {t('nav.support', locale)}
        </Link>
      </div>

      {orders.length === 0 ? (
        <EmptyState title={t('orders.empty', locale)} />
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Link
              key={o.id}
              href={`${base}/account/orders/${o.id}`}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm transition hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-bold">{t('orders.orderNumber', locale, { number: o.order_number })}</p>
                {o.placed_at && (
                  <p className="text-xs text-muted">{t('orders.placedOn', locale, { date: fmtDate(o.placed_at, locale) })}</p>
                )}
              </div>
              <div className="flex items-center gap-4">
                <PriceTag price={o.total} locale={locale} inline />
                <StatusBadge status={o.status} label={t(`orderStatus.${o.status}`, locale)} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

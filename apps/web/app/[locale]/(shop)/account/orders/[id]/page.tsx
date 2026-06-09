import Link from 'next/link';
import { notFound } from 'next/navigation';
import { coerceLocale, t } from '@/lib/i18n';
import { StatusBadge, PriceTag, Button } from '@elite/ui/web';
import { fmtDate } from '@/lib/format';
import { fetchOrder, fetchTracking } from '@/lib/data';
import { OrderTimeline, DriverMap } from '@/components/order-timeline';

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
  const locale = coerceLocale(raw);
  const base = `/${locale}`;
  const [order, tracking] = await Promise.all([fetchOrder(id), fetchTracking(id)]);
  if (!order) notFound();

  const deliveryTask = tracking?.tasks.find((t) => t.type === 'delivery');
  const isLive = ['paid', 'processing', 'out_for_delivery', 'installing'].includes(order.status);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Link href={`${base}/account`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-primary">
        <span aria-hidden>‹</span> {t('orders.title', locale)}
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('orders.orderNumber', locale, { number: order.order_number })}</h1>
          {order.placed_at && (
            <p className="text-sm text-muted">{t('orders.placedOn', locale, { date: fmtDate(order.placed_at, locale) })}</p>
          )}
        </div>
        <StatusBadge status={order.status} label={t(`orderStatus.${order.status}`, locale)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Timeline + map */}
        <div className="space-y-6 lg:col-span-2">
          {isLive && deliveryTask && order.status === 'out_for_delivery' && (
            <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <h2 className="mb-3 text-lg font-bold">{t('delivery.tracking', locale)}</h2>
              <DriverMap taskId={deliveryTask.id} />
            </section>
          )}

          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">{t('orders.timeline', locale)}</h2>
            <OrderTimeline order={order} />
          </section>

          {/* Items */}
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">{t('orders.items', locale)}</h2>
            <div className="divide-y divide-border">
              {order.items.map((it) => (
                <div key={it.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-semibold">{it.name_snapshot}</p>
                    <p className="text-xs text-muted">
                      {t('common.quantity', locale)}: {it.qty}
                      {it.with_installation ? ` · ${t('cart.withInstallation', locale)}` : ''}
                    </p>
                  </div>
                  <PriceTag price={it.line_total} locale={locale} inline />
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Side: totals + warranty + actions */}
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">{t('checkout.orderSummary', locale)}</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">{t('cart.subtotal', locale)}</dt><dd><PriceTag price={order.subtotal} locale={locale} inline /></dd></div>
              <div className="flex justify-between"><dt className="text-muted">{t('cart.deliveryFee', locale)}</dt><dd>{order.delivery_fee === 0 ? t('cart.freeDelivery', locale) : <PriceTag price={order.delivery_fee} locale={locale} inline />}</dd></div>
              {order.installation_fee > 0 && <div className="flex justify-between"><dt className="text-muted">{t('cart.installationFee', locale)}</dt><dd><PriceTag price={order.installation_fee} locale={locale} inline /></dd></div>}
              {order.discount_total > 0 && <div className="flex justify-between text-success"><dt>{t('cart.discount', locale)}</dt><dd>− <PriceTag price={order.discount_total} locale={locale} inline /></dd></div>}
            </dl>
            <div className="my-3 border-t border-border" />
            <div className="flex justify-between"><span className="font-bold">{t('cart.total', locale)}</span><PriceTag price={order.total} locale={locale} inline size="lg" /></div>
            <div className="mt-4 grid gap-2">
              <Button variant="outline" className="w-full">{t('orders.viewInvoice', locale)}</Button>
              <Button variant="ghost" className="w-full">{t('orders.reorder', locale)}</Button>
            </div>
          </section>

          {/* Warranty cards */}
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">{t('orders.warrantyCard', locale)}</h2>
            <div className="space-y-3">
              {order.items.map((it) => (
                <div key={it.id} className="rounded-xl border border-dashed border-primary/40 bg-primary-50/40 p-3">
                  <p className="text-sm font-semibold">{it.name_snapshot}</p>
                  {it.warranty_expires_at ? (
                    <p className="text-xs text-muted">
                      {locale === 'ar' ? 'الضمان حتى' : 'Warranty until'} {fmtDate(it.warranty_expires_at, locale)}
                    </p>
                  ) : (
                    <p className="text-xs text-muted">—</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

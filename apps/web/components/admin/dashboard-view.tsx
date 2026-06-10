'use client';

import { useState } from 'react';
import { StatusBadge, PriceTag, Table } from '@elite/ui/web';
import type { Order } from '@elite/types';
import { useT } from '@/lib/use-t';
import { PageHeader, KpiCard, BarChart, MeterRow } from '@/components/admin/ui';
import {
  adminKpis as sampleKpis,
  revenueSeries,
  topProducts,
  lowStock,
  demandByArea,
  liveOrders as sampleLiveOrders,
} from '@/lib/admin-sample';
import type { AdminDashboardData } from '@/lib/data';

type Period = 'today' | 'week' | 'month';

/**
 * Admin dashboard. KPIs + recent orders come from the live backend (passed in
 * by the server page); when the backend is unavailable it shows sample data so
 * the dashboard always renders. Charts that need SQL views (revenue series,
 * top products, low stock, demand-by-area) remain sample-backed for v1.
 */
export function DashboardView({ data }: { data: AdminDashboardData }) {
  const { t, locale } = useT();
  const [period, setPeriod] = useState<Period>('today');

  const kpis = data.live ? data.kpis : sampleKpis;
  const k = kpis[period];
  const orders =
    data.live && data.liveOrders.length
      ? data.liveOrders
      : (sampleLiveOrders as {
          number: string;
          customer: string;
          area: string;
          total: number;
          status: Order['status'];
        }[]);
  const maxDemand = Math.max(...demandByArea.map((d) => d.orders));

  return (
    <div>
      <PageHeader
        title={t('admin.dashboard')}
        subtitle={data.live ? t('admin.overview') : `${t('admin.overview')} · sample`}
        actions={
          <div className="inline-flex rounded-full border border-border bg-surface p-0.5 text-sm">
            {(['today', 'week', 'month'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-full px-3 py-1 ${period === p ? 'bg-primary text-white' : 'text-muted hover:text-foreground'}`}
              >
                {t(`admin.period.${p}`)}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label={t('admin.revenue')} value={`${k.revenue.toLocaleString()} KWD`} delta={6.2} />
        <KpiCard label={t('admin.orders')} value={String(k.orders)} delta={4.1} />
        <KpiCard label={t('admin.aov')} value={`${k.aov.toFixed(1)} KWD`} delta={1.3} />
        <KpiCard label={t('admin.conversion')} value={`${k.conversion}%`} delta={-0.4} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-4 text-lg font-bold">{t('admin.revenue')}</h2>
          <BarChart data={revenueSeries} />
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold">{t('admin.demandByArea')}</h2>
          <div className="space-y-3">
            {demandByArea.map((d) => (
              <MeterRow key={d.area} label={d.area} value={d.orders} max={maxDemand} />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-4 text-lg font-bold">{t('admin.liveMap')}</h2>
          <Table>
            <thead>
              <tr>
                <th>{locale === 'ar' ? 'الطلب' : 'Order'}</th>
                <th>{t('nav.customers')}</th>
                <th>{t('checkout.area')}</th>
                <th>{t('cart.total')}</th>
                <th>{t('common.all')}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.number}>
                  <td className="font-mono text-xs">{o.number}</td>
                  <td>{o.customer}</td>
                  <td className="text-muted">{o.area}</td>
                  <td>
                    <PriceTag price={o.total} locale={locale} inline />
                  </td>
                  <td>
                    <StatusBadge status={o.status} label={t(`orderStatus.${o.status}`)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-bold">{t('admin.lowStockAlerts')}</h2>
            <ul className="space-y-2">
              {lowStock.map((s) => (
                <li
                  key={s.sku}
                  className="flex items-center justify-between rounded-lg bg-warning-50 px-3 py-2 text-sm"
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="font-bold text-warning-700">{s.available}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-bold">{t('admin.topProducts')}</h2>
            <ol className="space-y-2">
              {topProducts.map((p, i) => (
                <li key={p.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <span className="font-medium">{p.name}</span>
                  </span>
                  <span className="text-muted">{p.sold}×</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { Table, Badge, StatusBadge } from '@elite/ui/web';
import { useT } from '@/lib/use-t';
import { PageHeader, KpiCard } from '@/components/admin/ui';
import type { MarketingData } from '@/lib/admin-marketing';

/** Marketing operator view — native campaigns + our own catalog feed. */
export function MarketingView({ data }: { data: MarketingData }) {
  const { t, locale } = useT();
  const ar = locale === 'ar';

  return (
    <>
      <PageHeader
        title={t('nav.marketing')}
        subtitle={ar ? 'حملات NewTech' : 'NewTech campaigns'}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label={ar ? 'إجمالي الإنفاق' : 'Total spend'} value={`${data.totalSpend.toFixed(1)} KWD`} />
        <KpiCard label={ar ? 'الوصول' : 'Reach'} value={data.totalReach.toLocaleString()} />
        <KpiCard label="ROAS" value={`${data.roas.toFixed(1)}×`} />
        <KpiCard label={ar ? 'منتجات بالكتالوج' : 'Catalog items'} value={String(data.catalogItems)} />
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface shadow-sm">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-bold">{ar ? 'الحملات' : 'Campaigns'}</h2>
          <div className="flex items-center gap-3 text-xs text-muted">
            <a href="/feeds/google-merchant.xml" className="hover:text-osa-brand" target="_blank" rel="noreferrer">
              Google feed
            </a>
            <a href="/feeds/meta-catalog.csv" className="hover:text-osa-brand" target="_blank" rel="noreferrer">
              Meta feed
            </a>
          </div>
        </div>
        <Table>
          <thead>
            <tr>
              <th>{ar ? 'الحملة' : 'Campaign'}</th>
              <th>{ar ? 'القناة' : 'Channel'}</th>
              <th>{t('common.all')}</th>
              <th>{ar ? 'الإنفاق' : 'Spend'}</th>
              <th>{ar ? 'الوصول' : 'Reach'}</th>
              <th>ROAS</th>
            </tr>
          </thead>
          <tbody>
            {data.campaigns.map((c) => (
              <tr key={c.id}>
                <td className="font-medium">{c.name}</td>
                <td className="text-muted">{c.channel}</td>
                <td>
                  {c.status === 'active' ? (
                    <StatusBadge status="completed" labelOverride={ar ? 'نشطة' : 'Active'} />
                  ) : (
                    <Badge variant="neutral">{ar ? 'متوقفة' : 'Paused'}</Badge>
                  )}
                </td>
                <td>{c.spend.toFixed(1)} KWD</td>
                <td>{c.reach.toLocaleString()}</td>
                <td className="font-semibold">{c.roas.toFixed(1)}×</td>
              </tr>
            ))}
            {data.campaigns.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-sm text-muted">
                  {t('common.none')}
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>

      <p className="mt-3 text-xs text-muted">
        {ar
          ? 'الحملات مخزّنة عندنا، وخلاصة الكتالوج تُصدَّر من منتجاتنا مباشرة (بدون Shopify).'
          : 'Campaigns are stored first-party; the catalog feed is exported from our own products (no Shopify).'}
      </p>
    </>
  );
}

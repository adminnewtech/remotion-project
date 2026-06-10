'use client';

import { useState } from 'react';
import { Table, Badge, Button, StatusBadge } from '@elite/ui/web';
import { useT } from '@/lib/use-t';
import { PageHeader, KpiCard } from '@/components/admin/ui';
import { metaCampaigns } from '@/lib/admin-sample';
import { RoleGuard } from '@/components/role-guard';

/**
 * Marketing — Meta catalog + campaigns panel (UI only).
 * "Sync catalog" / campaign mutations call the core Meta integration adapter
 * server-side (`@elite/core/integrations`); this is the operator UI.
 */
export default function MarketingPage() {
  const { t, locale } = useT();
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);

  function syncCatalog() {
    setSyncing(true);
    // Would call the server action → core Meta integration (ads_catalog_*).
    setTimeout(() => {
      setSyncing(false);
      setSynced(true);
    }, 900);
  }

  const totalSpend = metaCampaigns.reduce((s, c) => s + c.spend, 0);
  const totalReach = metaCampaigns.reduce((s, c) => s + c.reach, 0);

  return (
    <RoleGuard allow={['admin']}>
      <PageHeader
        title={t('nav.marketing')}
        subtitle="Meta Ads"
        actions={
          <Button loading={syncing} onClick={syncCatalog}>
            {synced
              ? locale === 'ar'
                ? 'تمت المزامنة'
                : 'Catalog synced'
              : locale === 'ar'
                ? 'مزامنة الكتالوج'
                : 'Sync catalog to Meta'}
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label={locale === 'ar' ? 'إجمالي الإنفاق' : 'Total spend'} value={`${totalSpend.toFixed(1)} KWD`} />
        <KpiCard label={locale === 'ar' ? 'الوصول' : 'Reach'} value={totalReach.toLocaleString()} />
        <KpiCard label="ROAS" value="4.6×" delta={0.8} />
        <KpiCard label={locale === 'ar' ? 'منتجات بالكتالوج' : 'Catalog items'} value="248" />
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface shadow-sm">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-bold">{locale === 'ar' ? 'الحملات' : 'Campaigns'}</h2>
          <Button variant="outline" size="sm">+ {locale === 'ar' ? 'حملة' : 'Campaign'}</Button>
        </div>
        <Table>
          <thead>
            <tr>
              <th>{locale === 'ar' ? 'الحملة' : 'Campaign'}</th>
              <th>{t('common.all')}</th>
              <th>{locale === 'ar' ? 'الإنفاق' : 'Spend'}</th>
              <th>{locale === 'ar' ? 'الوصول' : 'Reach'}</th>
              <th>ROAS</th>
            </tr>
          </thead>
          <tbody>
            {metaCampaigns.map((c) => (
              <tr key={c.id}>
                <td className="font-medium">{c.name}</td>
                <td>
                  {c.status === 'Active' ? (
                    <StatusBadge status="completed" labelOverride={locale === 'ar' ? 'نشطة' : 'Active'} />
                  ) : (
                    <Badge variant="neutral">{locale === 'ar' ? 'متوقفة' : 'Paused'}</Badge>
                  )}
                </td>
                <td>{c.spend.toFixed(1)} KWD</td>
                <td>{c.reach.toLocaleString()}</td>
                <td className="font-semibold">{c.roas}×</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <p className="mt-3 text-xs text-muted">
        {locale === 'ar'
          ? 'تُنفَّذ المزامنة وإنشاء الحملات عبر موصّل Meta في الخادم.'
          : 'Catalog sync & campaign actions run via the server-side Meta integration adapter.'}
      </p>
    </RoleGuard>
  );
}

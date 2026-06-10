'use client';

import { Table, Badge, Button, StatusBadge } from '@elite/ui/web';
import { useT } from '@/lib/use-t';
import { PageHeader, KpiCard } from '@/components/admin/ui';
import { invoicesZoho, expensesZoho } from '@/lib/admin-sample';
import { RoleGuard } from '@/components/role-guard';

/**
 * Finance — Zoho Books summary (UI only). Numbers are synced from Zoho via the
 * server-side integration adapter; this is the read-only operator view.
 */
export default function FinancePage() {
  const { t, locale } = useT();

  const revenue = invoicesZoho.reduce((s, i) => s + i.amount, 0);
  const expenses = expensesZoho.reduce((s, e) => s + e.amount, 0);

  return (
    <RoleGuard allow={['admin']}>
      <PageHeader
        title={t('nav.finance')}
        subtitle="Zoho Books"
        actions={<Button variant="outline">{locale === 'ar' ? 'مزامنة من Zoho' : 'Sync from Zoho'}</Button>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label={t('admin.revenue')} value={`${revenue.toFixed(1)} KWD`} delta={5.4} />
        <KpiCard label={locale === 'ar' ? 'المصروفات' : 'Expenses'} value={`${expenses.toFixed(1)} KWD`} delta={-2.1} />
        <KpiCard label={locale === 'ar' ? 'صافي الربح' : 'Net'} value={`${(revenue - expenses).toFixed(1)} KWD`} />
        <KpiCard label={locale === 'ar' ? 'فواتير معلّقة' : 'Outstanding'} value="1" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface shadow-sm">
          <h2 className="border-b border-border p-4 text-lg font-bold">{locale === 'ar' ? 'الفواتير' : 'Invoices'}</h2>
          <Table>
            <thead>
              <tr>
                <th>#</th>
                <th>{t('nav.customers')}</th>
                <th>{t('cart.total')}</th>
                <th>{t('common.all')}</th>
              </tr>
            </thead>
            <tbody>
              {invoicesZoho.map((i) => (
                <tr key={i.id}>
                  <td className="font-mono text-xs">{i.id}</td>
                  <td>{i.customer}</td>
                  <td>{i.amount.toFixed(1)} KWD</td>
                  <td>
                    {i.status === 'Paid' ? (
                      <StatusBadge status="completed" labelOverride={locale === 'ar' ? 'مدفوعة' : 'Paid'} />
                    ) : (
                      <Badge variant="warning">{locale === 'ar' ? 'مُرسلة' : 'Sent'}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>

        <div className="rounded-2xl border border-border bg-surface shadow-sm">
          <h2 className="border-b border-border p-4 text-lg font-bold">{locale === 'ar' ? 'المصروفات' : 'Expenses'}</h2>
          <Table>
            <thead>
              <tr>
                <th>#</th>
                <th>{locale === 'ar' ? 'المورّد' : 'Vendor'}</th>
                <th>{locale === 'ar' ? 'الفئة' : 'Category'}</th>
                <th>{t('cart.total')}</th>
              </tr>
            </thead>
            <tbody>
              {expensesZoho.map((e) => (
                <tr key={e.id}>
                  <td className="font-mono text-xs">{e.id}</td>
                  <td>{e.vendor}</td>
                  <td className="text-muted">{e.category}</td>
                  <td>{e.amount.toFixed(1)} KWD</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted">
        {locale === 'ar'
          ? 'البيانات تُزامَن من Zoho Books عبر موصّل التكامل في الخادم.'
          : 'Figures are synced from Zoho Books via the server-side integration adapter.'}
      </p>
    </RoleGuard>
  );
}

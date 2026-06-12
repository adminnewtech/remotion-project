'use client';

import { Table, Badge, StatusBadge } from '@elite/ui/web';
import { useT } from '@/lib/use-t';
import { PageHeader, KpiCard } from '@/components/admin/ui';
import type { FinanceData } from '@/lib/admin-finance';

/** Finance operator view — native figures from orders + expenses (no Zoho). */
export function FinanceView({ data }: { data: FinanceData }) {
  const { t, locale } = useT();
  const ar = locale === 'ar';

  return (
    <>
      <PageHeader
        title={t('nav.finance')}
        subtitle={ar ? 'مالية NewTech' : 'NewTech finance'}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label={t('admin.revenue')} value={`${data.revenue.toFixed(1)} KWD`} />
        <KpiCard label={ar ? 'المصروفات' : 'Expenses'} value={`${data.expenses.toFixed(1)} KWD`} />
        <KpiCard label={ar ? 'صافي الربح' : 'Net'} value={`${data.net.toFixed(1)} KWD`} />
        <KpiCard label={ar ? 'فواتير معلّقة' : 'Outstanding'} value={String(data.outstanding)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface shadow-sm">
          <h2 className="border-b border-border p-4 text-lg font-bold">{ar ? 'الفواتير' : 'Invoices'}</h2>
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
              {data.invoices.map((i) => (
                <tr key={i.id}>
                  <td className="font-mono text-xs">{i.id}</td>
                  <td>{i.customer}</td>
                  <td>{i.amount.toFixed(1)} KWD</td>
                  <td>
                    {i.status === 'paid' ? (
                      <StatusBadge status="completed" labelOverride={ar ? 'مدفوعة' : 'Paid'} />
                    ) : (
                      <Badge variant="warning">{ar ? 'مُرسلة' : 'Sent'}</Badge>
                    )}
                  </td>
                </tr>
              ))}
              {data.invoices.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-sm text-muted">
                    {t('common.none')}
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>

        <div className="rounded-2xl border border-border bg-surface shadow-sm">
          <h2 className="border-b border-border p-4 text-lg font-bold">{ar ? 'المصروفات' : 'Expenses'}</h2>
          <Table>
            <thead>
              <tr>
                <th>#</th>
                <th>{ar ? 'المورّد' : 'Vendor'}</th>
                <th>{ar ? 'الفئة' : 'Category'}</th>
                <th>{t('cart.total')}</th>
              </tr>
            </thead>
            <tbody>
              {data.expenseList.map((e) => (
                <tr key={e.id}>
                  <td className="font-mono text-xs">{e.id}</td>
                  <td>{e.vendor}</td>
                  <td className="text-muted">{e.category}</td>
                  <td>{e.amount.toFixed(1)} KWD</td>
                </tr>
              ))}
              {data.expenseList.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-sm text-muted">
                    {t('common.none')}
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      </div>

      {/* ── Double-entry ledger (migration 0025) ── */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface shadow-sm">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="text-lg font-bold">{ar ? 'قائمة الدخل (دفتر الأستاذ)' : 'P&L (ledger)'}</h2>
            <span className={'text-sm font-bold ' + (data.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
              {ar ? 'صافي' : 'Net'}: {data.netProfit.toFixed(3)} KWD
            </span>
          </div>
          <Table>
            <tbody>
              {data.pnl.map((r) => (
                <tr key={r.code}>
                  <td className="font-mono text-xs">{r.code}</td>
                  <td>{r.name}</td>
                  <td className={'text-end font-semibold ' + (r.kind === 'revenue' ? 'text-emerald-600' : 'text-rose-600')}>
                    {r.kind === 'expense' ? '−' : ''}{r.amount.toFixed(3)}
                  </td>
                </tr>
              ))}
              {data.pnl.length === 0 && <tr><td className="py-5 text-center text-sm text-muted" colSpan={3}>{ar ? 'لا قيود بعد — تُرحَّل تلقائياً مع كل دفعة/مصروف/استلام' : 'No entries yet — auto-posted on every payment/expense/receipt'}</td></tr>}
            </tbody>
          </Table>
        </div>

        <div className="rounded-2xl border border-border bg-surface shadow-sm">
          <h2 className="border-b border-border p-4 text-lg font-bold">{ar ? 'آخر القيود اليومية' : 'Recent journal entries'}</h2>
          <Table>
            <tbody>
              {data.journal.map((j) => (
                <tr key={j.entryNo}>
                  <td className="font-mono text-xs">#{j.entryNo}</td>
                  <td>{j.memo ?? j.source}<br /><small className="text-muted">{j.source} · {j.at.slice(0, 10)}</small></td>
                  <td className="text-end font-semibold">{j.amount.toFixed(3)}</td>
                </tr>
              ))}
              {data.journal.length === 0 && <tr><td className="py-5 text-center text-sm text-muted" colSpan={3}>—</td></tr>}
            </tbody>
          </Table>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted">
        {ar
          ? 'الأرقام محسوبة من دفتر قيود مزدوجة native يترحّل تلقائياً (بدون Zoho).'
          : 'Figures are computed directly from our own orders + expenses (first-party — no Zoho).'}
      </p>
    </>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { useT } from '@/lib/use-t';
import { PageHeader, KpiCard } from '@/components/admin/ui';
import type { CustomersData } from '@/lib/admin-customers';

const CARD = 'rounded-osa border border-osa-border bg-osa-surface shadow-osa';
const fmt = (n: number) => n.toFixed(1);

/** Customers (CRM-lite) — live list with real order count + lifetime spend. */
export function CustomersView({ data }: { data: CustomersData }) {
  const { t, locale } = useT();
  const ar = locale === 'ar';
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return data.rows;
    return data.rows.filter((r) =>
      `${r.name} ${r.phone ?? ''} ${r.email ?? ''}`.toLowerCase().includes(term),
    );
  }, [data.rows, q]);

  return (
    <>
      <PageHeader title={ar ? 'العملاء' : 'Customers'} subtitle={ar ? 'قاعدة عملاء NewTech' : 'NewTech customer base'} />

      <div className="grid grid-cols-2 gap-[14px] lg:grid-cols-3">
        <KpiCard label={ar ? 'إجمالي العملاء' : 'Total customers'} value={String(data.totalCustomers)} />
        <KpiCard label={ar ? 'عملاء لديهم طلبات' : 'With orders'} value={String(data.withOrders)} />
        <KpiCard label={ar ? 'إجمالي الإنفاق' : 'Lifetime spend'} value={`${fmt(data.totalSpent)} KWD`} />
      </div>

      <div className={`${CARD} mt-[14px] overflow-hidden`}>
        <div className="flex items-center justify-between gap-3 border-b border-osa-border p-3">
          <h2 className="text-[14.5px] font-bold text-osa-ink">{ar ? 'القائمة' : 'Directory'}</h2>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={ar ? 'بحث بالاسم أو الهاتف…' : 'Search name or phone…'}
            className="w-56 rounded-osa-sm border border-osa-border bg-osa-surface-2 px-3 py-1.5 text-[13px] text-osa-ink outline-none focus:border-osa-brand-border"
          />
        </div>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {[ar ? 'العميل' : 'Customer', ar ? 'الطلبات' : 'Orders', ar ? 'الإنفاق' : 'Spent', ar ? 'آخر طلب' : 'Last order'].map((h, i) => (
                <th key={i} className="border-b border-osa-border px-[18px] pb-[11px] pt-[14px] text-start text-[11.5px] font-medium text-osa-faint">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-osa-surface-2">
                <td className="border-b border-osa-border px-[18px] py-[11px]">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-osa-brand-dim text-[13px] font-semibold text-osa-brand">
                      {r.name.slice(0, 1)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-osa-ink">{r.name}</p>
                      <p className="num text-[11.5px] text-osa-faint">{r.phone ?? r.email ?? '—'}</p>
                    </div>
                  </div>
                </td>
                <td className="border-b border-osa-border px-[18px] py-[11px]"><span className="num text-osa-muted">{r.orders}</span></td>
                <td className="border-b border-osa-border px-[18px] py-[11px]"><span className="num font-semibold text-osa-ink">{fmt(r.spent)} KWD</span></td>
                <td className="border-b border-osa-border px-[18px] py-[11px]">
                  <span className="num text-[12px] text-osa-muted">{r.lastOrderAt ? r.lastOrderAt.slice(0, 10) : '—'}</span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={4} className="py-8 text-center text-[12.5px] text-osa-faint">{t('common.none')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

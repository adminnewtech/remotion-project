'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useT } from '@/lib/use-t';
import { PageHeader, KpiCard } from '@/components/admin/ui';
import type { CustomersData } from '@/lib/admin-customers';
import type { CustomerTier } from '@/lib/pure/customer-tier';

const CARD = 'rounded-osa border border-osa-border bg-osa-surface shadow-osa';
const fmt = (n: number) => n.toFixed(1);

const TIERS: { key: CustomerTier | 'all'; ar: string; en: string; cls: string }[] = [
  { key: 'all', ar: 'الكل', en: 'All', cls: 'bg-osa-surface-2 text-osa-muted' },
  { key: 'champion', ar: 'مميّزون', en: 'Champions', cls: 'bg-osa-brand-dim text-osa-brand' },
  { key: 'loyal', ar: 'أوفياء', en: 'Loyal', cls: 'bg-osa-green-dim text-osa-green' },
  { key: 'active', ar: 'نشطون', en: 'Active', cls: 'bg-osa-blue-dim text-osa-blue' },
  { key: 'at_risk', ar: 'مهدّدون بالفقد', en: 'At risk', cls: 'bg-osa-rose-dim text-osa-rose' },
  { key: 'new', ar: 'جدد', en: 'New', cls: 'bg-osa-surface-2 text-osa-faint' },
];
const TIER_BADGE: Record<CustomerTier, { ar: string; en: string; cls: string }> = {
  champion: { ar: 'مميّز', en: 'Champion', cls: 'bg-osa-brand-dim text-osa-brand' },
  loyal: { ar: 'وفيّ', en: 'Loyal', cls: 'bg-osa-green-dim text-osa-green' },
  active: { ar: 'نشط', en: 'Active', cls: 'bg-osa-blue-dim text-osa-blue' },
  at_risk: { ar: 'مهدّد', en: 'At risk', cls: 'bg-osa-rose-dim text-osa-rose' },
  new: { ar: 'جديد', en: 'New', cls: 'bg-osa-surface-2 text-osa-faint' },
};

/** Customers (CRM) — segments (RFM tiers), search, CSV export, 360 links. */
export function CustomersView({ data }: { data: CustomersData }) {
  const { t, locale } = useT();
  const ar = locale === 'ar';
  const [q, setQ] = useState('');
  const [seg, setSeg] = useState<CustomerTier | 'all'>('all');

  const segCounts = useMemo(() => {
    const counts: Record<string, number> = { all: data.rows.length };
    for (const r of data.rows) counts[r.tier] = (counts[r.tier] ?? 0) + 1;
    return counts;
  }, [data.rows]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return data.rows.filter((r) => {
      if (seg !== 'all' && r.tier !== seg) return false;
      if (term && !`${r.name} ${r.phone ?? ''} ${r.email ?? ''}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [data.rows, q, seg]);

  function exportCsv() {
    const header = ['name', 'phone', 'email', 'tier', 'orders', 'spent_kwd', 'last_order', 'joined'];
    const lines = rows.map((r) =>
      [r.name, r.phone ?? '', r.email ?? '', r.tier, r.orders, r.spent.toFixed(3), r.lastOrderAt?.slice(0, 10) ?? '', r.joinedAt.slice(0, 10)]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
    const blob = new Blob(['﻿' + [header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers-${seg}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title={ar ? 'العملاء' : 'Customers'}
        subtitle={ar ? 'قاعدة عملاء NewTech' : 'NewTech customer base'}
        actions={
          <button type="button" onClick={exportCsv}
            className="rounded-full border border-osa-border-strong bg-osa-surface px-4 py-[9px] text-[13px] font-semibold text-osa-muted transition-colors hover:bg-osa-surface-2">
            {ar ? 'تصدير CSV' : 'Export CSV'}
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-[14px] lg:grid-cols-3">
        <KpiCard label={ar ? 'إجمالي العملاء' : 'Total customers'} value={String(data.totalCustomers)} />
        <KpiCard label={ar ? 'عملاء لديهم طلبات' : 'With orders'} value={String(data.withOrders)} />
        <KpiCard label={ar ? 'إجمالي الإنفاق' : 'Lifetime spend'} value={`${fmt(data.totalSpent)} KWD`} />
      </div>

      {/* Segments (smart lists) */}
      <div className="mt-[14px] flex flex-wrap gap-1.5">
        {TIERS.map((s) => (
          <button key={s.key} type="button" onClick={() => setSeg(s.key)}
            className={
              'rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all ' +
              (seg === s.key ? `${s.cls} ring-1 ring-current` : 'bg-osa-surface-2 text-osa-faint hover:text-osa-muted')
            }>
            {ar ? s.ar : s.en}
            <span className="num ms-1.5 opacity-70">{segCounts[s.key] ?? 0}</span>
          </button>
        ))}
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
              {[ar ? 'العميل' : 'Customer', ar ? 'الشريحة' : 'Segment', ar ? 'الطلبات' : 'Orders', ar ? 'الإنفاق' : 'Spent', ar ? 'آخر طلب' : 'Last order'].map((h, i) => (
                <th key={i} className="border-b border-osa-border px-[18px] pb-[11px] pt-[14px] text-start text-[11.5px] font-medium text-osa-faint">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const b = TIER_BADGE[r.tier];
              return (
                <tr key={r.id} className="transition-colors hover:bg-osa-surface-2">
                  <td className="border-b border-osa-border px-[18px] py-[11px]">
                    <Link href={`/${locale}/admin/customers/${r.id}`} className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-osa-brand-dim text-[13px] font-semibold text-osa-brand">
                        {r.name.slice(0, 1)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-osa-ink hover:text-osa-brand">{r.name}</p>
                        <p className="num text-[11.5px] text-osa-faint">{r.phone ?? r.email ?? '—'}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="border-b border-osa-border px-[18px] py-[11px]">
                    <span className={`rounded-full px-2.5 py-[3px] text-[11px] font-semibold ${b.cls}`}>{ar ? b.ar : b.en}</span>
                  </td>
                  <td className="border-b border-osa-border px-[18px] py-[11px]"><span className="num text-osa-muted">{r.orders}</span></td>
                  <td className="border-b border-osa-border px-[18px] py-[11px]"><span className="num font-semibold text-osa-ink">{fmt(r.spent)} KWD</span></td>
                  <td className="border-b border-osa-border px-[18px] py-[11px]">
                    <span className="num text-[12px] text-osa-muted">{r.lastOrderAt ? r.lastOrderAt.slice(0, 10) : '—'}</span>
                    {r.tier === 'at_risk' && r.phone && (
                      <a
                        href={`https://wa.me/${r.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(ar ? `مرحباً ${r.name.split(' ')[0]} 👋 اشتقنا لك في نيوتك! عروض جديدة تنتظرك 🎁` : `Hi ${r.name.split(' ')[0]}! We miss you at Newtech — new offers await 🎁`)}`}
                        target="_blank" rel="noreferrer"
                        className="ms-2 rounded-full bg-osa-green-dim px-2.5 py-[3px] text-[10.5px] font-bold text-osa-green"
                      >{ar ? 'استرجاع 💬' : 'Win-back 💬'}</a>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-[12.5px] text-osa-faint">{t('common.none')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

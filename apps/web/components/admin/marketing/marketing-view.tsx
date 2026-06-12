'use client';

import { Table, Badge, Button, StatusBadge } from '@elite/ui/web';
import { useT } from '@/lib/use-t';
import { PageHeader, KpiCard } from '@/components/admin/ui';
import { useState, useTransition } from 'react';
import type { MarketingData, DiscountRow } from '@/lib/admin-marketing';
import { createDiscount, setDiscountActive } from '@/app/[locale]/admin/marketing/actions';

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

      {/* ── Discount codes (native CRUD over the live table) ── */}
      <DiscountsSection rows={data.discounts} ar={ar} />

      <p className="mt-3 text-xs text-muted">
        {ar
          ? 'الحملات مخزّنة عندنا، وخلاصة الكتالوج تُصدَّر من منتجاتنا مباشرة (بدون Shopify).'
          : 'Campaigns are stored first-party; the catalog feed is exported from our own products (no Shopify).'}
      </p>
    </>
  );
}


/** Discount codes manager — checkout already honors these; this is the CRUD. */
function DiscountsSection({ rows, ar }: { rows: DiscountRow[]; ar: boolean }) {
  const [list, setList] = useState<DiscountRow[]>(rows);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(null), 2500);
  }

  function submit(form: FormData) {
    const code = String(form.get('code') ?? '');
    const kind = (String(form.get('kind')) === 'fixed' ? 'fixed' : 'percent') as 'percent' | 'fixed';
    const value = Number(form.get('value'));
    const minSub = Number(form.get('min') ?? 0);
    const limit = Number(form.get('limit') ?? 0) || null;
    startTransition(async () => {
      const res = await createDiscount(code, kind, value, minSub, limit);
      if (res.ok) {
        setList((p) => [{ id: `tmp-${Date.now()}`, code: code.toUpperCase(), kind, value, min_subtotal: minSub, used_count: 0, usage_limit: limit, is_active: true }, ...p]);
        flash(ar ? 'أُنشئ الكود' : 'Code created');
      } else flash(`${ar ? 'فشل' : 'Failed'}: ${res.error}`);
    });
  }
  function toggle(d: DiscountRow) {
    setList((p) => p.map((x) => (x.id === d.id ? { ...x, is_active: !x.is_active } : x)));
    startTransition(async () => {
      await setDiscountActive(d.id, !d.is_active);
    });
  }

  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex items-center justify-between border-b border-border p-4">
        <h2 className="text-lg font-bold">{ar ? 'أكواد الخصم' : 'Discount codes'}</h2>
        {msg && <span className="text-xs font-semibold text-emerald-600">{msg}</span>}
      </div>
      <form action={submit} className="grid gap-2 border-b border-border p-4 sm:grid-cols-[1fr_110px_90px_110px_110px_auto]">
        <input name="code" required placeholder={ar ? 'الكود (مثل EID15)' : 'Code (e.g. EID15)'} className="rounded-lg border border-border bg-bg px-3 py-2 text-sm uppercase" />
        <select name="kind" className="rounded-lg border border-border bg-bg px-2 py-2 text-sm">
          <option value="percent">{ar ? 'نسبة %' : 'Percent %'}</option>
          <option value="fixed">{ar ? 'مبلغ د.ك' : 'Fixed KWD'}</option>
        </select>
        <input name="value" type="number" step="0.001" min="0.001" required placeholder={ar ? 'القيمة' : 'Value'} className="rounded-lg border border-border bg-bg px-3 py-2 text-sm" />
        <input name="min" type="number" step="0.001" min="0" placeholder={ar ? 'حد أدنى' : 'Min subtotal'} className="rounded-lg border border-border bg-bg px-3 py-2 text-sm" />
        <input name="limit" type="number" min="0" placeholder={ar ? 'حد استخدام' : 'Usage limit'} className="rounded-lg border border-border bg-bg px-3 py-2 text-sm" />
        <Button type="submit" size="sm" disabled={pending}>+ {ar ? 'إنشاء' : 'Create'}</Button>
      </form>
      <Table>
        <thead><tr><th>{ar ? 'الكود' : 'Code'}</th><th>{ar ? 'الخصم' : 'Discount'}</th><th>{ar ? 'الاستخدام' : 'Used'}</th><th>{ar ? 'الحالة' : 'Status'}</th><th /></tr></thead>
        <tbody>
          {list.map((d) => (
            <tr key={d.id}>
              <td className="font-mono text-xs font-bold">{d.code}</td>
              <td>{d.kind === 'percent' ? `${d.value}%` : `${d.value.toFixed(3)} KWD`}{d.min_subtotal > 0 ? ` · ${ar ? 'حد أدنى' : 'min'} ${d.min_subtotal}` : ''}</td>
              <td>{d.used_count}{d.usage_limit ? ` / ${d.usage_limit}` : ''}</td>
              <td>{d.is_active ? <StatusBadge status="completed" labelOverride={ar ? 'فعّال' : 'Active'} /> : <Badge variant="neutral">{ar ? 'موقوف' : 'Off'}</Badge>}</td>
              <td className="text-end">
                <button type="button" onClick={() => toggle(d)} className="text-xs font-semibold text-primary">
                  {d.is_active ? (ar ? 'إيقاف' : 'Disable') : (ar ? 'تفعيل' : 'Enable')}
                </button>
              </td>
            </tr>
          ))}
          {list.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-sm text-muted">—</td></tr>}
        </tbody>
      </Table>
    </div>
  );
}

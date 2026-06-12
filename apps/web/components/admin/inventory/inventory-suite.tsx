'use client';

import { useMemo, useState, useTransition } from 'react';
import { PageHeader, KpiCard } from '@/components/admin/ui';
import { useT } from '@/lib/use-t';
import type { InventorySuite, StockRow } from '@/lib/admin-inventory';
import { adjustStock, transferStock, addLocation } from '@/app/[locale]/admin/catalog/inventory/actions';

const CARD = 'rounded-osa border border-osa-border bg-osa-surface shadow-osa';
const FIELD = 'rounded-osa-sm border border-osa-border bg-osa-surface-2 px-3 py-2 text-[13px] text-osa-ink outline-none focus:border-osa-brand-border';
const LOW = 5;

const KIND_AR: Record<string, string> = {
  purchase: 'شراء', sale: 'بيع', adjustment: 'تسوية',
  transfer_in: 'تحويل وارد', transfer_out: 'تحويل صادر', return: 'مرتجع',
};

type Tab = 'stock' | 'moves' | 'locations';
type Dialog = { kind: 'adjust' | 'transfer'; row: StockRow } | null;

export function InventorySuiteView({ data }: { data: InventorySuite }) {
  const { locale } = useT();
  const ar = locale === 'ar';
  const [tab, setTab] = useState<Tab>('stock');
  const [q, setQ] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return data.stock;
    return data.stock.filter((r) => `${r.product} ${r.sku ?? ''} ${r.barcode ?? ''}`.toLowerCase().includes(term));
  }, [data.stock, q]);

  function note(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2600);
  }

  function submitAdjust(form: FormData) {
    const row = dialog!.row;
    const loc = String(form.get('loc'));
    const qty = Number(form.get('qty'));
    const reason = String(form.get('reason') ?? '');
    startTransition(async () => {
      const res = await adjustStock(row.variantId, loc, qty, reason);
      setDialog(null);
      note(res.ok ? (ar ? 'سُجّلت التسوية في الدفتر' : 'Adjustment recorded') : `${ar ? 'فشل' : 'Failed'}: ${res.error}`);
    });
  }
  function submitTransfer(form: FormData) {
    const row = dialog!.row;
    startTransition(async () => {
      const res = await transferStock(
        row.variantId,
        String(form.get('from')),
        String(form.get('to')),
        Number(form.get('qty')),
      );
      setDialog(null);
      note(res.ok ? (ar ? 'تم التحويل (قيدان بالدفتر)' : 'Transferred') : `${ar ? 'فشل' : 'Failed'}: ${res.error}`);
    });
  }
  function submitLocation(form: FormData) {
    startTransition(async () => {
      const res = await addLocation(String(form.get('name')), String(form.get('area') || '') || null);
      note(res.ok ? (ar ? 'أُضيف الموقع' : 'Location added') : `${ar ? 'فشل' : 'Failed'}: ${res.error}`);
    });
  }

  const TABS: { key: Tab; ar: string; en: string }[] = [
    { key: 'stock', ar: 'المخزون حسب الموقع', en: 'Stock by location' },
    { key: 'moves', ar: 'دفتر الحركات', en: 'Movements ledger' },
    { key: 'locations', ar: 'المواقع', en: 'Locations' },
  ];

  return (
    <>
      <PageHeader
        title={ar ? 'المخزون' : 'Inventory'}
        subtitle={ar ? 'مواقع متعددة · دفتر حركات · باركود' : 'Multi-location · ledger · barcode'}
      />

      <div className="grid grid-cols-2 gap-[14px] lg:grid-cols-4">
        <KpiCard label={ar ? 'إجمالي القطع' : 'Total units'} value={String(data.totalUnits)} />
        <KpiCard label={ar ? 'قيمة المخزون' : 'Stock value'} value={`${data.totalValue.toFixed(1)} KWD`} />
        <KpiCard label={ar ? 'منخفض المخزون' : 'Low stock'} value={String(data.lowCount)} />
        <KpiCard label={ar ? 'المواقع' : 'Locations'} value={String(data.locations.length)} />
      </div>

      {flash && <div className="mt-3 rounded-osa-sm bg-osa-green-dim px-3 py-2 text-[12.5px] font-semibold text-osa-green">{flash}</div>}

      <div className="mt-[14px] flex gap-1 rounded-full border border-osa-border bg-osa-surface-2 p-1 w-fit">
        {TABS.map((tb) => (
          <button key={tb.key} type="button" onClick={() => setTab(tb.key)}
            className={'rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition-colors ' + (tab === tb.key ? 'bg-osa-brand text-white' : 'text-osa-muted hover:text-osa-ink')}>
            {ar ? tb.ar : tb.en}
          </button>
        ))}
      </div>

      {tab === 'stock' && (
        <div className={`${CARD} mt-[14px] overflow-x-auto`}>
          <div className="flex items-center justify-between gap-3 border-b border-osa-border p-3">
            <h2 className="text-[14.5px] font-bold text-osa-ink">{ar ? 'مصفوفة المواقع' : 'Location matrix'}</h2>
            <input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder={ar ? 'بحث: اسم / SKU / باركود…' : 'Search name / SKU / barcode…'}
              className={`${FIELD} w-64`} />
          </div>
          <table className="w-full min-w-[720px] border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="border-b border-osa-border px-4 pb-2 pt-3 text-start text-[11.5px] font-medium text-osa-faint">{ar ? 'المنتج' : 'Product'}</th>
                {data.locations.map((l) => (
                  <th key={l.id} className="border-b border-osa-border px-3 pb-2 pt-3 text-center text-[11.5px] font-medium text-osa-faint">{l.name}</th>
                ))}
                <th className="border-b border-osa-border px-3 pb-2 pt-3 text-center text-[11.5px] font-medium text-osa-faint">{ar ? 'الإجمالي' : 'Total'}</th>
                <th className="border-b border-osa-border px-3 pb-2 pt-3" />
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 80).map((r) => (
                <tr key={r.variantId} className="transition-colors hover:bg-osa-surface-2">
                  <td className="border-b border-osa-border px-4 py-2.5">
                    <p className="max-w-[260px] truncate text-[12.5px] font-semibold text-osa-ink">{r.product}</p>
                    <p className="num text-[11px] text-osa-faint">{r.sku ?? '—'}{r.barcode ? ` · ${r.barcode}` : ''}</p>
                  </td>
                  {data.locations.map((l) => (
                    <td key={l.id} className="border-b border-osa-border px-3 py-2.5 text-center">
                      <span className="num text-osa-muted">{r.byLocation[l.id] ?? 0}</span>
                    </td>
                  ))}
                  <td className="border-b border-osa-border px-3 py-2.5 text-center">
                    <span className={'num font-bold ' + (r.total === 0 ? 'text-osa-rose' : r.total <= LOW ? 'text-osa-amber' : 'text-osa-ink')}>{r.total}</span>
                  </td>
                  <td className="border-b border-osa-border px-3 py-2.5 text-end">
                    <button type="button" onClick={() => setDialog({ kind: 'adjust', row: r })} className="me-2 text-[12px] font-semibold text-osa-brand">{ar ? 'تسوية' : 'Adjust'}</button>
                    <button type="button" onClick={() => setDialog({ kind: 'transfer', row: r })} className="text-[12px] font-semibold text-osa-blue">{ar ? 'تحويل' : 'Transfer'}</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={3 + data.locations.length} className="py-8 text-center text-[12.5px] text-osa-faint">—</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'moves' && (
        <div className={`${CARD} mt-[14px] overflow-hidden`}>
          <h2 className="border-b border-osa-border p-3 text-[14.5px] font-bold text-osa-ink">{ar ? 'آخر الحركات (سجل ثابت)' : 'Recent movements (immutable)'}</h2>
          <table className="w-full border-collapse text-[13px]">
            <thead><tr>{[ar ? 'الوقت' : 'Time', ar ? 'المنتج' : 'Product', ar ? 'الموقع' : 'Location', ar ? 'الكمية' : 'Qty', ar ? 'النوع' : 'Kind', ar ? 'مرجع' : 'Ref'].map((h, i) => (<th key={i} className="border-b border-osa-border px-3 pb-2 pt-3 text-start text-[11.5px] font-medium text-osa-faint">{h}</th>))}</tr></thead>
            <tbody>
              {data.moves.map((m) => (
                <tr key={m.id} className="hover:bg-osa-surface-2">
                  <td className="border-b border-osa-border px-3 py-2"><span className="num text-[11.5px] text-osa-faint">{m.at.slice(5, 16).replace('T', ' ')}</span></td>
                  <td className="border-b border-osa-border px-3 py-2"><span className="text-[12.5px] text-osa-ink">{m.product}</span> <span className="num text-[11px] text-osa-faint">{m.sku ?? ''}</span></td>
                  <td className="border-b border-osa-border px-3 py-2 text-osa-muted">{m.location}</td>
                  <td className="border-b border-osa-border px-3 py-2"><span className={'num font-bold ' + (m.qty > 0 ? 'text-osa-green' : 'text-osa-rose')}>{m.qty > 0 ? `+${m.qty}` : m.qty}</span></td>
                  <td className="border-b border-osa-border px-3 py-2"><span className="rounded-full bg-osa-surface-2 px-2 py-[2px] text-[11px] font-semibold text-osa-muted">{KIND_AR[m.kind] ?? m.kind}</span></td>
                  <td className="border-b border-osa-border px-3 py-2"><span className="num text-[11.5px] text-osa-faint">{m.ref ?? m.note ?? '—'}</span></td>
                </tr>
              ))}
              {data.moves.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-[12.5px] text-osa-faint">—</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'locations' && (
        <div className={`${CARD} mt-[14px] p-4`}>
          <div className="mb-4 flex flex-wrap gap-2.5">
            {data.locations.map((l) => (
              <div key={l.id} className="rounded-osa border border-osa-border bg-osa-surface-2 px-4 py-2.5">
                <p className="text-[13px] font-bold text-osa-ink">{l.name}</p>
                <p className="text-[11.5px] text-osa-faint">{l.area ?? '—'}</p>
              </div>
            ))}
          </div>
          <form action={submitLocation} className="flex flex-wrap items-end gap-2">
            <div><label className="mb-1 block text-[11.5px] text-osa-muted">{ar ? 'اسم الموقع (معرض/مخزن/سيارة فني)' : 'Name (store/warehouse/van)'}</label>
              <input name="name" required className={`${FIELD} w-56`} /></div>
            <div><label className="mb-1 block text-[11.5px] text-osa-muted">{ar ? 'المنطقة' : 'Area'}</label>
              <input name="area" className={`${FIELD} w-40`} /></div>
            <button type="submit" disabled={pending} className="rounded-full bg-osa-brand px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50">+ {ar ? 'إضافة' : 'Add'}</button>
          </form>
        </div>
      )}

      {/* ── Dialogs ─────────────────────────────────────────── */}
      {dialog && (
        <div className="fixed inset-0 z-[600] grid place-items-center bg-black/40 p-4" onClick={() => setDialog(null)}>
          <div className={`${CARD} w-full max-w-md p-5`} onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-[15px] font-bold text-osa-ink">
              {dialog.kind === 'adjust' ? (ar ? 'تسوية مخزون' : 'Stock adjustment') : (ar ? 'تحويل بين المواقع' : 'Transfer')}
            </h3>
            <p className="mb-4 text-[12px] text-osa-muted">{dialog.row.product} · {dialog.row.sku ?? '—'}</p>

            {dialog.kind === 'adjust' ? (
              <form action={submitAdjust} className="space-y-3">
                <div><label className="mb-1 block text-[11.5px] text-osa-muted">{ar ? 'الموقع' : 'Location'}</label>
                  <select name="loc" className={`${FIELD} w-full`}>{data.locations.map((l) => <option key={l.id} value={l.id}>{l.name} ({dialog.row.byLocation[l.id] ?? 0})</option>)}</select></div>
                <div><label className="mb-1 block text-[11.5px] text-osa-muted">{ar ? 'الكمية (+/−)' : 'Qty (+/−)'}</label>
                  <input name="qty" type="number" required className={`${FIELD} w-full`} placeholder="-1" /></div>
                <div><label className="mb-1 block text-[11.5px] text-osa-muted">{ar ? 'السبب (إلزامي — يدخل الدفتر)' : 'Reason (required — goes to ledger)'}</label>
                  <select name="reason" className={`${FIELD} w-full`}>
                    {(ar ? ['جرد/تصحيح عدّ', 'تالف', 'فقد/سرقة', 'وحدة عرض', 'هدية/استخدام داخلي'] : ['Count correction', 'Damaged', 'Shrinkage/theft', 'Demo unit', 'Gift/internal']).map((r) => <option key={r} value={r}>{r}</option>)}
                  </select></div>
                <button type="submit" disabled={pending} className="w-full rounded-full bg-osa-brand py-2.5 text-[13px] font-semibold text-white disabled:opacity-50">{ar ? 'تسجيل' : 'Record'}</button>
              </form>
            ) : (
              <form action={submitTransfer} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="mb-1 block text-[11.5px] text-osa-muted">{ar ? 'من' : 'From'}</label>
                    <select name="from" className={`${FIELD} w-full`}>{data.locations.map((l) => <option key={l.id} value={l.id}>{l.name} ({dialog.row.byLocation[l.id] ?? 0})</option>)}</select></div>
                  <div><label className="mb-1 block text-[11.5px] text-osa-muted">{ar ? 'إلى' : 'To'}</label>
                    <select name="to" defaultValue={data.locations[1]?.id} className={`${FIELD} w-full`}>{data.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
                </div>
                <div><label className="mb-1 block text-[11.5px] text-osa-muted">{ar ? 'الكمية' : 'Qty'}</label>
                  <input name="qty" type="number" min={1} required className={`${FIELD} w-full`} /></div>
                <button type="submit" disabled={pending} className="w-full rounded-full bg-osa-blue py-2.5 text-[13px] font-semibold text-white disabled:opacity-50">{ar ? 'تحويل' : 'Transfer'}</button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

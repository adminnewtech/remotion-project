'use client';

import { useMemo, useState, useTransition } from 'react';
import { useT } from '@/lib/use-t';
import { PageHeader } from '@/components/admin/ui';
import type { PosData, PosProduct } from '@/lib/admin-pos';
import { completeSale, type SaleLine, type PosPayment } from '@/app/[locale]/admin/cashier/actions';

const CARD = 'rounded-osa border border-osa-border bg-osa-surface shadow-osa';
const fmt = (n: number) => n.toFixed(3);

interface Line extends SaleLine { stock: number }

/** Point-of-sale: pick products → ticket → take payment → record sale. */
export function Pos({ data }: { data: PosData }) {
  const { locale } = useT();
  const ar = locale === 'ar';
  const [q, setQ] = useState('');
  const [ticket, setTicket] = useState<Line[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const products = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = term
      ? data.products.filter((p) => `${p.name} ${p.sku ?? ''} ${p.barcode ?? ''}`.toLowerCase().includes(term))
      : data.products;
    return list.slice(0, 60);
  }, [data.products, q]);

  const total = useMemo(() => ticket.reduce((s, l) => s + l.unitPrice * l.qty, 0), [ticket]);
  const count = useMemo(() => ticket.reduce((s, l) => s + l.qty, 0), [ticket]);

  function add(p: PosProduct) {
    setDone(null);
    setErr(null);
    setTicket((prev) => {
      const i = prev.findIndex((l) => l.variantId === p.variantId);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i]!, qty: next[i]!.qty + 1 };
        return next;
      }
      return [...prev, { variantId: p.variantId, name: p.name, sku: p.sku, unitPrice: p.price, qty: 1, stock: p.stock }];
    });
  }
  function setQty(variantId: string, qty: number) {
    setTicket((prev) => prev.flatMap((l) => (l.variantId === variantId ? (qty <= 0 ? [] : [{ ...l, qty }]) : [l])));
  }
  function clear() {
    setTicket([]);
    setDone(null);
    setErr(null);
  }

  function pay(method: PosPayment) {
    if (!ticket.length) return;
    setErr(null);
    const lines: SaleLine[] = ticket.map(({ variantId, name, sku, unitPrice, qty }) => ({ variantId, name, sku, unitPrice, qty }));
    startTransition(async () => {
      const res = await completeSale(lines, method);
      if (!res.ok) {
        setErr(res.error ? `تعذّر إتمام البيع: ${res.error}` : 'تعذّر إتمام البيع');
        return;
      }
      setDone(res.orderNumber ?? '—');
      setTicket([]);
    });
  }

  return (
    <>
      <PageHeader title={ar ? 'الكاشير' : 'Cashier'} subtitle={ar ? 'بيع مباشر في المعرض (POS)' : 'In-store point of sale'} />

      <div className="grid gap-[14px] lg:grid-cols-[1fr_360px]">
        {/* Products */}
        <div className={`${CARD} overflow-hidden`}>
          <div className="border-b border-osa-border p-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={ar ? 'امسح باركود أو ابحث (اسم/SKU)…' : 'Scan barcode or search (name/SKU)…'}
              className="w-full rounded-osa-sm border border-osa-border bg-osa-surface-2 px-3 py-2 text-[13px] text-osa-ink outline-none focus:border-osa-brand-border"
            />
          </div>
          <div className="grid max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto p-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <button
                key={p.variantId}
                type="button"
                onClick={() => add(p)}
                className="flex flex-col items-start gap-1 rounded-osa border border-osa-border bg-osa-surface-2 p-2.5 text-start transition-colors hover:border-osa-brand-border active:scale-[.98]"
              >
                <span className="line-clamp-2 min-h-[34px] text-[12px] font-semibold text-osa-ink">{p.name}</span>
                <span className="num text-[13px] font-bold text-osa-brand">{fmt(p.price)} KWD</span>
                <span className={'num text-[10.5px] ' + (p.stock > 0 ? 'text-osa-faint' : 'text-osa-rose')}>
                  {p.stock > 0 ? `${ar ? 'متوفر' : 'stock'}: ${p.stock}` : ar ? 'نفد' : 'out'}
                </span>
              </button>
            ))}
            {products.length === 0 && <p className="col-span-full py-8 text-center text-[12.5px] text-osa-faint">—</p>}
          </div>
        </div>

        {/* Ticket */}
        <div className={`${CARD} flex flex-col`}>
          <div className="flex items-center justify-between border-b border-osa-border p-3">
            <h2 className="text-[14.5px] font-bold text-osa-ink">{ar ? 'الفاتورة' : 'Ticket'}</h2>
            <button type="button" onClick={clear} className="text-[12px] font-semibold text-osa-muted hover:text-osa-rose">
              {ar ? 'مسح' : 'Clear'}
            </button>
          </div>

          <div className="min-h-[200px] flex-1 space-y-2 overflow-y-auto p-3">
            {ticket.map((l) => (
              <div key={l.variantId} className="flex items-center gap-2 rounded-osa-sm bg-osa-surface-2 p-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold text-osa-ink">{l.name}</p>
                  <p className="num text-[11px] text-osa-faint">{fmt(l.unitPrice)} × {l.qty}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setQty(l.variantId, l.qty - 1)} className="h-6 w-6 rounded-full border border-osa-border text-osa-muted">−</button>
                  <span className="num w-6 text-center text-[13px] font-semibold text-osa-ink">{l.qty}</span>
                  <button type="button" onClick={() => setQty(l.variantId, l.qty + 1)} className="h-6 w-6 rounded-full border border-osa-border text-osa-muted">+</button>
                </div>
                <span className="num w-16 text-end text-[12.5px] font-bold text-osa-ink">{fmt(l.unitPrice * l.qty)}</span>
              </div>
            ))}
            {ticket.length === 0 && (
              <p className="py-10 text-center text-[12.5px] text-osa-faint">{ar ? 'أضف منتجات للفاتورة' : 'Add products to the ticket'}</p>
            )}
          </div>

          <div className="border-t border-osa-border p-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px] text-osa-muted">{ar ? 'الإجمالي' : 'Total'} · {count} {ar ? 'قطعة' : 'items'}</span>
              <span className="num text-[20px] font-bold text-osa-ink">{fmt(total)} KWD</span>
            </div>
            {done && <p className="mb-2 rounded-osa-sm bg-osa-green-dim px-3 py-2 text-[12.5px] font-semibold text-osa-green">{ar ? 'تم البيع' : 'Sale complete'} · {done}</p>}
            {err && <p className="mb-2 rounded-osa-sm bg-osa-rose-dim px-3 py-2 text-[12px] font-medium text-osa-rose">{err}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => pay('cash')}
                disabled={pending || ticket.length === 0}
                className="rounded-full border border-osa-border bg-osa-surface px-4 py-2.5 text-[13.5px] font-semibold text-osa-ink transition-colors hover:bg-osa-surface-2 disabled:opacity-50"
              >
                {ar ? 'نقدي' : 'Cash'}
              </button>
              <button
                type="button"
                onClick={() => pay('knet')}
                disabled={pending || ticket.length === 0}
                className="rounded-full bg-osa-brand px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_4px_12px_rgba(184,134,11,.25)] transition-transform active:scale-[.97] disabled:opacity-50"
              >
                {ar ? 'كي‑نت' : 'KNET'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

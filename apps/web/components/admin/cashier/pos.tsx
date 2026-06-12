'use client';

import { useMemo, useState, useTransition, useEffect, useCallback } from 'react';
import { useT } from '@/lib/use-t';
import { PageHeader } from '@/components/admin/ui';
import type { PosData, PosProduct, PosDiscount } from '@/lib/admin-pos';
import {
  completeSale,
  saveQuote,
  listHolds,
  recallHold,
  searchCustomers,
  openShift,
  closeShift,
  cashMove,
  getShiftSummary,
  type SaleLine,
  type PosPayment,
  type HeldTicket,
  type PosCustomer,
  type ShiftSummary,
} from '@/app/[locale]/admin/cashier/actions';
import {
  cartTotals,
  discountEligible,
  maxRedeemablePoints,
  pointsToKwd,
  changeDue,
  tenderCovers,
  quickCashOptions,
  cashVariance,
} from '@/lib/pure/pos';

const CARD = 'rounded-osa border border-osa-border bg-osa-surface shadow-osa';
const fmt = (n: number) => n.toFixed(3);

interface Line extends SaleLine {
  stock: number;
}

type ModalKind = 'open-shift' | 'close-shift' | 'cash-move' | 'tender' | 'holds' | 'customer' | null;

export function Pos({ data }: { data: PosData }) {
  const { locale } = useT();
  const ar = locale === 'ar';

  // ── Catalog + ticket state ──────────────────────────────────────────────────
  const [q, setQ] = useState('');
  const [ticket, setTicket] = useState<Line[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // ── POS feature state ───────────────────────────────────────────────────────
  const [shiftId, setShiftId] = useState<string | null>(data.shift?.id ?? null);
  const [customer, setCustomer] = useState<PosCustomer | null>(null);
  const [discount, setDiscount] = useState<PosDiscount | null>(null);
  const [redeemPoints, setRedeemPoints] = useState(0);
  const [modal, setModal] = useState<ModalKind>(null);

  const products = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = term
      ? data.products.filter((p) => `${p.name} ${p.sku ?? ''} ${p.barcode ?? ''}`.toLowerCase().includes(term))
      : data.products;
    return list.slice(0, 60);
  }, [data.products, q]);

  // Auto-add when the search term matches exactly one barcode (scanner flow).
  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const term = q.trim().toLowerCase();
    if (!term) return;
    const exact = data.products.find((p) => (p.barcode ?? '').toLowerCase() === term || (p.sku ?? '').toLowerCase() === term);
    if (exact) {
      add(exact);
      setQ('');
    } else if (products.length === 1) {
      add(products[0]!);
      setQ('');
    }
  }

  const totals = useMemo(
    () =>
      cartTotals({
        lines: ticket,
        discountKind: discount?.kind ?? null,
        discountValue: discount?.value ?? 0,
        redeemPoints,
      }),
    [ticket, discount, redeemPoints],
  );
  const count = useMemo(() => ticket.reduce((s, l) => s + l.qty, 0), [ticket]);

  // Clamp redeem points to what the bill + balance allow.
  const maxRedeem = useMemo(() => {
    if (!customer) return 0;
    const afterDiscount = Math.max(0, totals.subtotal - totals.discountTotal);
    return maxRedeemablePoints(customer.loyaltyPoints, afterDiscount);
  }, [customer, totals.subtotal, totals.discountTotal]);

  useEffect(() => {
    if (redeemPoints > maxRedeem) setRedeemPoints(maxRedeem);
  }, [maxRedeem, redeemPoints]);

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
    setDiscount(null);
    setRedeemPoints(0);
    setCustomer(null);
  }

  const saleLines = (): SaleLine[] => ticket.map(({ variantId, name, sku, unitPrice, qty }) => ({ variantId, name, sku, unitPrice, qty }));

  function quote() {
    if (!ticket.length) return;
    startTransition(async () => {
      const res = await saveQuote(saleLines());
      if (!res.ok) {
        setErr(res.error ? `${ar ? 'تعذّر حفظ عرض السعر' : 'Quote failed'}: ${res.error}` : ar ? 'تعذّر الحفظ' : 'Failed');
        return;
      }
      setDone(`${ar ? 'عُلّقت الفاتورة' : 'Held'} ${res.orderNumber}`);
      clear();
    });
  }

  function runSale(method: PosPayment, tendered?: number) {
    if (!ticket.length) return;
    setErr(null);
    startTransition(async () => {
      const res = await completeSale({
        lines: saleLines(),
        payment: method,
        shiftId,
        customerId: customer?.id ?? null,
        discount: discount ? { id: discount.id, kind: discount.kind, value: discount.value } : null,
        redeemPoints,
        tendered: tendered ?? null,
      });
      if (!res.ok) {
        setErr(res.error ? `${ar ? 'تعذّر إتمام البيع' : 'Sale failed'}: ${res.error}` : ar ? 'تعذّر إتمام البيع' : 'Sale failed');
        return;
      }
      const changeMsg = res.change && res.change > 0 ? ` · ${ar ? 'الباقي' : 'change'} ${fmt(res.change)} KWD` : '';
      setDone(`${res.orderNumber ?? '—'}${changeMsg}`);
      clear();
      setModal(null);
    });
  }

  function pay(method: PosPayment) {
    if (!ticket.length) return;
    if (method === 'cash') {
      setModal('tender');
      return;
    }
    runSale('knet');
  }

  const shiftOpen = !!shiftId;

  return (
    <>
      <PageHeader
        title={ar ? 'الكاشير' : 'Cashier'}
        subtitle={ar ? 'بيع مباشر في المعرض (POS)' : 'In-store point of sale'}
        actions={<ShiftChip ar={ar} open={shiftOpen} shift={data.shift} onOpen={() => setModal('open-shift')} onClose={() => setModal('close-shift')} onCashMove={() => setModal('cash-move')} />}
      />

      {!shiftOpen && (
        <div className="mb-4 flex items-center gap-3 rounded-osa border border-osa-amber-border bg-osa-amber-dim px-4 py-3 text-[13px] font-semibold text-osa-amber">
          <span className="text-[16px]">🔒</span>
          <span>{ar ? 'افتح وردية لبدء البيع — أدخل العهدة النقدية الافتتاحية.' : 'Open a shift to start selling — enter the opening cash float.'}</span>
          <button type="button" onClick={() => setModal('open-shift')} className="ms-auto rounded-full bg-osa-amber px-3 py-1.5 text-[12px] font-bold text-white">
            {ar ? 'فتح وردية' : 'Open shift'}
          </button>
        </div>
      )}

      <div className="grid gap-[14px] lg:grid-cols-[1fr_380px]">
        {/* Products */}
        <div className={`${CARD} overflow-hidden`}>
          <div className="flex items-center gap-2 border-b border-osa-border p-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onSearchKey}
              placeholder={ar ? 'امسح باركود أو ابحث (اسم/SKU)…' : 'Scan barcode or search (name/SKU)…'}
              className="w-full rounded-osa-sm border border-osa-border bg-osa-surface-2 px-3 py-2 text-[13px] text-osa-ink outline-none focus:border-osa-brand-border"
            />
            <button type="button" onClick={() => setModal('holds')} className="shrink-0 rounded-osa-sm border border-osa-border px-3 py-2 text-[12px] font-semibold text-osa-muted hover:bg-osa-surface-2">
              {ar ? '⏸ المعلّقة' : '⏸ Holds'}
            </button>
          </div>
          <div className="grid max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto p-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <button
                key={p.variantId}
                type="button"
                onClick={() => add(p)}
                disabled={!shiftOpen}
                className="flex flex-col items-start gap-1 rounded-osa border border-osa-border bg-osa-surface-2 p-2.5 text-start transition-colors hover:border-osa-brand-border active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50"
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

          {/* Customer */}
          <div className="border-b border-osa-border p-3">
            {customer ? (
              <div className="flex items-center gap-2 rounded-osa-sm bg-osa-brand-dim px-3 py-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-osa-brand text-[12px] font-bold text-white">
                  {(customer.name ?? '؟').charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold text-osa-ink">{customer.name ?? customer.phone}</p>
                  <p className="num text-[11px] text-osa-brand">{customer.loyaltyPoints} {ar ? 'نقطة' : 'pts'}</p>
                </div>
                <button type="button" onClick={() => { setCustomer(null); setRedeemPoints(0); }} className="text-[12px] text-osa-muted hover:text-osa-rose">✕</button>
              </div>
            ) : (
              <button type="button" onClick={() => setModal('customer')} className="w-full rounded-osa-sm border border-dashed border-osa-border py-2 text-[12.5px] font-semibold text-osa-muted hover:border-osa-brand-border hover:text-osa-brand">
                {ar ? '+ ربط عميل (نقاط الولاء)' : '+ Attach customer (loyalty)'}
              </button>
            )}
          </div>

          <div className="min-h-[160px] flex-1 space-y-2 overflow-y-auto p-3">
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

          {/* Discount + loyalty */}
          {ticket.length > 0 && (
            <div className="space-y-2 border-t border-osa-border px-3 pt-3">
              <DiscountRow ar={ar} discounts={data.discounts} subtotal={totals.subtotal} selected={discount} onSelect={setDiscount} />
              {customer && maxRedeem > 0 && (
                <div className="flex items-center justify-between rounded-osa-sm bg-osa-surface-2 px-2.5 py-2">
                  <label className="flex items-center gap-2 text-[12px] font-semibold text-osa-ink">
                    <input
                      type="checkbox"
                      checked={redeemPoints > 0}
                      onChange={(e) => setRedeemPoints(e.target.checked ? maxRedeem : 0)}
                      className="accent-osa-brand"
                    />
                    {ar ? `استبدال ${maxRedeem} نقطة` : `Redeem ${maxRedeem} pts`}
                  </label>
                  <span className="num text-[12px] font-bold text-osa-brand">−{fmt(pointsToKwd(redeemPoints))} KWD</span>
                </div>
              )}
            </div>
          )}

          {/* Totals + pay */}
          <div className="border-t border-osa-border p-3">
            {totals.discountTotal > 0 && (
              <div className="mb-1 flex items-center justify-between text-[12px] text-osa-muted">
                <span>{ar ? 'الخصم' : 'Discount'}</span>
                <span className="num">−{fmt(totals.discountTotal)} KWD</span>
              </div>
            )}
            {totals.loyaltyValue > 0 && (
              <div className="mb-1 flex items-center justify-between text-[12px] text-osa-muted">
                <span>{ar ? 'نقاط الولاء' : 'Loyalty'}</span>
                <span className="num">−{fmt(totals.loyaltyValue)} KWD</span>
              </div>
            )}
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px] text-osa-muted">{ar ? 'المطلوب' : 'Total'} · {count} {ar ? 'قطعة' : 'items'}</span>
              <span className="num text-[20px] font-bold text-osa-ink">{fmt(totals.total)} KWD</span>
            </div>
            {done && <p className="mb-2 rounded-osa-sm bg-osa-green-dim px-3 py-2 text-[12.5px] font-semibold text-osa-green">{ar ? 'تم' : 'Done'} · {done}</p>}
            {err && <p className="mb-2 rounded-osa-sm bg-osa-rose-dim px-3 py-2 text-[12px] font-medium text-osa-rose">{err}</p>}
            <button type="button" onClick={quote} disabled={pending || ticket.length === 0 || !shiftOpen}
              className="mb-2 w-full rounded-full border border-osa-brand-border bg-osa-brand-dim py-2 text-[12.5px] font-semibold text-osa-brand disabled:opacity-50">
              {ar ? '⏸ تعليق الفاتورة' : '⏸ Hold ticket'}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => pay('cash')} disabled={pending || ticket.length === 0 || !shiftOpen}
                className="rounded-full border border-osa-border bg-osa-surface px-4 py-2.5 text-[13.5px] font-semibold text-osa-ink transition-colors hover:bg-osa-surface-2 disabled:opacity-50">
                {ar ? 'نقدي' : 'Cash'}
              </button>
              <button type="button" onClick={() => pay('knet')} disabled={pending || ticket.length === 0 || !shiftOpen}
                className="rounded-full bg-osa-brand px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_4px_12px_rgba(184,134,11,.25)] transition-transform active:scale-[.97] disabled:opacity-50">
                {ar ? 'كي‑نت' : 'KNET'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {modal === 'open-shift' && (
        <OpenShiftModal ar={ar} pending={pending} onClose={() => setModal(null)} onConfirm={(float) => {
          startTransition(async () => {
            const res = await openShift(float);
            if (res.ok && res.shiftId) { setShiftId(res.shiftId); setModal(null); }
            else setErr(res.error ?? 'failed');
          });
        }} />
      )}
      {modal === 'close-shift' && shiftId && (
        <CloseShiftModal ar={ar} shiftId={shiftId} onClose={() => setModal(null)} onClosed={() => { setShiftId(null); setModal(null); }} />
      )}
      {modal === 'cash-move' && shiftId && (
        <CashMoveModal ar={ar} shiftId={shiftId} onClose={() => setModal(null)} />
      )}
      {modal === 'tender' && (
        <TenderModal ar={ar} total={totals.total} pending={pending} onClose={() => setModal(null)} onConfirm={(t) => runSale('cash', t)} />
      )}
      {modal === 'holds' && (
        <HoldsModal ar={ar} onClose={() => setModal(null)} onRecall={(lines) => {
          setTicket(lines.map((l) => ({ ...l, stock: 0 })));
          setModal(null);
        }} />
      )}
      {modal === 'customer' && (
        <CustomerModal ar={ar} onClose={() => setModal(null)} onPick={(c) => { setCustomer(c); setModal(null); }} />
      )}
    </>
  );
}

// ── Shift chip in the header ────────────────────────────────────────────────
function ShiftChip({ ar, open, shift, onOpen, onClose, onCashMove }: {
  ar: boolean; open: boolean; shift: PosData['shift']; onOpen: () => void; onClose: () => void; onCashMove: () => void;
}) {
  if (!open) {
    return (
      <button type="button" onClick={onOpen} className="rounded-full bg-osa-brand px-4 py-2 text-[12.5px] font-bold text-white">
        {ar ? '🔓 فتح وردية' : '🔓 Open shift'}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="hidden items-center gap-1.5 rounded-full bg-osa-green-dim px-3 py-1.5 text-[12px] font-semibold text-osa-green sm:flex">
        <span className="h-1.5 w-1.5 rounded-full bg-osa-green" />
        {ar ? 'وردية مفتوحة' : 'Shift open'}
        {shift && <span className="num">· {fmt(shift.cashSales + shift.knetSales)} KWD</span>}
      </span>
      <button type="button" onClick={onCashMove} className="rounded-full border border-osa-border px-3 py-1.5 text-[12px] font-semibold text-osa-muted hover:bg-osa-surface-2">
        {ar ? '💵 درج النقد' : '💵 Cash'}
      </button>
      <button type="button" onClick={onClose} className="rounded-full border border-osa-rose-border bg-osa-rose-dim px-3 py-1.5 text-[12px] font-semibold text-osa-rose">
        {ar ? '🔒 إغلاق (Z)' : '🔒 Close (Z)'}
      </button>
    </div>
  );
}

// ── Discount selector ────────────────────────────────────────────────────────
function DiscountRow({ ar, discounts, subtotal, selected, onSelect }: {
  ar: boolean; discounts: PosDiscount[]; subtotal: number; selected: PosDiscount | null; onSelect: (d: PosDiscount | null) => void;
}) {
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  function apply() {
    const c = code.trim().toUpperCase();
    if (!c) return;
    const d = discounts.find((x) => x.code.toUpperCase() === c);
    if (!d) { setMsg(ar ? 'كود غير موجود' : 'Code not found'); return; }
    const ok = discountEligible({
      isActive: true, minSubtotal: d.minSubtotal, subtotal,
      startsAt: d.startsAt, endsAt: d.endsAt, usageLimit: d.usageLimit, usedCount: d.usedCount,
    });
    if (!ok) { setMsg(ar ? 'الكود غير صالح لهذه الفاتورة' : 'Code not valid for this ticket'); return; }
    onSelect(d);
    setMsg(null);
    setCode('');
  }

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-osa-sm bg-osa-green-dim px-2.5 py-2">
        <span className="text-[12px] font-semibold text-osa-green">
          {selected.code} · {selected.kind === 'percent' ? `${selected.value}%` : `${fmt(selected.value)} KWD`}
        </span>
        <button type="button" onClick={() => onSelect(null)} className="text-[12px] text-osa-muted hover:text-osa-rose">✕</button>
      </div>
    );
  }
  return (
    <div>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => { setCode(e.target.value); setMsg(null); }}
          onKeyDown={(e) => e.key === 'Enter' && apply()}
          placeholder={ar ? 'كود خصم' : 'Discount code'}
          className="min-w-0 flex-1 rounded-osa-sm border border-osa-border bg-osa-surface-2 px-2.5 py-1.5 text-[12px] text-osa-ink outline-none focus:border-osa-brand-border"
        />
        <button type="button" onClick={apply} className="shrink-0 rounded-osa-sm border border-osa-brand-border bg-osa-brand-dim px-3 py-1.5 text-[12px] font-semibold text-osa-brand">
          {ar ? 'تطبيق' : 'Apply'}
        </button>
      </div>
      {msg && <p className="mt-1 text-[11px] text-osa-rose">{msg}</p>}
    </div>
  );
}

// ── Modal shell ──────────────────────────────────────────────────────────────
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-osa-border bg-osa-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function OpenShiftModal({ ar, pending, onClose, onConfirm }: { ar: boolean; pending: boolean; onClose: () => void; onConfirm: (float: number) => void }) {
  const [val, setVal] = useState('0');
  return (
    <Modal onClose={onClose}>
      <h2 className="mb-1 text-[16px] font-bold text-osa-ink">{ar ? 'فتح وردية' : 'Open shift'}</h2>
      <p className="mb-4 text-[12.5px] text-osa-muted">{ar ? 'أدخل العهدة النقدية الافتتاحية في الدرج.' : 'Enter the opening cash float in the drawer.'}</p>
      <label className="mb-1 block text-[12.5px] font-semibold text-osa-ink">{ar ? 'العهدة الافتتاحية (KWD)' : 'Opening float (KWD)'}</label>
      <input type="number" inputMode="decimal" step="0.001" value={val} onChange={(e) => setVal(e.target.value)} autoFocus
        className="num mb-4 w-full rounded-osa-sm border border-osa-border bg-osa-surface-2 px-3 py-2 text-[15px] text-osa-ink outline-none focus:border-osa-brand-border" />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-full border border-osa-border px-4 py-2 text-[13px] font-semibold text-osa-muted">{ar ? 'إلغاء' : 'Cancel'}</button>
        <button type="button" disabled={pending} onClick={() => onConfirm(Number(val) || 0)} className="rounded-full bg-osa-brand px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">{ar ? 'فتح' : 'Open'}</button>
      </div>
    </Modal>
  );
}

function CloseShiftModal({ ar, shiftId, onClose, onClosed }: { ar: boolean; shiftId: string; onClose: () => void; onClosed: () => void }) {
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [counted, setCounted] = useState('');
  const [pending, startTransition] = useTransition();
  const [closed, setClosed] = useState<ShiftSummary | null>(null);

  useEffect(() => {
    getShiftSummary(shiftId).then(setSummary);
  }, [shiftId]);

  const expected = summary?.expectedCash ?? 0;
  const variance = counted === '' ? null : cashVariance(Number(counted) || 0, expected);

  function confirm() {
    startTransition(async () => {
      const res = await closeShift(shiftId, Number(counted) || 0, null);
      if (res.ok && res.summary) setClosed(res.summary);
    });
  }

  if (closed) {
    return (
      <Modal onClose={onClosed}>
        <h2 className="mb-3 text-[16px] font-bold text-osa-ink">{ar ? 'تقرير إغلاق الوردية (Z)' : 'Z-Report — Shift Closed'}</h2>
        <ZReport ar={ar} s={closed} />
        <button type="button" onClick={() => { window.print(); }} className="mt-3 mb-2 w-full rounded-full border border-osa-border py-2 text-[12.5px] font-semibold text-osa-muted">{ar ? '🖨 طباعة' : '🖨 Print'}</button>
        <button type="button" onClick={onClosed} className="w-full rounded-full bg-osa-brand py-2 text-[13px] font-semibold text-white">{ar ? 'تم' : 'Done'}</button>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="mb-3 text-[16px] font-bold text-osa-ink">{ar ? 'إغلاق الوردية' : 'Close shift'}</h2>
      {summary ? (
        <>
          <ZReport ar={ar} s={summary} />
          <label className="mb-1 mt-3 block text-[12.5px] font-semibold text-osa-ink">{ar ? 'النقد المعدود في الدرج (KWD)' : 'Counted cash in drawer (KWD)'}</label>
          <input type="number" inputMode="decimal" step="0.001" value={counted} onChange={(e) => setCounted(e.target.value)} autoFocus
            className="num mb-2 w-full rounded-osa-sm border border-osa-border bg-osa-surface-2 px-3 py-2 text-[15px] text-osa-ink outline-none focus:border-osa-brand-border" />
          {variance !== null && (
            <p className={'mb-3 text-[12.5px] font-semibold ' + (Math.abs(variance) < 0.001 ? 'text-osa-green' : variance > 0 ? 'text-osa-amber' : 'text-osa-rose')}>
              {ar ? 'الفرق' : 'Variance'}: <span className="num">{variance > 0 ? '+' : ''}{fmt(variance)} KWD</span> {Math.abs(variance) < 0.001 ? (ar ? '✓ مطابق' : '✓ balanced') : variance > 0 ? (ar ? '(زيادة)' : '(over)') : (ar ? '(عجز)' : '(short)')}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-full border border-osa-border px-4 py-2 text-[13px] font-semibold text-osa-muted">{ar ? 'إلغاء' : 'Cancel'}</button>
            <button type="button" disabled={pending || counted === ''} onClick={confirm} className="rounded-full bg-osa-rose px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">{ar ? 'إغلاق الوردية' : 'Close shift'}</button>
          </div>
        </>
      ) : (
        <p className="py-6 text-center text-[13px] text-osa-faint">{ar ? 'جارٍ التحميل…' : 'Loading…'}</p>
      )}
    </Modal>
  );
}

function ZReport({ ar, s }: { ar: boolean; s: ShiftSummary }) {
  const rows: [string, string][] = [
    [ar ? 'العهدة الافتتاحية' : 'Opening float', `${fmt(s.openingFloat)} KWD`],
    [ar ? 'مبيعات نقدية' : 'Cash sales', `${fmt(s.cashSales)} KWD`],
    [ar ? 'مبيعات كي‑نت' : 'KNET sales', `${fmt(s.knetSales)} KWD`],
    [ar ? 'إجمالي المبيعات' : 'Total sales', `${fmt(s.totalSales)} KWD`],
    [ar ? 'عدد الفواتير' : 'Orders', String(s.orderCount)],
    [ar ? 'إيداع نقد' : 'Pay-in', `${fmt(s.payIn)} KWD`],
    [ar ? 'سحب نقد' : 'Pay-out', `${fmt(s.payOut)} KWD`],
    [ar ? 'تنزيل للخزنة' : 'Drops', `${fmt(s.drop)} KWD`],
    [ar ? 'النقد المتوقع' : 'Expected cash', `${fmt(s.expectedCash)} KWD`],
  ];
  return (
    <div className="rounded-osa-sm border border-osa-border bg-osa-surface-2 p-3">
      <dl className="space-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between text-[12.5px]">
            <dt className="text-osa-muted">{k}</dt>
            <dd className="num font-semibold text-osa-ink">{v}</dd>
          </div>
        ))}
        {s.countedCash != null && (
          <div className="flex items-center justify-between border-t border-osa-border pt-1.5 text-[12.5px]">
            <dt className="text-osa-muted">{ar ? 'المعدود / الفرق' : 'Counted / variance'}</dt>
            <dd className="num font-bold text-osa-ink">{fmt(s.countedCash)} / {s.cashVariance != null ? fmt(s.cashVariance) : '—'}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function CashMoveModal({ ar, shiftId, onClose }: { ar: boolean; shiftId: string; onClose: () => void }) {
  const [kind, setKind] = useState<'pay_in' | 'pay_out' | 'drop'>('pay_in');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const kinds: { k: 'pay_in' | 'pay_out' | 'drop'; ar: string; en: string }[] = [
    { k: 'pay_in', ar: 'إيداع', en: 'Pay-in' },
    { k: 'pay_out', ar: 'سحب', en: 'Pay-out' },
    { k: 'drop', ar: 'للخزنة', en: 'Drop' },
  ];

  function confirm() {
    const amt = Number(amount);
    if (!amt || amt <= 0) { setMsg(ar ? 'أدخل مبلغاً صحيحاً' : 'Enter a valid amount'); return; }
    startTransition(async () => {
      const res = await cashMove(shiftId, kind, amt, reason || null);
      if (res.ok) onClose();
      else setMsg(res.error ?? 'failed');
    });
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="mb-3 text-[16px] font-bold text-osa-ink">{ar ? 'حركة درج النقد' : 'Cash drawer move'}</h2>
      <div className="mb-3 grid grid-cols-3 gap-2">
        {kinds.map((x) => (
          <button key={x.k} type="button" onClick={() => setKind(x.k)}
            className={'rounded-osa-sm border py-2 text-[12.5px] font-semibold ' + (kind === x.k ? 'border-osa-brand-border bg-osa-brand-dim text-osa-brand' : 'border-osa-border text-osa-muted')}>
            {ar ? x.ar : x.en}
          </button>
        ))}
      </div>
      <input type="number" inputMode="decimal" step="0.001" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={ar ? 'المبلغ (KWD)' : 'Amount (KWD)'} autoFocus
        className="num mb-2 w-full rounded-osa-sm border border-osa-border bg-osa-surface-2 px-3 py-2 text-[15px] text-osa-ink outline-none focus:border-osa-brand-border" />
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={ar ? 'السبب (اختياري)' : 'Reason (optional)'}
        className="mb-3 w-full rounded-osa-sm border border-osa-border bg-osa-surface-2 px-3 py-2 text-[13px] text-osa-ink outline-none focus:border-osa-brand-border" />
      {msg && <p className="mb-2 text-[12px] text-osa-rose">{msg}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-full border border-osa-border px-4 py-2 text-[13px] font-semibold text-osa-muted">{ar ? 'إلغاء' : 'Cancel'}</button>
        <button type="button" disabled={pending} onClick={confirm} className="rounded-full bg-osa-brand px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">{ar ? 'تسجيل' : 'Record'}</button>
      </div>
    </Modal>
  );
}

function TenderModal({ ar, total, pending, onClose, onConfirm }: { ar: boolean; total: number; pending: boolean; onClose: () => void; onConfirm: (tendered: number) => void }) {
  const [tendered, setTendered] = useState('');
  const t = Number(tendered) || 0;
  const change = changeDue(total, t);
  const covers = tenderCovers(total, t);
  const quick = quickCashOptions(total);

  return (
    <Modal onClose={onClose}>
      <h2 className="mb-1 text-[16px] font-bold text-osa-ink">{ar ? 'الدفع النقدي' : 'Cash payment'}</h2>
      <div className="mb-3 flex items-center justify-between rounded-osa-sm bg-osa-surface-2 px-3 py-2">
        <span className="text-[13px] text-osa-muted">{ar ? 'المطلوب' : 'Total'}</span>
        <span className="num text-[18px] font-bold text-osa-ink">{fmt(total)} KWD</span>
      </div>
      <div className="mb-2 flex flex-wrap gap-2">
        {quick.map((v) => (
          <button key={v} type="button" onClick={() => setTendered(String(v))}
            className="num rounded-full border border-osa-border bg-osa-surface px-3 py-1.5 text-[12.5px] font-semibold text-osa-ink hover:bg-osa-surface-2">
            {fmt(v)}
          </button>
        ))}
      </div>
      <label className="mb-1 block text-[12.5px] font-semibold text-osa-ink">{ar ? 'المبلغ المستلم (KWD)' : 'Amount tendered (KWD)'}</label>
      <input type="number" inputMode="decimal" step="0.001" value={tendered} onChange={(e) => setTendered(e.target.value)} autoFocus
        className="num mb-3 w-full rounded-osa-sm border border-osa-border bg-osa-surface-2 px-3 py-2 text-[16px] text-osa-ink outline-none focus:border-osa-brand-border" />
      <div className={'mb-3 flex items-center justify-between rounded-osa-sm px-3 py-2 ' + (covers ? 'bg-osa-green-dim' : 'bg-osa-surface-2')}>
        <span className="text-[13px] font-semibold text-osa-muted">{ar ? 'الباقي' : 'Change'}</span>
        <span className={'num text-[18px] font-bold ' + (covers ? 'text-osa-green' : 'text-osa-faint')}>{fmt(change)} KWD</span>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-full border border-osa-border px-4 py-2 text-[13px] font-semibold text-osa-muted">{ar ? 'إلغاء' : 'Cancel'}</button>
        <button type="button" disabled={pending || !covers} onClick={() => onConfirm(t)} className="rounded-full bg-osa-brand px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
          {ar ? 'إتمام البيع' : 'Complete sale'}
        </button>
      </div>
    </Modal>
  );
}

function HoldsModal({ ar, onClose, onRecall }: { ar: boolean; onClose: () => void; onRecall: (lines: SaleLine[]) => void }) {
  const [holds, setHolds] = useState<HeldTicket[] | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => { listHolds().then((r) => setHolds(r.holds)); }, []);

  function recall(id: string) {
    startTransition(async () => {
      const res = await recallHold(id);
      if (res.ok) onRecall(res.lines);
    });
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="mb-3 text-[16px] font-bold text-osa-ink">{ar ? 'الفواتير المعلّقة' : 'Held tickets'}</h2>
      {holds === null ? (
        <p className="py-6 text-center text-[13px] text-osa-faint">{ar ? 'جارٍ التحميل…' : 'Loading…'}</p>
      ) : holds.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-osa-faint">{ar ? 'لا توجد فواتير معلّقة' : 'No held tickets'}</p>
      ) : (
        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {holds.map((h) => (
            <button key={h.id} type="button" disabled={pending} onClick={() => recall(h.id)}
              className="flex w-full items-center justify-between rounded-osa-sm border border-osa-border bg-osa-surface-2 px-3 py-2.5 text-start transition-colors hover:border-osa-brand-border disabled:opacity-50">
              <div>
                <p className="text-[12.5px] font-semibold text-osa-ink">{h.orderNumber}</p>
                <p className="num text-[11px] text-osa-faint">{h.itemCount} {ar ? 'قطعة' : 'items'}</p>
              </div>
              <span className="num text-[13px] font-bold text-osa-brand">{fmt(h.total)} KWD</span>
            </button>
          ))}
        </div>
      )}
      <button type="button" onClick={onClose} className="mt-3 w-full rounded-full border border-osa-border py-2 text-[13px] font-semibold text-osa-muted">{ar ? 'إغلاق' : 'Close'}</button>
    </Modal>
  );
}

function CustomerModal({ ar, onClose, onPick }: { ar: boolean; onClose: () => void; onPick: (c: PosCustomer) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PosCustomer[]>([]);
  const [, startTransition] = useTransition();

  const run = useCallback((term: string) => {
    startTransition(async () => {
      setResults(await searchCustomers(term));
    });
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const id = setTimeout(() => run(q), 250);
    return () => clearTimeout(id);
  }, [q, run]);

  return (
    <Modal onClose={onClose}>
      <h2 className="mb-3 text-[16px] font-bold text-osa-ink">{ar ? 'ربط عميل' : 'Attach customer'}</h2>
      <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder={ar ? 'ابحث بالاسم أو الهاتف…' : 'Search name or phone…'}
        className="mb-3 w-full rounded-osa-sm border border-osa-border bg-osa-surface-2 px-3 py-2 text-[13px] text-osa-ink outline-none focus:border-osa-brand-border" />
      <div className="max-h-[40vh] space-y-2 overflow-y-auto">
        {results.map((c) => (
          <button key={c.id} type="button" onClick={() => onPick(c)}
            className="flex w-full items-center gap-2 rounded-osa-sm border border-osa-border bg-osa-surface-2 px-3 py-2 text-start hover:border-osa-brand-border">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-osa-brand-dim text-[12px] font-bold text-osa-brand">{(c.name ?? '؟').charAt(0)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-semibold text-osa-ink">{c.name ?? (ar ? 'بدون اسم' : 'No name')}</p>
              <p className="num text-[11px] text-osa-faint">{c.phone ?? '—'}</p>
            </div>
            <span className="num text-[11.5px] font-semibold text-osa-brand">{c.loyaltyPoints} {ar ? 'نقطة' : 'pts'}</span>
          </button>
        ))}
        {q.trim().length >= 2 && results.length === 0 && (
          <p className="py-4 text-center text-[12.5px] text-osa-faint">{ar ? 'لا نتائج' : 'No results'}</p>
        )}
      </div>
      <button type="button" onClick={onClose} className="mt-3 w-full rounded-full border border-osa-border py-2 text-[13px] font-semibold text-osa-muted">{ar ? 'إغلاق' : 'Close'}</button>
    </Modal>
  );
}

'use client';

/**
 * Order detail — customer + address, items, totals, lifecycle timeline, a status
 * changer (optimistic + toast via the `setOrderStatus` server action), payment +
 * fulfillment info, and actions (refund stub, print). Rendered both inside the
 * list drawer and on the standalone `/admin/orders/[id]` page.
 */
import { useState, useTransition, type ReactNode } from 'react';
import { StatusPill, PayChip } from '@elite/ui/web';
import type { OrderStatus } from '@elite/types';
import type { AdminOrderDetail } from '@/lib/admin-orders';
import {
  setOrderStatus,
  setOrderTags,
  addOrderNote,
  createReturn,
  settleReturn,
  type ReturnLineInput,
} from '@/app/[locale]/admin/orders/actions';
import { num3, shortDateTime } from './format';
import { STATUS_LABEL, STATUS_TONE, CHANNEL_LABEL, STATUS_FLOW } from './status';
import { useOsaToast } from './toast';

function Money({ v, bold }: { v: number; bold?: boolean }) {
  return (
    <span className={'num ' + (bold ? 'font-semibold text-osa-ink' : 'text-osa-ink')}>
      {num3(v)} <span className="text-[11px] font-normal text-osa-faint">د.ك</span>
    </span>
  );
}

export function OrderDetail({ detail }: { detail: AdminOrderDetail }) {
  const { toast } = useOsaToast();
  const [status, setStatus] = useState<OrderStatus>(detail.status);
  const [rmaOpen, setRmaOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function changeStatus(next: OrderStatus) {
    if (next === status) return;
    const prev = status;
    setStatus(next); // optimistic
    startTransition(async () => {
      const res = await setOrderStatus(detail.id, next);
      if (res.ok) {
        toast(`تم تحديث حالة الطلب ${detail.number} إلى «${STATUS_LABEL[next]}»`, 'success');
      } else {
        setStatus(prev); // rollback
        toast('تعذّر تحديث الحالة، حاول مرة أخرى', 'error');
      }
    });
  }

  const a = detail.address;

  return (
    <div className="space-y-[14px]">
      {/* Header: number + current status + actions */}
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="num text-[18px] font-bold text-osa-brand" style={{ fontFamily: 'var(--font-cairo)' }}>
          {detail.number}
        </h2>
        <StatusPill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</StatusPill>
        <span className="text-[12px] text-osa-faint">{shortDateTime(detail.placedAt)}</span>
        <div className="ms-auto flex gap-2">
          <button
            type="button"
            onClick={() => setRmaOpen(true)}
            className="rounded-osa-sm border border-osa-border-strong px-3 py-1.5 text-[12.5px] font-semibold text-osa-rose transition-transform hover:bg-osa-rose-dim active:scale-[.97]"
          >
            مرتجع / استرداد
          </button>
          <button
            type="button"
            onClick={() => typeof window !== 'undefined' && window.print()}
            className="rounded-osa-sm border border-osa-border-strong px-3 py-1.5 text-[12.5px] font-semibold text-osa-muted transition-transform hover:bg-osa-surface-2 active:scale-[.97]"
          >
            طباعة
          </button>
        </div>
      </div>

      {/* Status changer */}
      <section className="rounded-osa border border-osa-border bg-osa-surface p-[14px_16px]">
        <div className="mb-2.5 text-[12px] font-semibold text-osa-muted">تغيير الحالة</div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FLOW.map((s) => (
            <button
              key={s}
              type="button"
              disabled={pending}
              onClick={() => changeStatus(s)}
              className={
                'rounded-full px-3 py-[5px] text-[12px] font-semibold transition-transform active:scale-[.97] disabled:opacity-60 ' +
                (s === status
                  ? 'bg-osa-brand text-white'
                  : 'border border-osa-border-strong text-osa-muted hover:border-osa-brand-border hover:text-osa-brand')
              }
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </section>

      {/* Customer + fulfillment */}
      <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2">
        <section className="rounded-osa border border-osa-border bg-osa-surface p-[14px_16px]">
          <div className="mb-2 text-[12px] font-semibold text-osa-muted">العميل</div>
          <div className="text-[14px] font-medium text-osa-ink">{detail.customer}</div>
          <div className="num mt-0.5 text-[12.5px] text-osa-muted" dir="ltr">{detail.phone}</div>
          <div className="mt-3 text-[12px] font-semibold text-osa-muted">العنوان</div>
          <p className="mt-1 text-[13px] leading-7 text-osa-ink">
            {a.governorate} · {a.area} · قطعة {a.block} · {a.street} · مبنى {a.building}
          </p>
        </section>

        <section className="rounded-osa border border-osa-border bg-osa-surface p-[14px_16px]">
          <div className="mb-2 text-[12px] font-semibold text-osa-muted">الدفع والتوصيل</div>
          <div className="flex items-center gap-2 text-[13px] text-osa-ink">
            <span className="text-osa-muted">الدفع:</span> <PayChip>{detail.pay}</PayChip>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[13px] text-osa-ink">
            <span className="text-osa-muted">القناة:</span> {CHANNEL_LABEL[detail.channel]}
          </div>
          {detail.deliverySlot && (
            <div className="mt-2 text-[13px] text-osa-ink">
              <span className="text-osa-muted">موعد التوصيل:</span> {shortDateTime(detail.deliverySlot)}
            </div>
          )}
        </section>
      </div>

      {/* Items */}
      <section className="rounded-osa border border-osa-border bg-osa-surface p-[14px_16px]">
        <div className="mb-2.5 text-[12px] font-semibold text-osa-muted">المنتجات</div>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {['المنتج', 'الكمية', 'السعر', 'الإجمالي'].map((h) => (
                <th key={h} className="border-b border-osa-border px-2 pb-2 text-start text-[11px] font-medium text-osa-faint">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {detail.items.map((it) => (
              <tr key={it.id}>
                <td className="border-b border-osa-border px-2 py-2.5 align-middle">
                  <div className="text-osa-ink">{it.name}</div>
                  {it.withInstallation && <small className="text-[11px] text-osa-aqua">مع التركيب</small>}
                  {it.sku && <small className="num ms-2 text-[11px] text-osa-faint">{it.sku}</small>}
                </td>
                <td className="num border-b border-osa-border px-2 py-2.5 align-middle">{it.qty}</td>
                <td className="num border-b border-osa-border px-2 py-2.5 align-middle">{num3(it.unitPrice)}</td>
                <td className="num border-b border-osa-border px-2 py-2.5 align-middle font-semibold text-osa-ink">{num3(it.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-3 ms-auto w-full max-w-[280px] space-y-1.5 text-[13px]">
          <Row label="المجموع الفرعي"><Money v={detail.subtotal} /></Row>
          <Row label="التوصيل"><Money v={detail.deliveryFee} /></Row>
          <Row label="التركيب"><Money v={detail.installationFee} /></Row>
          {detail.discountTotal > 0 && (
            <Row label="الخصم">
              <span className="num text-osa-green">−{num3(detail.discountTotal)} <span className="text-[11px] text-osa-faint">د.ك</span></span>
            </Row>
          )}
          <div className="mt-1.5 flex items-center justify-between border-t border-osa-border pt-2 text-[14px]">
            <span className="font-semibold text-osa-ink">الإجمالي</span>
            <Money v={detail.total} bold />
          </div>
        </div>
      </section>

      {/* Tags + internal note (real audit trail — migration 0018) */}
      <TagsAndNote detail={detail} />

      {rmaOpen && <RmaDialog detail={detail} onClose={() => setRmaOpen(false)} />}

      {/* Timeline */}
      <section className="rounded-osa border border-osa-border bg-osa-surface p-[14px_16px]">
        <div className="mb-3 text-[12px] font-semibold text-osa-muted">المسار الزمني</div>
        <ol className="space-y-3">
          {detail.timeline.map((step) => (
            <li key={step.key} className="flex items-center gap-3 text-[13px]">
              <span
                className={
                  'grid h-[18px] w-[18px] flex-shrink-0 place-items-center rounded-full text-[10px] ' +
                  (step.done ? 'bg-osa-green text-white' : 'border-[1.5px] border-osa-border-strong text-transparent')
                }
                aria-hidden
              >
                ✓
              </span>
              <span className={step.done ? 'text-osa-ink' : 'text-osa-faint'}>{step.label}</span>
              {step.at && <span className="ms-auto text-[11px] text-osa-faint">{shortDateTime(step.at)}</span>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-osa-muted">{label}</span>
      {children}
    </div>
  );
}

/** Ops tags chips + internal note editor — writes to the real audit trail. */
function TagsAndNote({ detail }: { detail: AdminOrderDetail }) {
  const { toast } = useOsaToast();
  const [tags, setTags] = useState<string[]>(detail.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [note, setNote] = useState(detail.internalNote ?? '');
  const [savedNote, setSavedNote] = useState(detail.internalNote ?? '');
  const [pending, startTransition] = useTransition();

  function pushTags(next: string[]) {
    setTags(next);
    startTransition(async () => {
      const res = await setOrderTags(detail.id, next);
      if (!res.ok) toast('تعذّر حفظ الوسوم', 'error');
    });
  }
  function addTag() {
    const v = tagInput.trim();
    if (!v || tags.includes(v)) return setTagInput('');
    setTagInput('');
    pushTags([...tags, v]);
  }
  function saveNote() {
    const v = note.trim();
    if (!v || v === savedNote) return;
    startTransition(async () => {
      const res = await addOrderNote(detail.id, v);
      if (res.ok) {
        setSavedNote(v);
        toast('أُضيفت الملاحظة لسجل الطلب', 'success');
      } else {
        toast('تعذّر حفظ الملاحظة', 'error');
      }
    });
  }

  return (
    <section className="rounded-osa border border-osa-border bg-osa-surface p-[14px_16px]">
      <div className="mb-2.5 text-[12px] font-semibold text-osa-muted">الوسوم والملاحظات</div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-osa-brand-dim px-2.5 py-[3px] text-[11.5px] font-semibold text-osa-brand">
            {t}
            <button type="button" aria-label={`إزالة ${t}`} onClick={() => pushTags(tags.filter((x) => x !== t))} className="text-osa-brand/70 hover:text-osa-rose">×</button>
          </span>
        ))}
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
          placeholder="+ وسم"
          className="w-24 rounded-full border border-osa-border bg-osa-surface-2 px-2.5 py-[3px] text-[11.5px] text-osa-ink outline-none focus:border-osa-brand-border"
        />
      </div>

      <div className="flex gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveNote(); } }}
          placeholder="ملاحظة داخلية — تُسجّل في سجل الطلب"
          className="flex-1 rounded-osa-sm border border-osa-border bg-osa-surface-2 px-3 py-2 text-[12.5px] text-osa-ink outline-none focus:border-osa-brand-border"
        />
        <button
          type="button"
          onClick={saveNote}
          disabled={pending || !note.trim() || note.trim() === savedNote}
          className="rounded-osa-sm border border-osa-border-strong px-3 py-1.5 text-[12.5px] font-semibold text-osa-muted transition-colors hover:bg-osa-surface-2 disabled:opacity-50"
        >
          حفظ
        </button>
      </div>
    </section>
  );
}

/** RMA dialog — pick items/qty + reason → open return; optional instant settle
 * (restock via the atomic ledger + negative payment + order→refunded). */
function RmaDialog({ detail, onClose }: { detail: AdminOrderDetail; onClose: () => void }) {
  const { toast } = useOsaToast();
  const [qtys, setQtys] = useState<Record<string, number>>(
    Object.fromEntries(detail.items.map((it) => [it.id, it.qty])),
  );
  const [reason, setReason] = useState('عيب مصنعي');
  const [restock, setRestock] = useState(true);
  const [instant, setInstant] = useState(true);
  const [pending, startTransition] = useTransition();

  const amount = detail.items.reduce((s, it) => s + (qtys[it.id] ?? 0) * it.unitPrice, 0);

  function submit() {
    const lines: ReturnLineInput[] = detail.items
      .filter((it) => (qtys[it.id] ?? 0) > 0)
      .map((it) => ({ orderItemId: it.id, variantId: null, qty: qtys[it.id]!, unitPrice: it.unitPrice }));
    if (!lines.length) return;
    startTransition(async () => {
      const res = await createReturn(detail.id, reason, lines, restock);
      if (!res.ok) {
        toast(`تعذّر فتح المرتجع: ${res.error}`, 'error');
        return;
      }
      if (instant && res.returnId && res.live) {
        const settle = await settleReturn(res.returnId);
        toast(
          settle.ok
            ? `تمت تسوية ${res.rma} — استرداد ${amount.toFixed(3)} د.ك${restock ? ' وإعادة للمخزون' : ''}`
            : `فُتح ${res.rma} لكن تعذّرت التسوية: ${settle.error}`,
          settle.ok ? 'success' : 'error',
        );
      } else {
        toast(`فُتح المرتجع ${res.rma}`, 'success');
      }
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-[600] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-osa border border-osa-border bg-osa-surface p-5 shadow-osa"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 text-[15px] font-bold text-osa-ink">مرتجع / استرداد — {detail.number}</h3>
        <p className="mb-4 text-[12px] text-osa-muted">حدّد الكميات المرتجعة لكل صنف</p>

        <div className="mb-3 max-h-48 space-y-2 overflow-y-auto">
          {detail.items.map((it) => (
            <div key={it.id} className="flex items-center gap-2 rounded-osa-sm bg-osa-surface-2 p-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold text-osa-ink">{it.name}</p>
                <p className="num text-[11px] text-osa-faint">{it.unitPrice.toFixed(3)} × {it.qty}</p>
              </div>
              <input
                type="number"
                min={0}
                max={it.qty}
                value={qtys[it.id] ?? 0}
                onChange={(e) => setQtys((p) => ({ ...p, [it.id]: Math.max(0, Math.min(it.qty, Number(e.target.value))) }))}
                className="w-16 rounded-osa-sm border border-osa-border bg-osa-surface px-2 py-1.5 text-center text-[13px] text-osa-ink outline-none focus:border-osa-brand-border"
                aria-label={`كمية ${it.name}`}
              />
            </div>
          ))}
        </div>

        <label className="mb-1 block text-[11.5px] text-osa-muted">السبب</label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mb-3 w-full rounded-osa-sm border border-osa-border bg-osa-surface-2 px-3 py-2 text-[13px] text-osa-ink outline-none focus:border-osa-brand-border"
        >
          {['عيب مصنعي', 'منتج خاطئ', 'تغيير رأي العميل', 'تضرر بالشحن', 'أخرى'].map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        <div className="mb-4 space-y-2">
          <label className="flex items-center justify-between rounded-osa-sm bg-osa-surface-2 px-3 py-2 text-[12.5px] text-osa-ink">
            إعادة للمخزون (قيد «مرتجع» بالدفتر)
            <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
          </label>
          <label className="flex items-center justify-between rounded-osa-sm bg-osa-surface-2 px-3 py-2 text-[12.5px] text-osa-ink">
            تسوية فورية (استلام + استرداد)
            <input type="checkbox" checked={instant} onChange={(e) => setInstant(e.target.checked)} />
          </label>
        </div>

        <div className="mb-4 flex items-center justify-between text-[13px]">
          <span className="text-osa-muted">مبلغ الاسترداد</span>
          <span className="num font-bold text-osa-rose">{amount.toFixed(3)} د.ك</span>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={pending || amount <= 0}
          className="w-full rounded-full bg-osa-rose py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          {instant ? 'فتح وتسوية المرتجع' : 'فتح المرتجع'}
        </button>
      </div>
    </div>
  );
}

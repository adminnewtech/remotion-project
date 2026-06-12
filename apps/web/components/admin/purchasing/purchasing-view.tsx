'use client';

import { useState, useTransition } from 'react';
import { PageHeader } from '@/components/admin/ui';
import { useT } from '@/lib/use-t';
import type { PurchasingData, PoRow } from '@/lib/admin-purchasing';
import { addSupplier, createPo, receivePoLine, type NewPoLine } from '@/app/[locale]/admin/purchasing/actions';

const CARD = 'rounded-osa border border-osa-border bg-osa-surface shadow-osa';
const FIELD = 'rounded-osa-sm border border-osa-border bg-osa-surface-2 px-3 py-2 text-[13px] text-osa-ink outline-none focus:border-osa-brand-border';

const STATUS_AR: Record<string, { label: string; cls: string }> = {
  draft: { label: 'مسودة', cls: 'bg-osa-surface-2 text-osa-muted' },
  ordered: { label: 'مطلوب', cls: 'bg-osa-blue-dim text-osa-blue' },
  partial: { label: 'استلام جزئي', cls: 'bg-osa-amber-dim text-osa-amber' },
  received: { label: 'مستلم', cls: 'bg-osa-green-dim text-osa-green' },
  cancelled: { label: 'ملغي', cls: 'bg-osa-rose-dim text-osa-rose' },
};

export function PurchasingView({ data }: { data: PurchasingData }) {
  const { locale } = useT();
  const ar = locale === 'ar';
  const [openPo, setOpenPo] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function note(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2800);
  }

  return (
    <>
      <PageHeader
        title={ar ? 'المشتريات' : 'Purchasing'}
        subtitle={ar ? 'موردون · أوامر شراء · استلام بسيريالات' : 'Suppliers · POs · serialized receiving'}
        actions={
          <button type="button" onClick={() => setCreating((v) => !v)}
            className="rounded-full bg-osa-brand px-5 py-[9px] text-[13.5px] font-semibold text-white shadow-[0_4px_12px_rgba(184,134,11,.25)] active:scale-[.97]">
            + {ar ? 'أمر شراء' : 'New PO'}
          </button>
        }
      />

      {flash && <div className="mb-3 rounded-osa-sm bg-osa-green-dim px-3 py-2 text-[12.5px] font-semibold text-osa-green">{flash}</div>}

      {creating && <NewPoForm data={data} onDone={(msg) => { setCreating(false); note(msg); }} />}

      <div className="space-y-3">
        {data.pos.map((po) => (
          <PoCard key={po.id} po={po} open={openPo === po.id} onToggle={() => setOpenPo(openPo === po.id ? null : po.id)} onNote={note} pending={pending} startTransition={startTransition} ar={ar} />
        ))}
        {data.pos.length === 0 && <div className={`${CARD} p-8 text-center text-[12.5px] text-osa-faint`}>{ar ? 'لا أوامر شراء بعد' : 'No purchase orders yet'}</div>}
      </div>
    </>
  );
}

function PoCard({ po, open, onToggle, onNote, pending, startTransition, ar }: {
  po: PoRow; open: boolean; onToggle: () => void; onNote: (m: string) => void;
  pending: boolean; startTransition: (cb: () => Promise<void>) => void; ar: boolean;
}) {
  const st = STATUS_AR[po.status] ?? STATUS_AR.ordered!;
  const totalOrdered = po.lines.reduce((s, l) => s + l.qty_ordered, 0);
  const totalReceived = po.lines.reduce((s, l) => s + Math.min(l.qty_received, l.qty_ordered), 0);

  function receive(lineId: string, form: FormData) {
    startTransition(async () => {
      const res = await receivePoLine(po.id, lineId, Number(form.get('qty')), String(form.get('serials') ?? ''), String(form.get('batch') || '') || null);
      onNote(res.ok ? (ar ? 'تم الاستلام وقُيّد بالدفتر' : 'Received & ledgered') : `${ar ? 'فشل' : 'Failed'}: ${res.error}`);
    });
  }

  return (
    <div className={CARD}>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 p-4 text-start">
        <span className="num text-[14px] font-bold text-osa-brand">{po.number}</span>
        <span className={`rounded-full px-2.5 py-[3px] text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
        <span className="text-[12.5px] text-osa-muted">{po.supplier} ← {po.location}</span>
        <span className="num ms-auto text-[12px] text-osa-faint">{totalReceived}/{totalOrdered} · {po.createdAt.slice(0, 10)}</span>
      </button>

      {open && (
        <div className="border-t border-osa-border p-4">
          {po.lines.map((l) => {
            const remaining = l.qty_ordered - l.qty_received;
            return (
              <div key={l.id} className="mb-3 rounded-osa-sm bg-osa-surface-2 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-semibold text-osa-ink">{l.label}</p>
                    <p className="num text-[11px] text-osa-faint">{l.sku ?? '—'} · {ar ? 'تكلفة' : 'cost'} {l.unit_cost.toFixed(3)}</p>
                  </div>
                  <span className="num text-[12.5px] font-bold text-osa-ink">{l.qty_received}/{l.qty_ordered}</span>
                </div>
                {remaining > 0 && po.status !== 'cancelled' && (
                  <form action={(f) => receive(l.id, f)} className="grid gap-2 sm:grid-cols-[90px_120px_1fr_auto]">
                    <input name="qty" type="number" min={1} max={remaining} defaultValue={remaining} className={FIELD} aria-label="qty" />
                    <input name="batch" placeholder={ar ? 'دفعة (اختياري)' : 'Batch (opt)'} className={FIELD} />
                    <textarea name="serials" rows={1} placeholder={ar ? 'سيريالات — سطر لكل وحدة (اختياري، العدد = الكمية)' : 'Serials — one per line (optional, count = qty)'} className={`${FIELD} resize-y`} />
                    <button type="submit" disabled={pending} className="rounded-full bg-osa-green px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50">{ar ? 'استلام' : 'Receive'}</button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewPoForm({ data, onDone }: { data: PurchasingData; onDone: (msg: string) => void }) {
  const { locale } = useT();
  const ar = locale === 'ar';
  const [lines, setLines] = useState<NewPoLine[]>([{ variantId: '', qty: 1, unitCost: 0 }]);
  const [supplierId, setSupplierId] = useState<string>(data.suppliers[0]?.id ?? '');
  const [newSupplier, setNewSupplier] = useState('');
  const [locationId, setLocationId] = useState<string>(data.locations[0]?.id ?? '');
  const [pending, startTransition] = useTransition();

  function setLine(i: number, patch: Partial<NewPoLine>) {
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  function submit() {
    startTransition(async () => {
      let sup = supplierId || null;
      if (newSupplier.trim()) {
        const res = await addSupplier(newSupplier, null);
        if (res.id) sup = res.id;
      }
      const res = await createPo(sup, locationId, lines);
      onDone(res.ok ? (ar ? 'أُنشئ أمر الشراء' : 'PO created') : `${ar ? 'فشل' : 'Failed'}: ${res.error}`);
    });
  }

  return (
    <div className={`${CARD} mb-4 p-4`}>
      <h3 className="mb-3 text-[14px] font-bold text-osa-ink">{ar ? 'أمر شراء جديد' : 'New purchase order'}</h3>
      <div className="mb-3 grid gap-2 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-[11.5px] text-osa-muted">{ar ? 'المورد' : 'Supplier'}</label>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={`${FIELD} w-full`}>
            <option value="">{ar ? '— اختر —' : '— pick —'}</option>
            {data.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11.5px] text-osa-muted">{ar ? 'أو مورد جديد' : 'Or new supplier'}</label>
          <input value={newSupplier} onChange={(e) => setNewSupplier(e.target.value)} className={`${FIELD} w-full`} />
        </div>
        <div>
          <label className="mb-1 block text-[11.5px] text-osa-muted">{ar ? 'الاستلام في' : 'Receive at'}</label>
          <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={`${FIELD} w-full`}>
            {data.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      </div>

      {lines.map((l, i) => (
        <div key={i} className="mb-2 grid gap-2 sm:grid-cols-[1fr_100px_120px]">
          <select value={l.variantId} onChange={(e) => setLine(i, { variantId: e.target.value })} className={FIELD}>
            <option value="">{ar ? '— منتج —' : '— product —'}</option>
            {data.variants.map((v) => <option key={v.id} value={v.id}>{v.label}{v.sku ? ` (${v.sku})` : ''}</option>)}
          </select>
          <input type="number" min={1} value={l.qty} onChange={(e) => setLine(i, { qty: Number(e.target.value) })} className={FIELD} aria-label="qty" />
          <input type="number" step="0.001" min={0} value={l.unitCost} onChange={(e) => setLine(i, { unitCost: Number(e.target.value) })} className={FIELD} aria-label="cost" placeholder={ar ? 'التكلفة' : 'Cost'} />
        </div>
      ))}
      <div className="flex gap-2">
        <button type="button" onClick={() => setLines((p) => [...p, { variantId: '', qty: 1, unitCost: 0 }])}
          className="rounded-full border border-osa-border px-3.5 py-1.5 text-[12px] font-semibold text-osa-muted">+ {ar ? 'سطر' : 'Line'}</button>
        <button type="button" onClick={submit} disabled={pending}
          className="ms-auto rounded-full bg-osa-brand px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-50">{ar ? 'إنشاء' : 'Create'}</button>
      </div>
    </div>
  );
}

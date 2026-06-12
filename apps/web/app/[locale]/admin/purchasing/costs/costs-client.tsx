'use client';

/**
 * Landed Costs UI — lists purchase orders, lets ops add cost lines (freight,
 * customs, clearance, other) and trigger the allocate_landed_costs RPC per PO.
 * Arabic-first RTL, bilingual, osa-* design tokens.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RoleGuard } from '@/components/role-guard';
import { PageHeader } from '@/components/admin/ui';
import { useT } from '@/lib/use-t';
import type { LandedCostsData, PoWithCosts, CostKind, CostAllocation } from '@/lib/admin-landed-costs';
import { addPoCost, allocateLandedCosts } from './actions';

const CARD = 'rounded-osa border border-osa-border bg-osa-surface shadow-osa';

const KIND_LABELS: Record<CostKind, { ar: string; en: string }> = {
  freight: { ar: 'شحن', en: 'Freight' },
  customs: { ar: 'جمارك', en: 'Customs' },
  clearance: { ar: 'تخليص', en: 'Clearance' },
  other: { ar: 'أخرى', en: 'Other' },
};

const STATUS_COLORS: Record<string, string> = {
  ordered: 'bg-blue-100 text-blue-700',
  partial: 'bg-amber-100 text-amber-700',
  received: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

function fmt3(n: number): string {
  return n.toFixed(3);
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ar-KW', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

interface AddCostFormProps {
  poId: string;
  ar: boolean;
  onDone: () => void;
}

function AddCostForm({ poId, ar, onDone }: AddCostFormProps) {
  const [kind, setKind] = useState<CostKind>('freight');
  const [allocation, setAllocation] = useState<CostAllocation>('by_value');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const KINDS: CostKind[] = ['freight', 'customs', 'clearance', 'other'];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 0) {
      setError(ar ? 'أدخل مبلغاً صحيحاً' : 'Enter a valid amount');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await addPoCost(poId, kind, amt, allocation, note.trim() || null);
      if (res.ok) {
        onDone();
      } else {
        setError(res.error ?? (ar ? 'حدث خطأ' : 'An error occurred'));
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 rounded-osa border border-osa-border bg-osa-surface-2 p-4">
      <h4 className="mb-3 text-[13px] font-bold text-osa-ink">
        {ar ? 'إضافة تكلفة إضافية' : 'Add Cost Line'}
      </h4>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Kind */}
        <div>
          <label className="mb-1 block text-[12px] font-medium text-osa-muted">
            {ar ? 'نوع التكلفة' : 'Cost Type'}
          </label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as CostKind)}
            className="w-full rounded-osa border border-osa-border bg-osa-surface px-3 py-2 text-[13px] text-osa-ink focus:outline-none focus:ring-2 focus:ring-osa-brand"
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {ar ? KIND_LABELS[k].ar : KIND_LABELS[k].en}
              </option>
            ))}
          </select>
        </div>

        {/* Amount */}
        <div>
          <label className="mb-1 block text-[12px] font-medium text-osa-muted">
            {ar ? 'المبلغ (د.ك)' : 'Amount (KWD)'}
          </label>
          <input
            type="number"
            min="0"
            step="0.001"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.000"
            className="w-full rounded-osa border border-osa-border bg-osa-surface px-3 py-2 text-[13px] text-osa-ink placeholder:text-osa-faint focus:outline-none focus:ring-2 focus:ring-osa-brand"
            required
          />
        </div>

        {/* Allocation */}
        <div>
          <label className="mb-1 block text-[12px] font-medium text-osa-muted">
            {ar ? 'طريقة التوزيع' : 'Allocation Method'}
          </label>
          <select
            value={allocation}
            onChange={(e) => setAllocation(e.target.value as CostAllocation)}
            className="w-full rounded-osa border border-osa-border bg-osa-surface px-3 py-2 text-[13px] text-osa-ink focus:outline-none focus:ring-2 focus:ring-osa-brand"
          >
            <option value="by_value">{ar ? 'بالقيمة' : 'By Value'}</option>
            <option value="by_qty">{ar ? 'بالكمية' : 'By Qty'}</option>
          </select>
        </div>

        {/* Note */}
        <div>
          <label className="mb-1 block text-[12px] font-medium text-osa-muted">
            {ar ? 'ملاحظة (اختياري)' : 'Note (optional)'}
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={ar ? 'مثال: DHL شحن جوي' : 'e.g. DHL air freight'}
            className="w-full rounded-osa border border-osa-border bg-osa-surface px-3 py-2 text-[13px] text-osa-ink placeholder:text-osa-faint focus:outline-none focus:ring-2 focus:ring-osa-brand"
          />
        </div>
      </div>

      {error && (
        <p className="mt-2 text-[12px] text-red-600">{error}</p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-osa bg-osa-brand px-4 py-1.5 text-[13px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending
            ? ar ? 'جارٍ الحفظ…' : 'Saving…'
            : ar ? 'حفظ' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={pending}
          className="rounded-osa border border-osa-border bg-osa-surface px-4 py-1.5 text-[13px] font-medium text-osa-muted hover:bg-osa-surface-2 disabled:opacity-50"
        >
          {ar ? 'إلغاء' : 'Cancel'}
        </button>
      </div>
    </form>
  );
}

interface PoCardProps {
  po: PoWithCosts;
  ar: boolean;
  onRefresh: () => void;
}

function PoCard({ po, ar, onRefresh }: PoCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [allocating, startAllocate] = useTransition();
  const [allocError, setAllocError] = useState<string | null>(null);
  const [allocOk, setAllocOk] = useState(false);

  function handleAllocate() {
    setAllocError(null);
    setAllocOk(false);
    startAllocate(async () => {
      const res = await allocateLandedCosts(po.id);
      if (res.ok) {
        setAllocOk(true);
        onRefresh();
      } else {
        setAllocError(res.error ?? (ar ? 'فشل التوزيع' : 'Allocation failed'));
      }
    });
  }

  function handleFormDone() {
    setShowForm(false);
    onRefresh();
  }

  const statusColor = STATUS_COLORS[po.status] ?? 'bg-osa-surface-2 text-osa-muted';

  return (
    <div className={`${CARD} overflow-hidden`}>
      {/* Header row */}
      <div
        className="flex cursor-pointer flex-wrap items-center gap-3 px-5 py-4 hover:bg-osa-surface-2"
        onClick={() => setExpanded((v) => !v)}
        role="button"
        aria-expanded={expanded}
      >
        <span className="num text-[14px] font-bold text-osa-ink">{po.number}</span>
        <span className="text-[13px] text-osa-muted">{po.supplier}</span>

        <span className={`ms-auto rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusColor}`}>
          {po.status}
        </span>

        <div className="flex flex-col items-end text-end">
          <span className="num text-[13px] font-semibold text-osa-ink">
            {fmt3(po.totalCosts)} {ar ? 'د.ك' : 'KWD'}
          </span>
          <span className="text-[11px] text-osa-faint">{formatDate(po.createdAt)}</span>
        </div>

        {po.allocated ? (
          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-semibold text-green-700">
            {ar ? 'موزَّع' : 'Allocated'}
          </span>
        ) : (
          <span className="rounded-full bg-osa-surface-3 px-2.5 py-0.5 text-[11px] font-semibold text-osa-faint">
            {ar ? 'غير موزَّع' : 'Not allocated'}
          </span>
        )}

        <span className="text-[12px] text-osa-faint">{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-osa-border px-5 py-4">
          {/* Cost lines table */}
          {po.costs.length > 0 ? (
            <table className="mb-4 w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  {[
                    ar ? 'النوع' : 'Type',
                    ar ? 'المبلغ' : 'Amount',
                    ar ? 'التوزيع' : 'Alloc',
                    ar ? 'ملاحظة' : 'Note',
                  ].map((h) => (
                    <th
                      key={h}
                      className="border-b border-osa-border pb-2 pt-1 text-start text-[11.5px] font-medium text-osa-faint"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {po.costs.map((c) => (
                  <tr key={c.id} className="hover:bg-osa-surface-2">
                    <td className="border-b border-osa-border py-2 pe-4">
                      <span className="rounded-full bg-osa-brand-dim px-2 py-0.5 text-[11.5px] font-semibold text-osa-brand">
                        {ar ? KIND_LABELS[c.kind].ar : KIND_LABELS[c.kind].en}
                      </span>
                    </td>
                    <td className="num border-b border-osa-border py-2 pe-4 font-semibold text-osa-ink">
                      {fmt3(c.amount)} {ar ? 'د.ك' : 'KWD'}
                    </td>
                    <td className="border-b border-osa-border py-2 pe-4 text-osa-muted">
                      {c.allocation === 'by_value'
                        ? ar ? 'بالقيمة' : 'By Value'
                        : ar ? 'بالكمية' : 'By Qty'}
                    </td>
                    <td className="border-b border-osa-border py-2 text-osa-faint">
                      {c.note ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mb-4 text-[13px] text-osa-faint">
              {ar ? 'لا توجد تكاليف مضافة بعد.' : 'No cost lines yet.'}
            </p>
          )}

          {/* Action bar */}
          <div className="flex flex-wrap items-center gap-2">
            {!showForm && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="rounded-osa border border-osa-border bg-osa-surface px-3 py-1.5 text-[12.5px] font-medium text-osa-ink hover:bg-osa-surface-2"
              >
                + {ar ? 'إضافة تكلفة' : 'Add Cost'}
              </button>
            )}

            {po.costs.length > 0 && !po.allocated && (
              <button
                type="button"
                disabled={allocating}
                onClick={handleAllocate}
                className="rounded-osa bg-osa-green px-3 py-1.5 text-[12.5px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {allocating
                  ? ar ? 'جارٍ التوزيع…' : 'Allocating…'
                  : ar ? 'توزيع التكاليف' : 'Allocate Costs'}
              </button>
            )}

            {po.allocated && (
              <button
                type="button"
                disabled={allocating}
                onClick={handleAllocate}
                className="rounded-osa border border-osa-border bg-osa-surface px-3 py-1.5 text-[12.5px] font-medium text-osa-muted hover:bg-osa-surface-2 disabled:opacity-50"
              >
                {allocating
                  ? ar ? 'جارٍ إعادة التوزيع…' : 'Re-allocating…'
                  : ar ? 'إعادة توزيع' : 'Re-allocate'}
              </button>
            )}
          </div>

          {allocError && (
            <p className="mt-2 text-[12px] text-red-600">{allocError}</p>
          )}
          {allocOk && (
            <p className="mt-2 text-[12px] text-green-600">
              {ar ? 'تم توزيع التكاليف بنجاح.' : 'Costs allocated successfully.'}
            </p>
          )}

          {showForm && (
            <AddCostForm poId={po.id} ar={ar} onDone={handleFormDone} />
          )}
        </div>
      )}
    </div>
  );
}

export function CostsClient({ data }: { data: LandedCostsData }) {
  const { locale } = useT();
  const router = useRouter();
  const ar = locale === 'ar';

  const totalCosts = data.pos.reduce((s, p) => s + p.totalCosts, 0);
  const allocatedCount = data.pos.filter((p) => p.allocated).length;

  function refresh() {
    router.refresh();
  }

  return (
    <RoleGuard allow={['admin']}>
      <PageHeader
        title={ar ? 'التكاليف الإضافية للمشتريات' : 'Landed Costs'}
        subtitle={ar ? 'إضافة وتوزيع تكاليف الشحن والجمارك على أوامر الشراء' : 'Add and allocate freight, customs, and clearance costs across purchase orders'}
      />

      {/* Summary strip */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          {
            label: ar ? 'إجمالي أوامر الشراء' : 'Purchase Orders',
            value: String(data.pos.length),
            color: 'text-osa-ink',
          },
          {
            label: ar ? 'إجمالي التكاليف' : 'Total Costs',
            value: `${data.pos.reduce((s, p) => s + p.totalCosts, 0).toFixed(3)} ${ar ? 'د.ك' : 'KWD'}`,
            color: totalCosts > 0 ? 'text-osa-amber' : 'text-osa-ink',
          },
          {
            label: ar ? 'موزَّعة' : 'Allocated',
            value: `${allocatedCount} / ${data.pos.length}`,
            color: allocatedCount === data.pos.length ? 'text-green-600' : 'text-osa-ink',
          },
        ].map((s) => (
          <div key={s.label} className={`${CARD} p-4 text-center`}>
            <div className={`num text-[22px] font-bold ${s.color}`}>{s.value}</div>
            <div className="mt-0.5 text-[11.5px] text-osa-faint">{s.label}</div>
          </div>
        ))}
      </div>

      {/* PO list */}
      {data.pos.length === 0 ? (
        <div className={`${CARD} p-8 text-center`}>
          <p className="text-[14px] text-osa-faint">
            {ar ? 'لا توجد أوامر شراء بعد.' : 'No purchase orders yet.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {data.pos.map((po) => (
            <PoCard key={po.id} po={po} ar={ar} onRefresh={refresh} />
          ))}
        </div>
      )}

      {!data.live && (
        <p className="mt-4 text-center text-[11.5px] text-osa-faint">
          {ar
            ? 'عرض بيانات تجريبية — الاتصال بقاعدة البيانات غير متوفر'
            : 'Showing sample data — database connection unavailable'}
        </p>
      )}
    </RoleGuard>
  );
}

'use client';

/**
 * OSALPHA gold COD remittance tracker — تحصيلات الدفع عند الاستلام
 * Features:
 *  - Per-driver: name, unremitted order count + total amount
 *  - "تسجيل تسليم" button → modal to confirm amount + note → inserts cod_remittances
 *  - History table: driver, amount, status, date
 */

import { useState, type FormEvent } from 'react';
import type { CodData, CodRemittanceRow } from '@/lib/admin-accounting-ledger';
import { num3 } from '@/components/admin/orders/format';
import { recordCodRemittance } from '../cod/actions';

const CARD = 'rounded-osa border border-osa-border bg-osa-surface p-[17px_19px] shadow-osa';

const STATUS_COLORS: Record<string, string> = {
  received: 'bg-amber-100 text-amber-700',
  posted: 'bg-green-100 text-green-700',
};
const STATUS_LABELS: Record<string, string> = {
  received: 'مُستلم',
  posted: 'مرحَّل',
};

const METHOD_LABELS: Record<string, string> = {
  cash: 'نقداً',
  bank_transfer: 'تحويل بنكي',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

interface RemittanceModalProps {
  driverId: string;
  driverName: string;
  suggestedAmount: number;
  onClose: () => void;
  onDone: () => void;
}

function RemittanceModal({ driverId, driverName, suggestedAmount, onClose, onDone }: RemittanceModalProps) {
  const [amount, setAmount] = useState(suggestedAmount.toFixed(3));
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { setMsg('المبلغ غير صالح'); return; }
    setStatus('loading');
    setMsg('');
    try {
      await recordCodRemittance({ driverId, amount: amt, orderIds: [], note: note || undefined });
      setStatus('done');
      setMsg('تم تسجيل التسليم وترحيل القيد بنجاح');
      setTimeout(onDone, 800);
    } catch (err: unknown) {
      setStatus('error');
      setMsg(err instanceof Error ? err.message : 'خطأ غير معروف');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" dir="rtl">
      <div className="w-full max-w-md rounded-osa border border-osa-border bg-osa-surface shadow-osa" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-osa-border p-5">
          <h3 className="text-[15px] font-bold text-osa-ink">تسجيل تسليم COD</h3>
          <button type="button" onClick={onClose} className="text-osa-muted hover:text-osa-rose transition-colors text-lg">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <p className="text-[12px] text-osa-muted mb-1">المندوب</p>
            <p className="text-[14px] font-semibold text-osa-ink">{driverName}</p>
          </div>
          <div>
            <label className="block text-[12px] text-osa-muted mb-1.5">المبلغ المُسلَّم (د.ك)</label>
            <input
              type="number"
              step="0.001"
              min="0.001"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-osa-border bg-osa-bg px-3 py-2 text-[14px] text-osa-ink focus:outline-none focus:ring-2 focus:ring-osa-brand"
            />
          </div>
          <div>
            <label className="block text-[12px] text-osa-muted mb-1.5">ملاحظات (اختياري)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="أي تفاصيل إضافية…"
              className="w-full rounded-lg border border-osa-border bg-osa-bg px-3 py-2 text-[13px] text-osa-ink placeholder:text-osa-faint focus:outline-none focus:ring-2 focus:ring-osa-brand resize-none"
            />
          </div>

          {msg && (
            <p className={`text-[12px] font-medium ${status === 'done' ? 'text-osa-green' : 'text-osa-rose'}`}>
              {msg}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={status === 'loading' || status === 'done'}
              className="flex-1 rounded-full bg-osa-brand py-2 text-[13px] font-semibold text-white shadow-osa transition-transform active:scale-[.97] disabled:opacity-50"
            >
              {status === 'loading' ? '⏳ جارٍ التسجيل…' : 'تأكيد التسليم'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-osa-border px-5 py-2 text-[13px] font-medium text-osa-muted hover:text-osa-rose transition-colors"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RemittanceHistory({ remittances }: { remittances: CodRemittanceRow[] }) {
  if (remittances.length === 0) {
    return (
      <div className={`${CARD} py-8 text-center text-osa-faint text-[13px]`}>
        لا توجد تسليمات مسجّلة بعد
      </div>
    );
  }

  return (
    <div className={CARD}>
      <h2 className="mb-4 text-[15px] font-bold text-osa-ink">سجل التسليمات</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-osa-border text-osa-muted">
              <th className="pb-2 text-start font-medium">المندوب</th>
              <th className="pb-2 text-end font-medium">المبلغ</th>
              <th className="pb-2 text-start font-medium">الطريقة</th>
              <th className="pb-2 text-start font-medium">الطلبات</th>
              <th className="pb-2 text-start font-medium">الحالة</th>
              <th className="pb-2 text-end font-medium">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {remittances.map((r) => (
              <tr key={r.id} className="border-b border-osa-border/50 hover:bg-osa-bg/30 transition-colors">
                <td className="py-2.5 font-medium text-osa-ink">{r.driverName}</td>
                <td className="py-2.5 text-end font-mono font-semibold">
                  {num3(r.amount)} <span className="text-[10px] text-osa-faint">د.ك</span>
                </td>
                <td className="py-2.5 text-osa-muted">{METHOD_LABELS[r.method] ?? r.method}</td>
                <td className="py-2.5 text-osa-muted">{r.orderCount > 0 ? `${r.orderCount} طلب` : '—'}</td>
                <td className="py-2.5"><StatusBadge status={r.status} /></td>
                <td className="py-2.5 text-end text-[12px] text-osa-muted">
                  {new Date(r.createdAt).toLocaleDateString('ar-KW', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CodView({ data }: { data: CodData }) {
  const [modal, setModal] = useState<{ driverId: string; driverName: string; amount: number } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Group remittances by driver for quick balance view
  const driverSummary = data.remittances.reduce<Record<string, { name: string; total: number; pending: number }>>((acc, r) => {
    if (!acc[r.driverId]) acc[r.driverId] = { name: r.driverName, total: 0, pending: 0 };
    const entry = acc[r.driverId]!;
    entry.total += r.amount;
    if (r.status === 'received') entry.pending += r.amount;
    return acc;
  }, {});

  const driverRows = Object.entries(driverSummary);

  return (
    <div className="space-y-[14px]" dir="rtl">
      {modal && (
        <RemittanceModal
          driverId={modal.driverId}
          driverName={modal.driverName}
          suggestedAmount={modal.amount}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); setRefreshKey((k) => k + 1); }}
        />
      )}

      <header>
        <h1 className="text-[21px] font-bold text-osa-ink" style={{ fontFamily: 'var(--font-cairo)' }}>
          تحصيلات الدفع عند الاستلام
        </h1>
        <p className="text-[12.5px] text-osa-faint">COD Remittances</p>
      </header>

      {/* Quick register button for ad-hoc remittance */}
      <div className={CARD}>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h2 className="text-[15px] font-bold text-osa-ink">تسجيل تسليم جديد</h2>
          <button
            type="button"
            onClick={() => setModal({ driverId: '', driverName: 'مندوب جديد', amount: 0 })}
            className="ms-auto rounded-full bg-osa-brand px-5 py-2 text-[13px] font-semibold text-white shadow-osa transition-transform active:scale-[.97]"
          >
            + تسجيل تسليم
          </button>
        </div>
        {driverRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-osa-border text-osa-muted">
                  <th className="pb-2 text-start font-medium">المندوب</th>
                  <th className="pb-2 text-end font-medium">إجمالي التسليمات</th>
                  <th className="pb-2 text-end font-medium">معلّق الترحيل</th>
                  <th className="pb-2 w-32" />
                </tr>
              </thead>
              <tbody>
                {driverRows.map(([driverId, info]) => (
                  <tr key={driverId} className="border-b border-osa-border/50 hover:bg-osa-bg/30 transition-colors">
                    <td className="py-2.5 font-medium text-osa-ink">{info.name}</td>
                    <td className="py-2.5 text-end font-mono">
                      {num3(info.total)} <span className="text-[10px] text-osa-faint">د.ك</span>
                    </td>
                    <td className="py-2.5 text-end font-mono">
                      {info.pending > 0 ? (
                        <span className="font-semibold text-osa-amber">{num3(info.pending)} د.ك</span>
                      ) : (
                        <span className="text-osa-green">✓ صفر</span>
                      )}
                    </td>
                    <td className="py-2.5 text-end">
                      <button
                        type="button"
                        onClick={() => setModal({ driverId, driverName: info.name, amount: info.pending })}
                        className="rounded-lg border border-osa-brand px-3 py-1 text-[11.5px] font-semibold text-osa-brand hover:bg-osa-brand hover:text-white transition-colors"
                      >
                        تسجيل تسليم
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[13px] text-osa-faint py-4 text-center">لا توجد بيانات مندوبين — سيظهر السجل هنا عند أول تسليم</p>
        )}
      </div>

      <RemittanceHistory key={refreshKey} remittances={data.remittances} />
    </div>
  );
}

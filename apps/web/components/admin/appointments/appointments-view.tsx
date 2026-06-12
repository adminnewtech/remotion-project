'use client';

import { useState, useTransition } from 'react';
import { PageHeader, KpiCard } from '@/components/admin/ui';
import { useT } from '@/lib/use-t';
import { bookAppointment, setAppointmentStatus } from '@/app/[locale]/admin/appointments/actions';

export interface Appt {
  id: string;
  kind: 'installation' | 'inspection' | 'pickup';
  customer_name: string;
  phone: string | null;
  order_number: string | null;
  scheduled_at: string;
  status: 'booked' | 'done' | 'cancelled';
  note: string | null;
}

const CARD = 'rounded-osa border border-osa-border bg-osa-surface shadow-osa';
const FIELD = 'rounded-osa-sm border border-osa-border bg-osa-surface-2 px-3 py-2 text-[13px] text-osa-ink outline-none focus:border-osa-brand-border';
const KIND: Record<Appt['kind'], { ar: string; cls: string }> = {
  installation: { ar: 'تركيب', cls: 'bg-osa-blue-dim text-osa-blue' },
  inspection: { ar: 'معاينة', cls: 'bg-osa-amber-dim text-osa-amber' },
  pickup: { ar: 'استلام من المحل', cls: 'bg-osa-green-dim text-osa-green' },
};

/** Bookings board: تركيب / معاينة / استلام من المحل. */
export function AppointmentsView({ rows, live }: { rows: Appt[]; live: boolean }) {
  const { locale } = useT();
  const ar = locale === 'ar';
  const [items, setItems] = useState<Appt[]>(rows);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const upcoming = items.filter((a) => a.status === 'booked');
  const todayCount = upcoming.filter((a) => a.scheduled_at.slice(0, 10) === new Date().toISOString().slice(0, 10)).length;

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(null), 2500); }

  function submit(form: FormData) {
    const kind = String(form.get('kind')) as Appt['kind'];
    const name = String(form.get('name') ?? '');
    const phone = String(form.get('phone') || '') || null;
    const orderNo = String(form.get('order') || '') || null;
    const when = String(form.get('when') ?? '');
    const note = String(form.get('note') || '') || null;
    startTransition(async () => {
      const res = await bookAppointment(kind, name, phone, orderNo, when, note);
      if (res.ok) {
        setItems((p) => [...p, { id: res.id ?? `tmp-${Date.now()}`, kind, customer_name: name, phone, order_number: orderNo, scheduled_at: new Date(when).toISOString(), status: 'booked' as const, note }].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)));
        flash(ar ? 'تم حجز الموعد' : 'Booked');
      } else flash(`${ar ? 'فشل' : 'Failed'}: ${res.error}`);
    });
  }
  function setStatus(a: Appt, status: Appt['status']) {
    setItems((p) => p.map((x) => (x.id === a.id ? { ...x, status } : x)));
    startTransition(async () => { await setAppointmentStatus(a.id, status); });
  }

  return (
    <>
      <PageHeader title={ar ? 'المواعيد' : 'Appointments'} subtitle={ar ? 'تركيب · معاينة · استلام من المحل' : 'Install · inspect · pickup'} />
      <div className="grid grid-cols-3 gap-[14px]">
        <KpiCard label={ar ? 'مواعيد اليوم' : 'Today'} value={String(todayCount)} />
        <KpiCard label={ar ? 'القادمة' : 'Upcoming'} value={String(upcoming.length)} />
        <KpiCard label={ar ? 'الكل' : 'All'} value={String(items.length)} />
      </div>
      {msg && <div className="mt-3 rounded-osa-sm bg-osa-green-dim px-3 py-2 text-[12.5px] font-semibold text-osa-green">{msg}</div>}

      <div className={`${CARD} mt-[14px] p-4`}>
        <h2 className="mb-3 text-[14px] font-bold text-osa-ink">{ar ? 'حجز موعد جديد' : 'New booking'}</h2>
        <form action={submit} className="grid gap-2 sm:grid-cols-[150px_1fr_140px_120px_170px_1fr_auto]">
          <select name="kind" className={FIELD}>
            <option value="installation">{ar ? 'تركيب' : 'Installation'}</option>
            <option value="inspection">{ar ? 'معاينة' : 'Inspection'}</option>
            <option value="pickup">{ar ? 'استلام من المحل' : 'Pickup'}</option>
          </select>
          <input name="name" required placeholder={ar ? 'اسم العميل' : 'Customer'} className={FIELD} />
          <input name="phone" dir="ltr" placeholder={ar ? 'الهاتف' : 'Phone'} className={FIELD} />
          <input name="order" placeholder={ar ? 'رقم الطلب' : 'Order #'} className={FIELD} />
          <input name="when" type="datetime-local" required className={FIELD} />
          <input name="note" placeholder={ar ? 'ملاحظة' : 'Note'} className={FIELD} />
          <button type="submit" disabled={pending} className="rounded-full bg-osa-brand px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50">+ {ar ? 'حجز' : 'Book'}</button>
        </form>
      </div>

      <div className={`${CARD} mt-[14px] overflow-hidden`}>
        <h2 className="border-b border-osa-border p-3 text-[14.5px] font-bold text-osa-ink">{ar ? 'الجدول' : 'Schedule'}{!live && <span className="ms-2 text-[11px] font-normal text-osa-faint">(عينة)</span>}</h2>
        <table className="w-full border-collapse text-[13px]">
          <thead><tr>{[ar ? 'الموعد' : 'When', ar ? 'النوع' : 'Kind', ar ? 'العميل' : 'Customer', ar ? 'الطلب' : 'Order', ar ? 'ملاحظة' : 'Note', ''].map((h, i) => <th key={i} className="border-b border-osa-border px-3 pb-2 pt-3 text-start text-[11.5px] font-medium text-osa-faint">{h}</th>)}</tr></thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className={'hover:bg-osa-surface-2 ' + (a.status !== 'booked' ? 'opacity-50' : '')}>
                <td className="border-b border-osa-border px-3 py-2"><span className="num text-[12.5px] font-semibold text-osa-ink">{a.scheduled_at.slice(5, 16).replace('T', ' ')}</span></td>
                <td className="border-b border-osa-border px-3 py-2"><span className={`rounded-full px-2.5 py-[3px] text-[11px] font-semibold ${KIND[a.kind].cls}`}>{KIND[a.kind].ar}</span></td>
                <td className="border-b border-osa-border px-3 py-2"><span className="text-osa-ink">{a.customer_name}</span>{a.phone && <span className="num ms-1.5 text-[11px] text-osa-faint" dir="ltr">{a.phone}</span>}</td>
                <td className="border-b border-osa-border px-3 py-2"><span className="num text-[12px] text-osa-muted">{a.order_number ?? '—'}</span></td>
                <td className="border-b border-osa-border px-3 py-2 text-[12px] text-osa-muted">{a.note ?? '—'}</td>
                <td className="border-b border-osa-border px-3 py-2 text-end">
                  {a.status === 'booked' ? (
                    <>
                      <button type="button" onClick={() => setStatus(a, 'done')} className="me-2 text-[12px] font-semibold text-osa-green">{ar ? 'تم ✓' : 'Done ✓'}</button>
                      <button type="button" onClick={() => setStatus(a, 'cancelled')} className="text-[12px] font-semibold text-osa-rose">{ar ? 'إلغاء' : 'Cancel'}</button>
                    </>
                  ) : (
                    <span className="text-[11.5px] text-osa-faint">{a.status === 'done' ? (ar ? 'منجز' : 'done') : (ar ? 'ملغي' : 'cancelled')}</span>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-[12.5px] text-osa-faint">—</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

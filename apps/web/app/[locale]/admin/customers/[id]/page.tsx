import Link from 'next/link';
import { coerceLocale } from '@/lib/i18n';
import { fetchCustomer360, type TimelineKind } from '@/lib/admin-customer';
import { KpiCard } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

const CARD = 'rounded-osa border border-osa-border bg-osa-surface shadow-osa';
const fmt = (n: number) => n.toFixed(3);

const TIER: Record<string, { ar: string; en: string; cls: string }> = {
  champion: { ar: 'عميل مميّز', en: 'Champion', cls: 'bg-osa-brand-dim text-osa-brand' },
  loyal: { ar: 'وفيّ', en: 'Loyal', cls: 'bg-osa-green-dim text-osa-green' },
  active: { ar: 'نشط', en: 'Active', cls: 'bg-osa-blue-dim text-osa-blue' },
  at_risk: { ar: 'مهدّد بالفقد', en: 'At risk', cls: 'bg-osa-rose-dim text-osa-rose' },
  new: { ar: 'جديد', en: 'New', cls: 'bg-osa-surface-2 text-osa-muted' },
};
const DOT: Record<TimelineKind, string> = { order: 'bg-osa-brand', payment: 'bg-osa-green', ticket: 'bg-osa-rose', install: 'bg-osa-blue' };

export default async function CustomerProfilePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: raw, id } = await params;
  const locale = coerceLocale(raw);
  const ar = locale === 'ar';
  const c = await fetchCustomer360(id);
  if (!c) return <div className="p-8 text-center text-osa-muted">{ar ? 'العميل غير موجود' : 'Customer not found'}</div>;
  const tier = TIER[c.tier]!;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-[12.5px] text-osa-muted">
        <Link href={`/${locale}/admin/customers`} className="hover:text-osa-brand">{ar ? 'العملاء' : 'Customers'}</Link>
        <span>/</span><span className="text-osa-ink">{c.name}</span>
      </div>

      <div className={`${CARD} mb-[14px] flex items-center gap-4 p-5`}>
        <span className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-full bg-osa-brand-dim text-[22px] font-bold text-osa-brand">{c.name.slice(0, 1)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-[20px] font-bold text-osa-ink">{c.name}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${tier.cls}`}>{ar ? tier.ar : tier.en}</span>
          </div>
          <p className="num mt-0.5 text-[13px] text-osa-muted">{c.phone ?? c.email ?? '—'} · {ar ? 'عضو منذ' : 'since'} {c.joinedAt.slice(0, 10)}</p>
        </div>
        {c.phone && (
          <a href={`https://wa.me/${c.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer"
            className="rounded-full bg-osa-green px-4 py-2 text-[13px] font-semibold text-white">WhatsApp</a>
        )}
      </div>

      <div className="mb-[14px] grid grid-cols-2 gap-[14px] lg:grid-cols-4">
        <KpiCard label={ar ? 'الطلبات' : 'Orders'} value={String(c.orders)} />
        <KpiCard label={ar ? 'إجمالي الإنفاق' : 'Lifetime spend'} value={`${fmt(c.spent)} KWD`} />
        <KpiCard label={ar ? 'متوسط الطلب' : 'Avg order'} value={`${fmt(c.avgOrder)} KWD`} />
        <KpiCard label={ar ? 'تذاكر مفتوحة' : 'Open tickets'} value={String(c.openTickets)} />
      </div>


      {c.devices.length > 0 && (
        <div className={`${CARD} mb-[14px] p-5`}>
          <h2 className="mb-3 text-[14.5px] font-bold text-osa-ink">{ar ? 'أجهزة العميل (بالسيريال)' : 'Owned devices (by serial)'}</h2>
          <div className="flex flex-wrap gap-2">
            {c.devices.map((d) => (
              <div key={d.serial} className="rounded-osa border border-osa-border bg-osa-surface-2 px-3.5 py-2">
                <p className="text-[12.5px] font-semibold text-osa-ink">{d.product}</p>
                <p className="num text-[11px] text-osa-faint">{d.serial}{d.boughtAt ? ` · ${d.boughtAt.slice(0, 10)}` : ''}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={`${CARD} p-5`}>
        <h2 className="mb-4 text-[14.5px] font-bold text-osa-ink">{ar ? 'السجل الكامل' : 'Unified timeline'}</h2>
        <ol className="relative space-y-4 ps-5">
          <span className="absolute inset-y-1 start-[5px] w-px bg-osa-border" />
          {c.timeline.map((e, i) => (
            <li key={i} className="relative">
              <span className={`absolute -start-5 top-1 h-2.5 w-2.5 rounded-full ring-2 ring-osa-surface ${DOT[e.kind]}`} />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-osa-ink">{e.title}</p>
                  <p className="text-[12px] text-osa-muted">{e.detail}</p>
                </div>
                <div className="flex-shrink-0 text-end">
                  {e.amount != null && <p className="num text-[12.5px] font-bold text-osa-ink">{fmt(e.amount)} KWD</p>}
                  <p className="num text-[11px] text-osa-faint">{e.at.slice(0, 10)}</p>
                </div>
              </div>
            </li>
          ))}
          {c.timeline.length === 0 && <li className="text-[12.5px] text-osa-faint">{ar ? 'لا يوجد نشاط بعد' : 'No activity yet'}</li>}
        </ol>
      </div>
    </div>
  );
}

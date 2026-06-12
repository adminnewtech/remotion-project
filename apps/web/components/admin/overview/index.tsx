'use client';

import { useState, type ReactNode } from 'react';
import { StatusPill, PayChip, ProgressBar, Sparkline, Checklist } from '@elite/ui/web';
import { useT } from '@/lib/use-t';
import type { OverviewData } from '@/lib/data';
import type { OverviewOrder } from '@/lib/overview-sample';

/** Western-digit, 3-decimal, thousands-separated number for the `.num` spans. */
function num3(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}
function int(n: number): string {
  return n.toLocaleString('en-US');
}

const STATUS_LABEL: Record<OverviewOrder['status'], string> = {
  new: 'جديد',
  prep: 'قيد التجهيز',
  done: 'مكتمل',
  late: 'متأخر التوصيل',
};
const STATUS_TONE: Record<OverviewOrder['status'], 'new' | 'prep' | 'done' | 'late'> = {
  new: 'new',
  prep: 'prep',
  done: 'done',
  late: 'late',
};

const CARD = 'rounded-osa border border-osa-border bg-osa-surface p-[18px_20px] shadow-osa';

/**
 * OSALPHA overview — gold dashboard matching the reference mockup:
 * AI brief, 4 KPI cards, sales-by-channel area chart, top products, latest
 * orders, live workshop bays, today's tasks. Numbers use the mono tabular
 * treatment; money is KWD (3 decimals).
 */
export function Overview({ data }: { data: OverviewData }) {
  const { locale } = useT();
  const ar = locale === 'ar';
  const { kpis, series, topProducts, orders, bays, tasks } = data;
  const [channelTab, setChannelTab] = useState<'week' | 'month' | 'year'>('month');

  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <div className="space-y-[14px]">
      {/* ── AI brief bar ─────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-[13px] rounded-osa border border-osa-brand-border bg-osa-surface p-[13px_18px] shadow-osa">
        <div className="grid h-[34px] w-[34px] flex-shrink-0 place-items-center rounded-[11px] bg-osa-brand-dim text-osa-brand">
          <svg width="17" height="17" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M12 2l1.9 5.7L19.5 9l-5.6 1.3L12 16l-1.9-5.7L4.5 9l5.6-1.3L12 2zM19 14l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9L19 14z" />
          </svg>
        </div>
        <p className="text-[13.5px] text-osa-ink">
          مساعدك يقول: المبيعات أعلى من متوسط الجمعة بـ{' '}
          <b className="font-semibold text-osa-brand">{kpis.salesDeltaPct}%</b>. عندك{' '}
          <b className="font-semibold text-osa-brand">4 طلبات متأخرة</b> عن التوصيل، وفيلم{' '}
          <b className="font-semibold text-osa-brand">PPF-200</b> بينفد خلال 3 أيام.
        </p>
        <div className="ms-auto flex flex-wrap gap-2">
          {['عرض المتأخرات', 'إنشاء أمر شراء', 'التقرير الكامل'].map((c) => (
            <button
              key={c}
              type="button"
              className="rounded-full border border-transparent bg-osa-brand-dim px-[14px] py-[5px] text-[12px] font-semibold text-osa-brand transition-transform hover:border-osa-brand-border active:scale-[.97]"
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI cards ────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          tone="brand"
          icon="M4 20V10M10 20V4M16 20v-7M21 20H3"
          label="مبيعات اليوم"
          value={
            <span className="num">
              {num3(kpis.salesToday)} <span className="text-[12px] font-semibold text-osa-faint">د.ك</span>
            </span>
          }
          delta={
            <span className="text-osa-green">
              ▲ {kpis.salesDeltaPct}% <span className="text-osa-faint">عن متوسط الجمعة</span>
            </span>
          }
        />
        <KpiCard
          tone="blue"
          icon="M3 3h2l2 13h11l2-9H7"
          label="طلبات اليوم"
          value={<span className="num">{int(kpis.ordersToday)}</span>}
          delta={
            <span className="text-osa-faint">
              كاشير {kpis.channelSplit.cashier} · متجر {kpis.channelSplit.store} · واتساب{' '}
              {kpis.channelSplit.whatsapp} · ورشة {kpis.channelSplit.workshop}
            </span>
          }
        />
        <KpiCard
          tone="green"
          icon="M3 6h18v12H3z"
          label="كاش الورديات"
          value={
            <span className="num">
              {num3(kpis.shiftCash)} <span className="text-[12px] font-semibold text-osa-faint">د.ك</span>
            </span>
          }
          delta={
            <span className="text-osa-green">
              ✓ <span className="text-osa-faint">مطابق، لا فروقات</span>
            </span>
          }
        />
        <KpiCard
          tone="amber"
          icon="M12 7.5V12l3 2.5"
          iconCircle
          label="ذمم مستحقة"
          value={
            <span className="num text-osa-amber">
              {num3(kpis.receivables)} <span className="text-[12px] font-semibold text-osa-faint">د.ك</span>
            </span>
          }
          delta={<span className="text-osa-amber">{kpis.overdueCustomers} عملاء تجاوزوا 30 يوماً</span>}
        />
      </div>

      {/* ── Grid: chart + side cards ─────────────────── */}
      <div className="grid grid-cols-1 gap-[14px] lg:grid-cols-[2fr_1fr]">
        {/* Sales by channel */}
        <section className={CARD}>
          <div className="mb-[13px] flex items-center gap-2.5">
            <h2 className="text-[14.5px] font-bold text-osa-ink">المبيعات حسب القناة</h2>
            <div className="ms-auto flex gap-1 rounded-full bg-osa-surface-2 p-[3px]">
              {(['week', 'month', 'year'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setChannelTab(tab)}
                  className={
                    'rounded-full px-[13px] py-[3px] text-[11.5px] font-semibold transition-colors ' +
                    (channelTab === tab
                      ? 'bg-osa-surface text-osa-ink shadow-osa'
                      : 'text-osa-muted')
                  }
                >
                  {tab === 'week' ? 'أسبوع' : tab === 'month' ? '30 يوماً' : 'سنة'}
                </button>
              ))}
            </div>
          </div>
          <Sparkline
            className="h-[180px] w-full"
            series={[
              { points: series.store, color: 'var(--osa-brand)', width: 2.2, area: true },
              { points: series.cashier, color: 'var(--osa-aqua)', width: 1.8 },
              { points: series.whatsapp, color: 'var(--osa-blue)', width: 1.6, opacity: 0.85 },
            ]}
          />
          <div className="mt-1.5 flex gap-4 text-[11.5px] text-osa-muted">
            <Legend color="var(--osa-brand)" label="المتجر الإلكتروني" />
            <Legend color="var(--osa-aqua)" label="الكاشير" />
            <Legend color="var(--osa-blue)" label="واتساب" />
          </div>
        </section>

        {/* Top products */}
        <section className={CARD}>
          <div className="mb-[13px] flex items-center gap-2.5">
            <h2 className="text-[14.5px] font-bold text-osa-ink">الأكثر مبيعاً</h2>
            <a href="#" className="ms-auto text-[12px] font-semibold text-osa-brand">
              الكل ←
            </a>
          </div>
          {topProducts.map((p) => (
            <div
              key={p.name}
              className="flex items-center gap-[11px] border-b border-osa-border py-[9px] last:border-none"
            >
              <div className="grid h-[38px] w-[38px] place-items-center rounded-osa-sm bg-osa-surface-2 text-[16px]">
                {p.emoji}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-osa-ink">{p.name}</div>
                <small className="block text-[11.5px] text-osa-faint">{p.meta}</small>
              </div>
              <div className="ms-auto text-start">
                <b className="num text-[13px] text-osa-ink">{num3(p.revenue)}</b>
                <ProgressBar value={p.share} height={4} className="mt-1 w-[90px]" />
              </div>
            </div>
          ))}
        </section>

        {/* Latest orders */}
        <section className={CARD}>
          <div className="mb-[13px] flex items-center gap-2.5">
            <h2 className="text-[14.5px] font-bold text-osa-ink">أحدث الطلبات</h2>
            <a href="#" className="ms-auto text-[12px] font-semibold text-osa-brand">
              كل الطلبات ←
            </a>
          </div>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {['الطلب', 'العميل', 'القناة', 'الدفع', 'المبلغ', 'الحالة'].map((h) => (
                  <th
                    key={h}
                    className="border-b border-osa-border px-2 pb-[9px] text-start text-[11.5px] font-medium text-osa-faint"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.number}>
                  <td className="num border-b border-osa-border px-2 py-[10.5px] align-middle">{o.number}</td>
                  <td className="border-b border-osa-border px-2 py-[10.5px] align-middle text-osa-ink">{o.customer}</td>
                  <td className="border-b border-osa-border px-2 py-[10.5px] align-middle text-osa-muted">{o.channel}</td>
                  <td className="border-b border-osa-border px-2 py-[10.5px] align-middle">
                    <PayChip>{o.pay}</PayChip>
                  </td>
                  <td className="num border-b border-osa-border px-2 py-[10.5px] align-middle">{num3(o.total)}</td>
                  <td className="border-b border-osa-border px-2 py-[10.5px] align-middle">
                    <StatusPill tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Workshop + tasks */}
        <div className="flex flex-col gap-[14px]">
          <section className={CARD}>
            <div className="mb-[13px] flex items-center gap-2.5">
              <h2 className="text-[14.5px] font-bold text-osa-ink">الورشة الآن</h2>
              <a href="#" className="ms-auto text-[12px] font-semibold text-osa-brand">
                الجدول ←
              </a>
            </div>
            {bays.map((b) => (
              <div key={b.plate} className="border-b border-osa-border py-[11px] last:border-none">
                <div className="mb-[7px] flex items-center gap-2.5 text-[12.5px] text-osa-ink">
                  <span className="num rounded-md border border-osa-border-strong bg-osa-surface-2 px-[9px] py-px text-[11.5px] font-semibold">
                    {b.plate}
                  </span>
                  {b.service}
                  <span className="ms-auto text-[11px] text-osa-faint">{b.eta}</span>
                </div>
                <ProgressBar value={b.progress} height={6} tone="aqua" />
              </div>
            ))}
          </section>

          <section className={CARD}>
            <div className="mb-[13px] flex items-center gap-2.5">
              <h2 className="text-[14.5px] font-bold text-osa-ink">مهام اليوم</h2>
              <span className="num ms-auto text-[11px] text-osa-faint">
                {doneCount}/{tasks.length}
              </span>
            </div>
            <Checklist
              items={tasks.map((t) => ({ id: t.id, label: t.label, who: t.who, done: t.done }))}
            />
          </section>
        </div>
      </div>

      {!data.live && (
        <p className="px-1 text-[11px] text-osa-faint">{ar ? 'بيانات تجريبية' : 'sample data'}</p>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center">
      <i className="me-1.5 inline-block h-2 w-2 rounded-[3px]" style={{ background: color }} />
      {label}
    </span>
  );
}

function KpiCard({
  tone,
  icon,
  iconCircle,
  label,
  value,
  delta,
}: {
  tone: 'brand' | 'blue' | 'green' | 'amber';
  icon: string;
  iconCircle?: boolean;
  label: string;
  value: ReactNode;
  delta: ReactNode;
}) {
  const toneBg: Record<string, string> = {
    brand: 'bg-osa-brand-dim text-osa-brand',
    blue: 'bg-osa-blue-dim text-osa-blue',
    green: 'bg-osa-green-dim text-osa-green',
    amber: 'bg-osa-amber-dim text-osa-amber',
  };
  return (
    <div className="flex items-start gap-[13px] rounded-osa border border-osa-border bg-osa-surface p-[16px_18px] shadow-osa">
      <div className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-[12px] ${toneBg[tone]}`}>
        <svg width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden>
          {iconCircle && <circle cx="12" cy="12" r="9" />}
          <path strokeLinecap="round" d={icon} />
        </svg>
      </div>
      <div className="min-w-0">
        <div className="text-[12px] font-medium text-osa-muted">{label}</div>
        <div className="flex items-baseline gap-1.5 text-[23px] font-bold leading-[1.3] text-osa-ink" style={{ fontFamily: 'var(--font-cairo)' }}>
          {value}
        </div>
        <div className="text-[11.5px]">{delta}</div>
      </div>
    </div>
  );
}

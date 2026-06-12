'use client';

/**
 * OSALPHA gold analytics — matches /tmp/themes/analytics_gold.html:
 * date-range segmented control (+ compare-to-previous), 5 KPI cards,
 * sales-over-time area chart (current vs previous dashed, inline SVG via the
 * shared Sparkline), by-channel donut (conic-gradient), top-products table,
 * sales-by-region bars, customers block, payment-method bars, traffic-source
 * bars. No chart library. Numbers use the mono tabular treatment; KWD 3-decimals.
 */
import Link from 'next/link';
import { Sparkline } from '@elite/ui/web';
import type { AnalyticsData, AnalyticsKpi, BarRow, ChannelSlice, RangeKey } from '@/lib/admin-analytics';
import { useLocale } from '@/components/providers';
import { num3, int } from '@/components/admin/orders/format';

const CARD = 'rounded-osa border border-osa-border bg-osa-surface p-[17px_19px] shadow-osa';

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'اليوم' },
  { key: '7d', label: '٧ أيام' },
  { key: '30d', label: '٣٠ يوماً' },
  { key: 'year', label: 'سنة' },
];

function kpiValue(k: AnalyticsKpi) {
  if (k.kind === 'money') {
    return (
      <span className="num">
        {num3(k.value)} <span className="text-[11px] text-osa-faint">د.ك</span>
      </span>
    );
  }
  if (k.kind === 'percent') {
    return (
      <span className="num">
        {k.value}
        <span className="text-[11px] text-osa-faint">%</span>
      </span>
    );
  }
  return <span className="num">{int(k.value)}</span>;
}

export function AnalyticsView({ data }: { data: AnalyticsData }) {
  const { locale } = useLocale();

  return (
    <div className="space-y-[14px]">
      {/* Header + range control */}
      <header className="flex flex-wrap items-center gap-3.5">
        <div>
          <h1 className="text-[21px] font-bold text-osa-ink" style={{ fontFamily: 'var(--font-cairo)' }}>
            التحليلات
          </h1>
          <p className="text-[12.5px] text-osa-faint">{data.rangeLabel}</p>
        </div>
        <div className="ms-auto flex gap-1.5 rounded-full border border-osa-border bg-osa-surface p-[4px] shadow-osa">
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={`/${locale}/admin/analytics?range=${r.key}`}
              scroll={false}
              className={
                'rounded-full px-[14px] py-[5px] text-[12.5px] font-semibold transition-colors ' +
                (data.range === r.key ? 'bg-osa-brand text-white' : 'text-osa-muted hover:text-osa-brand')
              }
            >
              {r.label}
            </Link>
          ))}
        </div>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-full border border-osa-border bg-osa-surface px-4 py-2 text-[13px] font-semibold text-osa-muted shadow-osa transition-transform active:scale-[.97]"
        >
          ⤓ تصدير
        </button>
      </header>

      {/* 5 KPI cards */}
      <div className="grid grid-cols-2 gap-[13px] sm:grid-cols-3 lg:grid-cols-5">
        {data.kpis.map((k) => {
          const up = k.deltaPct >= 0;
          return (
            <div key={k.label} className="rounded-osa border border-osa-border bg-osa-surface p-[15px_17px] shadow-osa">
              <div className="mb-2 text-[12px] font-medium text-osa-muted">{k.label}</div>
              <div className="text-[22px] font-bold leading-[1.2] text-osa-ink" style={{ fontFamily: 'var(--font-cairo)' }}>
                {kpiValue(k)}
              </div>
              <div className={'mt-1.5 text-[11.5px] font-semibold ' + (up ? 'text-osa-green' : 'text-osa-rose')}>
                {up ? '▲' : '▼'} {Math.abs(k.deltaPct)}% <span className="font-normal text-osa-faint">عن السابق</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sales over time + channel donut */}
      <div className="grid grid-cols-1 gap-[14px] lg:grid-cols-[2fr_1fr]">
        <section className={CARD}>
          <div className="mb-3.5 flex items-center gap-2.5">
            <h2 className="text-[14.5px] font-bold text-osa-ink">المبيعات عبر الوقت</h2>
            <div className="ms-auto flex gap-3.5 text-[11.5px] text-osa-muted">
              <Legend color="var(--osa-brand)" label="المبيعات" />
              <Legend color="var(--osa-faint)" label="الفترة السابقة" dashed />
            </div>
          </div>
          <Sparkline
            className="h-[200px] w-full"
            vbWidth={640}
            vbHeight={200}
            series={[
              { points: data.prevSeries, color: 'var(--osa-faint)', width: 1.6, opacity: 0.9 },
              { points: data.salesSeries, color: 'var(--osa-brand)', width: 2.4, area: true },
            ]}
          />
        </section>

        <section className={CARD}>
          <div className="mb-3.5 flex items-center gap-2.5">
            <h2 className="text-[14.5px] font-bold text-osa-ink">حسب القناة</h2>
          </div>
          <ChannelDonut channels={data.channels} />
        </section>
      </div>

      {/* Top products + by region */}
      <div className="grid grid-cols-1 gap-[14px] lg:grid-cols-[2fr_1fr]">
        <section className={CARD}>
          <div className="mb-3.5 flex items-center gap-2.5">
            <h2 className="text-[14.5px] font-bold text-osa-ink">أفضل المنتجات</h2>
            <Link href={`/${locale}/admin/orders`} className="ms-auto text-[12px] font-semibold text-osa-brand">
              الكل ←
            </Link>
          </div>
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr>
                {['المنتج', 'المباع', 'الإيراد', 'المخزون'].map((h) => (
                  <th key={h} className="border-b border-osa-border px-2 pb-2.5 text-start text-[11px] font-medium text-osa-faint">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.topProducts.map((p) => (
                <tr key={p.name}>
                  <td className="border-b border-osa-border px-2 py-2.5 align-middle">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-8 w-8 place-items-center rounded-osa-sm bg-osa-surface-2 text-[15px]">{p.emoji}</div>
                      <span className="text-osa-ink">{p.name}</span>
                    </div>
                  </td>
                  <td className="num border-b border-osa-border px-2 py-2.5 align-middle">{int(p.units)}</td>
                  <td className="num border-b border-osa-border px-2 py-2.5 align-middle">{num3(p.revenue)}</td>
                  <td className="border-b border-osa-border px-2 py-2.5 align-middle">
                    <span className="rounded-full bg-osa-brand-dim px-2.5 py-0.5 text-[11px] font-semibold text-osa-brand">{p.stock}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className={CARD}>
          <div className="mb-3.5 flex items-center gap-2.5">
            <h2 className="text-[14.5px] font-bold text-osa-ink">المبيعات حسب المنطقة</h2>
          </div>
          <Bars rows={data.byRegion} render={(r) => int(r.value)} />
        </section>
      </div>

      {/* Customers + payment methods + traffic sources */}
      <div className="grid grid-cols-1 gap-[14px] md:grid-cols-3">
        <section className={CARD}>
          <div className="mb-3.5 flex items-center gap-2.5">
            <h2 className="text-[14.5px] font-bold text-osa-ink">العملاء</h2>
          </div>
          <div className="flex justify-between text-[13px]">
            <Stat label="جدد" value={int(data.customers.fresh)} color="text-osa-brand" />
            <Stat label="عائدون" value={int(data.customers.returning)} color="text-osa-aqua" />
            <Stat label="معدّل العودة" value={`${data.customers.returnRatePct}%`} color="text-osa-ink" />
          </div>
        </section>

        <section className={CARD}>
          <div className="mb-3.5 flex items-center gap-2.5">
            <h2 className="text-[14.5px] font-bold text-osa-ink">طرق الدفع</h2>
          </div>
          <Bars rows={data.paymentMethods} gap={8} render={(r) => r.display ?? `${r.value}%`} />
        </section>

        <section className={CARD}>
          <div className="mb-3.5 flex items-center gap-2.5">
            <h2 className="text-[14.5px] font-bold text-osa-ink">مصادر الزيارات</h2>
          </div>
          <Bars rows={data.trafficSources} gap={8} render={(r) => r.display ?? `${r.value}%`} />
        </section>
      </div>

      {/* Sample-data footnote */}
      <p className="px-1 text-[11px] text-osa-faint">
        {data.live ? 'المبيعات والمنتجات والمناطق مباشرة. ' : 'بيانات تجريبية. '}
        أقسام بلا مصدر مباشر بعد: {data.sampleSections.join('، ')}.
      </p>
    </div>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center">
      <i
        className="me-1.5 inline-block h-2 w-2 rounded-[3px]"
        style={dashed ? { background: 'transparent', border: `1.5px dashed ${color}` } : { background: color }}
      />
      {label}
    </span>
  );
}

function ChannelDonut({ channels }: { channels: ChannelSlice[] }) {
  // Build the conic-gradient stops cumulatively.
  let acc = 0;
  const stops = channels
    .map((c) => {
      const start = acc;
      acc += c.pct;
      return `${c.color} ${start}% ${acc}%`;
    })
    .join(', ');
  return (
    <div className="flex items-center gap-[18px]">
      <div className="relative h-[120px] w-[120px] flex-shrink-0 rounded-full" style={{ background: `conic-gradient(${stops})` }}>
        <div className="absolute inset-[18px] rounded-full bg-osa-surface" />
      </div>
      <div className="flex flex-1 flex-col gap-2 text-[12.5px]">
        {channels.map((c) => (
          <div key={c.label} className="flex items-center gap-2">
            <i className="h-[9px] w-[9px] rounded-[3px]" style={{ background: c.color }} />
            <span className="text-osa-ink">{c.label}</span>
            <b className="num ms-auto text-osa-ink">{c.pct}%</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function Bars({ rows, render, gap = 11 }: { rows: BarRow[]; render: (r: BarRow) => string; gap?: number }) {
  return (
    <div className="flex flex-col" style={{ gap }}>
      {rows.map((r) => (
        <div key={r.name} className="flex items-center gap-2.5 text-[12.5px]">
          <span className="w-[78px] flex-shrink-0 text-osa-muted">{r.name}</span>
          <div className="h-[9px] flex-1 overflow-hidden rounded-full bg-osa-surface-2">
            <i
              className="block h-full rounded-full"
              style={{ width: `${r.pct}%`, background: 'linear-gradient(90deg, var(--osa-brand-strong), var(--osa-brand))' }}
            />
          </div>
          <span className="num w-[64px] text-start font-semibold text-osa-ink">{render(r)}</span>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="text-[12px] text-osa-muted">{label}</div>
      <div className={'num text-[20px] font-bold ' + color}>{value}</div>
    </div>
  );
}

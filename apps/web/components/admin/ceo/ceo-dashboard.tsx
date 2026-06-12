'use client';

import { StatusPill, ProgressBar } from '@elite/ui/web';
import { useT } from '@/lib/use-t';
import { PageHeader } from '@/components/admin/ui';
import type { CeoData } from '@/app/[locale]/admin/ceo/data';
import { DailyBriefCard } from './daily-brief-card';
import { CopilotWidget } from './copilot-widget';

const CARD = 'rounded-osa border border-osa-border bg-osa-surface p-[18px_20px] shadow-osa';

/**
 * CEO dashboard — premium executive view. Revenue cards (today / 7d / 30d with
 * deltas), orders-by-status strip, live "needs attention" panel, sales-by-area
 * bars, top products, staff utilization + SLA, the AI daily brief, and the ops
 * copilot. All charts are CSS-only (no chart library). Data is fetched
 * server-side and passed in; this component is presentation + the two AI
 * client widgets.
 */
export function CeoDashboard({ data }: { data: CeoData }) {
  const { t, locale } = useT();
  const ar = locale === 'ar';

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { maximumFractionDigits: 3 });

  const areaMax = Math.max(...data.salesByArea.map((a) => a.revenue), 1);
  const topMax = Math.max(...data.topProducts.map((p) => p.units_sold), 1);

  return (
    <div className="space-y-[14px]">
      <PageHeader
        title={ar ? 'لوحة الرئيس التنفيذي' : 'CEO Dashboard'}
        subtitle={
          data.live
            ? ar
              ? 'نظرة تنفيذية مباشرة على Newtech'
              : 'Live executive overview of Newtech'
            : ar
              ? 'لا توجد بيانات مباشرة بعد'
              : 'No live data yet'
        }
      />

      {/* ── Revenue cards ─────────────────────────────────────── */}
      <div className="grid gap-[14px] sm:grid-cols-3">
        <RevenueCard
          label={ar ? 'إيرادات اليوم' : "Today's revenue"}
          value={fmt(data.today.revenue)}
          sub={`${data.today.orders} ${ar ? 'طلب' : 'orders'}`}
          accent
        />
        <RevenueCard
          label={ar ? 'آخر 7 أيام' : 'Last 7 days'}
          value={fmt(data.last7.revenue)}
          sub={`${data.last7.orders} ${ar ? 'طلب' : 'orders'}`}
          delta={data.delta7Pct}
        />
        <RevenueCard
          label={ar ? 'آخر 30 يوم' : 'Last 30 days'}
          value={fmt(data.last30.revenue)}
          sub={`${data.last30.orders} ${ar ? 'طلب' : 'orders'}`}
          delta={data.delta30Pct}
        />
      </div>

      {/* ── Orders by status strip ────────────────────────────── */}
      {data.ordersByStatus.length > 0 && (
        <div className={CARD}>
          <h2 className="mb-3 text-[12.5px] font-bold text-osa-muted">
            {ar ? 'الطلبات حسب الحالة' : 'Orders by status'}
          </h2>
          <div className="flex flex-wrap gap-2">
            {data.ordersByStatus.map((s) => (
              <div
                key={s.status}
                className="flex items-center gap-2 rounded-full border border-osa-border bg-osa-surface-2 px-3 py-1.5"
              >
                <StatusPill tone="neutral">{t(`orderStatus.${s.status}`)}</StatusPill>
                <span className="num text-[13px] font-bold text-osa-ink">{s.orders}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Needs attention + AI brief ────────────────────────── */}
      <div className="grid gap-[14px] lg:grid-cols-3">
        <div className={CARD}>
          <h2 className="mb-3 text-[15px] font-bold text-osa-ink">
            {ar ? 'يحتاج انتباه' : 'Needs attention'}
          </h2>
          <div className="space-y-2">
            <AttentionRow
              ok={data.attention.lateTasks === 0}
              label={ar ? 'مهام متأخرة' : 'Late tasks'}
              value={data.attention.lateTasks}
            />
            <AttentionRow
              ok={data.attention.unassignedTasks === 0}
              label={ar ? 'مهام غير مُسندة' : 'Unassigned tasks'}
              value={data.attention.unassignedTasks}
            />
            <AttentionRow
              ok={data.attention.lowStockCount === 0}
              label={ar ? 'أصناف منخفضة المخزون' : 'Low-stock items'}
              value={data.attention.lowStockCount}
            />
            <AttentionRow
              ok={data.attention.openTickets === 0}
              label={ar ? 'تذاكر دعم مفتوحة' : 'Open tickets'}
              value={data.attention.openTickets}
            />
          </div>
          {data.lowStock.length > 0 && (
            <div className="mt-4 border-t border-osa-border pt-3">
              <p className="mb-2 text-[11.5px] font-semibold text-osa-muted">
                {ar ? 'أقل مخزون' : 'Lowest stock'}
              </p>
              <ul className="space-y-1.5">
                {data.lowStock.slice(0, 5).map((l) => (
                  <li
                    key={l.variant_id}
                    className="flex items-center justify-between gap-2 rounded-osa-sm bg-osa-amber-dim px-3 py-1.5 text-[13px]"
                  >
                    <span className="truncate font-medium text-osa-ink">
                      {(ar ? l.name_ar : l.name_en) || l.sku || '—'}
                    </span>
                    <span className="num font-bold text-osa-amber">{l.available}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <DailyBriefCard initial={data.latestBrief} />
        </div>
      </div>

      {/* ── Sales by area + top products ──────────────────────── */}
      <div className="grid gap-[14px] lg:grid-cols-2">
        <div className={CARD}>
          <h2 className="mb-4 text-[15px] font-bold text-osa-ink">{ar ? 'المبيعات حسب المنطقة' : 'Sales by area'}</h2>
          {data.salesByArea.length === 0 ? (
            <Empty ar={ar} />
          ) : (
            <div className="space-y-3">
              {data.salesByArea.slice(0, 8).map((a) => (
                <div key={a.area}>
                  <div className="mb-1 flex items-center justify-between text-[13px]">
                    <span className="font-medium text-osa-ink">{a.area}</span>
                    <span className="text-osa-muted">
                      <span className="num">{fmt(a.revenue)}</span>{' '}
                      <span className="text-osa-faint">{ar ? 'د.ك' : 'KWD'}</span>
                    </span>
                  </div>
                  <ProgressBar value={Math.max(4, (a.revenue / areaMax) * 100)} height={6} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={CARD}>
          <h2 className="mb-4 text-[15px] font-bold text-osa-ink">{ar ? 'الأكثر مبيعاً' : 'Top products'}</h2>
          {data.topProducts.length === 0 ? (
            <Empty ar={ar} />
          ) : (
            <ol className="space-y-3">
              {data.topProducts.map((p, i) => (
                <li key={p.product_id}>
                  <div className="mb-1 flex items-center justify-between text-[13px]">
                    <span className="flex items-center gap-2">
                      <span className="num inline-flex h-5 w-5 items-center justify-center rounded-full bg-osa-brand-dim text-[11px] font-bold text-osa-brand">
                        {i + 1}
                      </span>
                      <span className="truncate font-medium text-osa-ink">
                        {(ar ? p.name_ar : p.name_en) || p.name_en || p.name_ar || '—'}
                      </span>
                    </span>
                    <span className="num text-osa-muted">{p.units_sold}×</span>
                  </div>
                  <ProgressBar value={Math.max(4, (p.units_sold / topMax) * 100)} height={6} />
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* ── Staff utilization + SLA ───────────────────────────── */}
      <div className="grid gap-[14px] lg:grid-cols-2">
        <div className={CARD}>
          <h2 className="mb-4 text-[15px] font-bold text-osa-ink">
            {ar ? 'إنتاجية الفريق' : 'Staff utilization'}
          </h2>
          {data.staff.length === 0 ? (
            <Empty ar={ar} />
          ) : (
            <div className="space-y-[13px]">
              {data.staff.slice(0, 8).map((s) => {
                const total = s.total_tasks || 1;
                const donePct = Math.round((s.completed_tasks / total) * 100);
                return (
                  <div key={s.staff_id} className="text-[13px]">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-medium text-osa-ink">
                        {s.full_name || '—'}{' '}
                        <span className="text-[11.5px] text-osa-faint">
                          ({t(`roles.${s.role}`) || s.role})
                        </span>
                      </span>
                      <span className="text-osa-muted">
                        <span className="num">{s.open_tasks}</span> {ar ? 'مفتوحة' : 'open'} ·{' '}
                        <span className="num">{s.completed_tasks}</span> {ar ? 'مكتملة' : 'done'}
                      </span>
                    </div>
                    <ProgressBar value={donePct} height={6} tone="aqua" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={CARD}>
          <h2 className="mb-4 text-[15px] font-bold text-osa-ink">{ar ? 'مستوى الخدمة (SLA)' : 'Service level (SLA)'}</h2>
          {data.sla.length === 0 ? (
            <Empty ar={ar} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {data.sla.map((s) => {
                const onTimePct = s.windowed_completed
                  ? Math.round((s.on_time / s.windowed_completed) * 100)
                  : null;
                return (
                  <div key={s.type} className="rounded-osa-sm border border-osa-border bg-osa-surface-2 p-3">
                    <p className="text-[11.5px] text-osa-muted">
                      {t(`fulfillment.${s.type}`) || s.type}
                    </p>
                    <p className="num mt-1 text-[20px] font-bold text-osa-ink">
                      {onTimePct == null ? '—' : `${onTimePct}%`}
                    </p>
                    <p className="text-[11px] text-osa-faint">
                      {ar ? 'في الوقت' : 'on-time'} · <span className="num">{s.completed}</span>{' '}
                      {ar ? 'مكتملة' : 'done'}
                    </p>
                    {s.avg_cycle_hours != null && (
                      <p className="mt-1 text-[11px] text-osa-faint">
                        {ar ? 'متوسط الدورة' : 'avg cycle'}:{' '}
                        <span className="num">{s.avg_cycle_hours.toFixed(1)}h</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Ops copilot ───────────────────────────────────────── */}
      <CopilotWidget />
    </div>
  );
}

function RevenueCard({
  label,
  value,
  sub,
  delta,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  delta?: number;
  accent?: boolean;
}) {
  return (
    <div
      className={
        accent
          ? 'rounded-osa border border-transparent bg-gradient-to-br from-osa-brand-strong to-osa-brand p-[18px_20px] text-white shadow-osa'
          : `${CARD}`
      }
    >
      <p className={`text-[13px] ${accent ? 'text-white/85' : 'text-osa-muted'}`}>{label}</p>
      <p className="mt-2 text-[24px] font-bold tracking-tight">
        <span className="num">{value}</span>{' '}
        <span className={`text-[13px] font-semibold ${accent ? 'text-white/70' : 'text-osa-faint'}`}>KWD</span>
      </p>
      <div className="mt-1 flex items-center justify-between">
        <span className={`text-[11.5px] ${accent ? 'text-white/70' : 'text-osa-muted'}`}>{sub}</span>
        {delta != null && (
          <span
            className={`num text-[11.5px] font-semibold ${
              accent ? 'text-white' : delta >= 0 ? 'text-osa-green' : 'text-osa-rose'
            }`}
          >
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%
          </span>
        )}
      </div>
    </div>
  );
}

function AttentionRow({ ok, label, value }: { ok: boolean; label: string; value: number }) {
  return (
    <div
      className={`flex items-center justify-between rounded-osa-sm px-3 py-2 ${
        ok ? 'bg-osa-surface-2' : 'bg-osa-rose-dim'
      }`}
    >
      <span className="flex items-center gap-2 text-[13px] font-medium text-osa-ink">
        <span
          className={`inline-block h-2 w-2 rounded-full ${ok ? 'bg-osa-green' : 'bg-osa-rose'}`}
          aria-hidden
        />
        {label}
      </span>
      <span className={`num text-[13px] font-bold ${ok ? 'text-osa-muted' : 'text-osa-rose'}`}>{value}</span>
    </div>
  );
}

function Empty({ ar }: { ar: boolean }) {
  return (
    <p className="py-6 text-center text-[13px] text-osa-muted">
      {ar ? 'لا توجد بيانات بعد' : 'No data yet'}
    </p>
  );
}

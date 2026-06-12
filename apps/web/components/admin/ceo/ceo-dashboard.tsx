'use client';

import { StatusBadge, PriceTag } from '@elite/ui/web';
import { useT } from '@/lib/use-t';
import { PageHeader } from '@/components/admin/ui';
import type { CeoData } from '@/app/[locale]/admin/ceo/data';
import { DailyBriefCard } from './daily-brief-card';
import { CopilotWidget } from './copilot-widget';

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
    n.toLocaleString(ar ? 'ar-KW' : 'en-US', { maximumFractionDigits: 3 });

  const areaMax = Math.max(...data.salesByArea.map((a) => a.revenue), 1);
  const topMax = Math.max(...data.topProducts.map((p) => p.units_sold), 1);

  return (
    <div className="space-y-6">
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
      <div className="grid gap-4 sm:grid-cols-3">
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
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-muted">
            {ar ? 'الطلبات حسب الحالة' : 'Orders by status'}
          </h2>
          <div className="flex flex-wrap gap-2">
            {data.ordersByStatus.map((s) => (
              <div
                key={s.status}
                className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5"
              >
                <StatusBadge status={s.status} label={t(`orderStatus.${s.status}`)} />
                <span className="text-sm font-bold">{s.orders}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Needs attention + AI brief ────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-bold">
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
            <div className="mt-4 border-t border-border pt-3">
              <p className="mb-2 text-xs font-semibold text-muted">
                {ar ? 'أقل مخزون' : 'Lowest stock'}
              </p>
              <ul className="space-y-1.5">
                {data.lowStock.slice(0, 5).map((l) => (
                  <li
                    key={l.variant_id}
                    className="flex items-center justify-between rounded-lg bg-warning-50 px-3 py-1.5 text-sm"
                  >
                    <span className="truncate font-medium">
                      {(ar ? l.name_ar : l.name_en) || l.sku || '—'}
                    </span>
                    <span className="font-bold text-warning-700">{l.available}</span>
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
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold">{ar ? 'المبيعات حسب المنطقة' : 'Sales by area'}</h2>
          {data.salesByArea.length === 0 ? (
            <Empty ar={ar} />
          ) : (
            <div className="space-y-3">
              {data.salesByArea.slice(0, 8).map((a) => (
                <div key={a.area}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{a.area}</span>
                    <span className="text-muted">
                      {fmt(a.revenue)} {ar ? 'د.ك' : 'KWD'}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                      style={{ width: `${Math.max(4, (a.revenue / areaMax) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold">{ar ? 'الأكثر مبيعاً' : 'Top products'}</h2>
          {data.topProducts.length === 0 ? (
            <Empty ar={ar} />
          ) : (
            <ol className="space-y-3">
              {data.topProducts.map((p, i) => (
                <li key={p.product_id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary">
                        {i + 1}
                      </span>
                      <span className="truncate font-medium">
                        {(ar ? p.name_ar : p.name_en) || p.name_en || p.name_ar || '—'}
                      </span>
                    </span>
                    <span className="text-muted">
                      {p.units_sold}
                      {ar ? '×' : '×'}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(4, (p.units_sold / topMax) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* ── Staff utilization + SLA ───────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold">
            {ar ? 'إنتاجية الفريق' : 'Staff utilization'}
          </h2>
          {data.staff.length === 0 ? (
            <Empty ar={ar} />
          ) : (
            <div className="space-y-2">
              {data.staff.slice(0, 8).map((s) => {
                const total = s.total_tasks || 1;
                const donePct = Math.round((s.completed_tasks / total) * 100);
                return (
                  <div key={s.staff_id} className="text-sm">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-medium">
                        {s.full_name || '—'}{' '}
                        <span className="text-xs text-muted">
                          ({t(`roles.${s.role}`) || s.role})
                        </span>
                      </span>
                      <span className="text-muted">
                        {s.open_tasks} {ar ? 'مفتوحة' : 'open'} · {s.completed_tasks}{' '}
                        {ar ? 'مكتملة' : 'done'}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className="h-full rounded-full bg-success"
                        style={{ width: `${donePct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold">{ar ? 'مستوى الخدمة (SLA)' : 'Service level (SLA)'}</h2>
          {data.sla.length === 0 ? (
            <Empty ar={ar} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {data.sla.map((s) => {
                const onTimePct = s.windowed_completed
                  ? Math.round((s.on_time / s.windowed_completed) * 100)
                  : null;
                return (
                  <div key={s.type} className="rounded-xl border border-border bg-background p-3">
                    <p className="text-xs text-muted">
                      {t(`fulfillment.${s.type}`) || s.type}
                    </p>
                    <p className="mt-1 text-xl font-extrabold">
                      {onTimePct == null ? '—' : `${onTimePct}%`}
                    </p>
                    <p className="text-[11px] text-muted">
                      {ar ? 'في الوقت' : 'on-time'} · {s.completed} {ar ? 'مكتملة' : 'done'}
                    </p>
                    {s.avg_cycle_hours != null && (
                      <p className="mt-1 text-[11px] text-muted">
                        {ar ? 'متوسط الدورة' : 'avg cycle'}: {s.avg_cycle_hours.toFixed(1)}h
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
      className={`rounded-2xl border p-5 shadow-sm ${
        accent
          ? 'border-transparent bg-gradient-to-br from-primary-800 via-primary to-primary-600 text-white'
          : 'border-border bg-surface'
      }`}
    >
      <p className={`text-sm ${accent ? 'text-white/80' : 'text-muted'}`}>{label}</p>
      <p className="mt-2 text-2xl font-extrabold tracking-tight">
        {value} <span className="text-sm font-semibold opacity-70">KWD</span>
      </p>
      <div className="mt-1 flex items-center justify-between">
        <span className={`text-xs ${accent ? 'text-white/70' : 'text-muted'}`}>{sub}</span>
        {delta != null && (
          <span
            className={`text-xs font-semibold ${
              accent ? 'text-white' : delta >= 0 ? 'text-success' : 'text-danger'
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
      className={`flex items-center justify-between rounded-xl px-3 py-2 ${
        ok ? 'bg-neutral-50' : 'bg-danger-50'
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        <span
          className={`inline-block h-2 w-2 rounded-full ${ok ? 'bg-success' : 'bg-danger'}`}
          aria-hidden
        />
        {label}
      </span>
      <span className={`text-sm font-bold ${ok ? 'text-muted' : 'text-danger-700'}`}>{value}</span>
    </div>
  );
}

function Empty({ ar }: { ar: boolean }) {
  return (
    <p className="py-6 text-center text-sm text-muted">
      {ar ? 'لا توجد بيانات بعد' : 'No data yet'}
    </p>
  );
}

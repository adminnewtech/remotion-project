import 'server-only';

/**
 * Admin analytics data seam (OSALPHA gold).
 *
 * Wires the analytics page to the `@elite/core` analytics getters and falls
 * back, per-section, to the documented sample (`admin-analytics-sample.ts`) when
 * the request-scoped Supabase client is absent or a read is empty — the page
 * always renders.
 *
 * LIVE-BACKED (via SECURITY-DEFINER `admin_*` RPCs):
 *   • إجمالي المبيعات / الطلبات / متوسط قيمة الطلب → getRevenueByDay
 *   • المبيعات عبر الوقت (current vs previous)      → getRevenueByDay (two windows)
 *   • أفضل المنتجات                                  → getTopProducts
 *   • المبيعات حسب المنطقة                           → getSalesByArea
 *   • (status roll-up available via getOrdersByStatus / getDashboard)
 *
 * SAMPLE-ONLY (NO backing RPC in the contract yet — clearly marked):
 *   • الزوّار / معدّل التحويل  (no web-analytics pipeline)
 *   • حسب القناة (channel donut — orders carry no channel column)
 *   • العملاء (جدد/عائدون/معدّل العودة)
 *   • طرق الدفع، مصادر الزيارات
 *
 * Money is KWD (3 decimals).
 */
import { analytics } from '@elite/core';
import { getServerClient } from '@/lib/supabase/server';
import {
  analyticsSample,
  type AnalyticsKpi,
  type ChannelSlice,
  type TopProductRow,
  type BarRow,
  type CustomersBlock,
} from '@/lib/admin-analytics-sample';

export type { AnalyticsKpi, ChannelSlice, TopProductRow, BarRow, CustomersBlock };

export type RangeKey = 'today' | '7d' | '30d' | 'year';

const RANGE_DAYS: Record<RangeKey, number> = { today: 1, '7d': 7, '30d': 30, year: 365 };

export interface AnalyticsData {
  range: RangeKey;
  /** Whether the live-backed sections came from the backend. */
  live: boolean;
  /** Which sections are sample-only (no RPC yet) — surfaced as a footnote. */
  sampleSections: string[];
  rangeLabel: string;
  kpis: AnalyticsKpi[];
  salesSeries: number[];
  prevSeries: number[];
  channels: ChannelSlice[];
  topProducts: TopProductRow[];
  byRegion: BarRow[];
  customers: CustomersBlock;
  paymentMethods: BarRow[];
  trafficSources: BarRow[];
}

const SAMPLE_SECTIONS = ['الزوّار', 'معدّل التحويل', 'حسب القناة', 'العملاء', 'طرق الدفع', 'مصادر الزيارات'];
const PRODUCT_EMOJI = ['📷', '🔒', '🛡️', '📽️', '🎧', '🔌', '💡', '📦'];

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function pctDelta(curr: number, prev: number): number {
  if (!prev) return curr ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

/**
 * Fetch the analytics dashboard for a date range. Live where an RPC backs the
 * section; sample for the rest. Compares the window to the previous window of
 * equal length.
 */
export async function fetchAnalytics(range: RangeKey = '30d'): Promise<AnalyticsData> {
  const days = RANGE_DAYS[range];
  const base: AnalyticsData = {
    range,
    live: false,
    sampleSections: SAMPLE_SECTIONS,
    rangeLabel: rangeLabel(range),
    kpis: analyticsSample.kpis,
    salesSeries: analyticsSample.salesSeries,
    prevSeries: analyticsSample.prevSeries,
    channels: analyticsSample.channels,
    topProducts: analyticsSample.topProducts,
    byRegion: analyticsSample.byRegion,
    customers: analyticsSample.customers,
    paymentMethods: analyticsSample.paymentMethods,
    trafficSources: analyticsSample.trafficSources,
  };

  const client = await getServerClient();
  if (!client) return base;

  try {
    const now = new Date();
    const from = new Date(now.getTime() - days * 86_400_000);
    const prevFrom = new Date(now.getTime() - 2 * days * 86_400_000);

    const [curr, prev, top, region, orderRows, payRows] = await Promise.all([
      analytics.getRevenueByDay(client, { from: ymd(from), to: ymd(now) }),
      analytics.getRevenueByDay(client, { from: ymd(prevFrom), to: ymd(from) }),
      analytics.getTopProducts(client, 4),
      analytics.getSalesByArea(client),
      client
        .from('orders')
        .select('user_id, channel, total, status, created_at')
        .gte('created_at', from.toISOString())
        .then(({ data }) => (data ?? []) as { user_id: string | null; channel: string | null; total: number; status: string; created_at: string }[]),
      client
        .from('payments')
        .select('method, amount, status, created_at')
        .eq('status', 'paid')
        .gte('created_at', from.toISOString())
        .then(({ data }) => (data ?? []) as { method: string | null; amount: number }[]),
    ]);

    if (!curr.length && !top.length && !region.length) return base;

    // KPIs (money/int from revenue rows; conversion + visitors stay sample).
    const sumRev = (rows: typeof curr) => rows.reduce((s, r) => s + (r.revenue || 0), 0);
    const sumOrders = (rows: typeof curr) => rows.reduce((s, r) => s + (r.orders || 0), 0);
    const currRev = sumRev(curr);
    const prevRev = sumRev(prev);
    const currOrders = sumOrders(curr);
    const prevOrders = sumOrders(prev);
    const aov = currOrders ? currRev / currOrders : 0;
    const prevAov = prevOrders ? prevRev / prevOrders : 0;

    const kpis: AnalyticsKpi[] = curr.length
      ? [
          { label: 'إجمالي المبيعات', value: Math.round(currRev * 1000) / 1000, kind: 'money', deltaPct: pctDelta(currRev, prevRev) },
          { label: 'الطلبات', value: currOrders, kind: 'int', deltaPct: pctDelta(currOrders, prevOrders) },
          { label: 'متوسط قيمة الطلب', value: Math.round(aov * 1000) / 1000, kind: 'money', deltaPct: pctDelta(aov, prevAov) },
          // SAMPLE-ONLY (no RPC): conversion + visitors.
          base.kpis[3]!,
          base.kpis[4]!,
        ]
      : base.kpis;

    const salesSeries = curr.length ? curr.map((r) => Math.round(r.revenue || 0)) : base.salesSeries;
    const prevSeries = prev.length ? prev.map((r) => Math.round(r.revenue || 0)) : base.prevSeries;

    const topProducts: TopProductRow[] = top.length
      ? top.map((p, i) => ({
          emoji: PRODUCT_EMOJI[i % PRODUCT_EMOJI.length] ?? '📦',
          name: p.name_ar || p.name_en || p.brand || '—',
          units: p.units_sold,
          revenue: p.revenue,
          stock: 'متوفّر',
        }))
      : base.topProducts;

    const byRegion: BarRow[] = region.length
      ? (() => {
          const sorted = [...region].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
          const max = Math.max(...sorted.map((r) => r.revenue), 1);
          return sorted.map((r) => ({
            name: r.area || '—',
            value: Math.round(r.revenue),
            pct: Math.max(8, Math.round((r.revenue / max) * 100)),
          }));
        })()
      : base.byRegion;

    // LIVE payment-methods split from real captured payments.
    const PAY_AR: Record<string, string> = {
      knet: 'كي-نت', cod: 'نقدي / عند الاستلام', apple_pay: 'Apple Pay',
      google_pay: 'Google Pay', card: 'بطاقة',
    };
    let paymentMethods = base.paymentMethods;
    let sampleSections = base.sampleSections;

    // LIVE channel split + new-vs-returning from the real orders in range.
    let channels = base.channels;
    let customersBlock = base.customers;
    if (orderRows.length) {
      const { normalizeChannel, CHANNEL_AR } = await import('@/lib/pure/ops');
      const byCh = new Map<string, number>();
      for (const o of orderRows) {
        const key = normalizeChannel(o.channel);
        byCh.set(key, (byCh.get(key) ?? 0) + (o.total || 0));
      }
      const totalCh = Array.from(byCh.values()).reduce((s, v) => s + v, 0) || 1;
      channels = Array.from(byCh.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([k, v], i) => ({
          label: CHANNEL_AR[normalizeChannel(k)],
          pct: Math.max(2, Math.round((v / totalCh) * 100)),
          color: ['#b8860b', '#2563eb', '#16a34a', '#9333ea'][i % 4]!,
        }));
      sampleSections = sampleSections.filter((x) => x !== 'حسب القناة');

      const inRange = new Set(orderRows.map((o) => o.user_id).filter(Boolean) as string[]);
      if (inRange.size) {
        const { data: history } = await client
          .from('orders')
          .select('user_id, created_at')
          .in('user_id', Array.from(inRange))
          .lt('created_at', from.toISOString())
          .limit(1000);
        const returning = new Set(((history ?? []) as { user_id: string | null }[]).map((h) => h.user_id).filter(Boolean) as string[]);
        const newCount = Array.from(inRange).filter((u) => !returning.has(u)).length;
        const ret = inRange.size - newCount;
        customersBlock = {
          fresh: newCount,
          returning: ret,
          returnRatePct: inRange.size ? Math.round((ret / inRange.size) * 100) : 0,
        };
        sampleSections = sampleSections.filter((x) => x !== 'العملاء');
      }
    }
    if (payRows.length) {
      const byMethod = new Map<string, number>();
      for (const p of payRows) {
        const key = p.method ?? 'other';
        byMethod.set(key, (byMethod.get(key) ?? 0) + (p.amount || 0));
      }
      const totalPaid = Array.from(byMethod.values()).reduce((s, v) => s + v, 0) || 1;
      paymentMethods = Array.from(byMethod.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([method, amount]) => ({
          name: PAY_AR[method] ?? method,
          value: Math.round(amount),
          pct: Math.max(4, Math.round((amount / totalPaid) * 100)),
        }));
      sampleSections = sampleSections.filter((s) => s !== 'طرق الدفع');
    }

    return {
      ...base,
      live: curr.length > 0 || top.length > 0 || region.length > 0,
      sampleSections,
      kpis,
      salesSeries,
      prevSeries,
      topProducts,
      byRegion,
      paymentMethods,
      channels,
      customers: customersBlock,
    };
  } catch {
    return base;
  }
}

function rangeLabel(range: RangeKey): string {
  const now = new Date();
  const from = new Date(now.getTime() - RANGE_DAYS[range] * 86_400_000);
  const fmt = new Intl.DateTimeFormat('ar-KW', { day: 'numeric', month: 'long' });
  const fmtY = new Intl.DateTimeFormat('ar-KW', { day: 'numeric', month: 'long', year: 'numeric' });
  return `${fmt.format(from)} – ${fmtY.format(now)} · مقارنة بالفترة السابقة`;
}

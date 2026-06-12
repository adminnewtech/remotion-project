import 'server-only';

/**
 * Server-side data layer for the CEO dashboard.
 *
 * Reads the live backend via the request-scoped Supabase client (so RLS / the
 * is_ops() gate applies to the calling admin). Every section degrades to an
 * empty/zero value on error so the executive view always renders.
 */
import { analytics, ai } from '@elite/core';
import type {
  RevenueByDay,
  OrdersByStatus,
  SalesByArea,
  TopProduct,
  LowStockItem,
  StaffUtilization,
  SlaMetrics,
} from '@elite/core';
import type { AiReport } from '@elite/core';
import { getServerClient } from '@/lib/supabase/server';

export interface NeedsAttention {
  lateTasks: number;
  unassignedTasks: number;
  openTickets: number;
  lowStockCount: number;
}

export interface RevenueWindow {
  revenue: number;
  orders: number;
}

export interface CeoData {
  live: boolean;
  today: RevenueWindow;
  last7: RevenueWindow;
  last30: RevenueWindow;
  delta7Pct: number; // last 7d vs the preceding 7d
  delta30Pct: number; // last 30d vs the preceding 30d
  revenueByDay: RevenueByDay[];
  ordersByStatus: OrdersByStatus[];
  salesByArea: SalesByArea[];
  topProducts: TopProduct[];
  lowStock: LowStockItem[];
  staff: StaffUtilization[];
  sla: SlaMetrics[];
  attention: NeedsAttention;
  latestBrief: AiReport | null;
}

const EMPTY: CeoData = {
  live: false,
  today: { revenue: 0, orders: 0 },
  last7: { revenue: 0, orders: 0 },
  last30: { revenue: 0, orders: 0 },
  delta7Pct: 0,
  delta30Pct: 0,
  revenueByDay: [],
  ordersByStatus: [],
  salesByArea: [],
  topProducts: [],
  lowStock: [],
  staff: [],
  sla: [],
  attention: { lateTasks: 0, unassignedTasks: 0, openTickets: 0, lowStockCount: 0 },
  latestBrief: null,
};

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

function sumWindow(rows: RevenueByDay[], fromDay: string, toDay: string): RevenueWindow {
  let revenue = 0;
  let orders = 0;
  for (const r of rows) {
    if (r.day >= fromDay && r.day <= toDay) {
      revenue += r.revenue ?? 0;
      orders += r.orders ?? 0;
    }
  }
  return { revenue: Math.round(revenue * 1000) / 1000, orders };
}

function pct(cur: number, prev: number): number {
  if (!prev) return cur > 0 ? 100 : 0;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

export async function fetchCeoData(): Promise<CeoData> {
  const client = await getServerClient();
  if (!client) return EMPTY;

  try {
    const now = new Date();
    const today = iso(now);
    const from = iso(new Date(now.getTime() - 60 * DAY)); // pull 60d for deltas

    const [
      revenueByDay,
      ordersByStatus,
      salesByArea,
      topProducts,
      lowStock,
      staff,
      sla,
    ] = await Promise.all([
      analytics.getRevenueByDay(client, { from, to: today }).catch(() => [] as RevenueByDay[]),
      analytics.getOrdersByStatus(client).catch(() => [] as OrdersByStatus[]),
      analytics.getSalesByArea(client).catch(() => [] as SalesByArea[]),
      analytics.getTopProducts(client, 8).catch(() => [] as TopProduct[]),
      analytics.getLowStock(client, 5).catch(() => [] as LowStockItem[]),
      analytics.getStaffUtilization(client).catch(() => [] as StaffUtilization[]),
      analytics.getSla(client).catch(() => [] as SlaMetrics[]),
    ]);

    const d7 = iso(new Date(now.getTime() - 7 * DAY));
    const d14 = iso(new Date(now.getTime() - 14 * DAY));
    const d30 = iso(new Date(now.getTime() - 30 * DAY));
    const d60 = iso(new Date(now.getTime() - 60 * DAY));

    const todayWin = sumWindow(revenueByDay, today, today);
    const last7 = sumWindow(revenueByDay, d7, today);
    const prev7 = sumWindow(revenueByDay, d14, d7);
    const last30 = sumWindow(revenueByDay, d30, today);
    const prev30 = sumWindow(revenueByDay, d60, d30);

    const attention = await fetchAttention(client, lowStock.length);
    const latestBrief = await ai.getLatestReport(client, 'daily_brief').catch(() => null);

    const live =
      revenueByDay.length > 0 ||
      ordersByStatus.length > 0 ||
      salesByArea.length > 0 ||
      latestBrief !== null;

    return {
      live,
      today: todayWin,
      last7,
      last30,
      delta7Pct: pct(last7.revenue, prev7.revenue),
      delta30Pct: pct(last30.revenue, prev30.revenue),
      revenueByDay: revenueByDay.filter((r) => r.day >= d30),
      ordersByStatus,
      salesByArea,
      topProducts,
      lowStock,
      staff,
      sla,
      attention,
      latestBrief,
    };
  } catch {
    return EMPTY;
  }
}

/** Live "needs attention" counts via direct reads (RLS = ops via is_ops()). */
async function fetchAttention(
  client: NonNullable<Awaited<ReturnType<typeof getServerClient>>>,
  lowStockCount: number,
): Promise<NeedsAttention> {
  const nowIso = new Date().toISOString();

  const [late, unassigned, tickets] = await Promise.all([
    client
      .from('fulfillment_tasks')
      .select('id', { count: 'exact', head: true })
      .lt('window_end', nowIso)
      .not('status', 'in', '(completed,failed,cancelled)')
      .then((r) => r.count ?? 0, () => 0),
    client
      .from('fulfillment_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'unassigned')
      .then((r) => r.count ?? 0, () => 0),
    client
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .in('status', ['open', 'pending'])
      .then((r) => r.count ?? 0, () => 0),
  ]);

  return { lateTasks: late, unassignedTasks: unassigned, openTickets: tickets, lowStockCount };
}

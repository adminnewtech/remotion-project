// NewTech OS — shared business aggregates for the AI layer (Deno).
//
// One place to compute the "state of the business right now" snapshot used by
// both the daily-report and ai-copilot Edge Functions. Runs with the
// service-role client (passed in) so it sees all rows regardless of RLS.
//
// Money is KWD (3 decimals). All reads are best-effort: a failing section
// degrades to a zero/empty value rather than throwing, so a brief can always be
// produced even if one query is unavailable.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { kwd } from "./supabaseAdmin.ts";

// Order statuses that count as "revenue-bearing" (mirrors analytics views).
const PAID_STATUSES = [
  "paid",
  "processing",
  "out_for_delivery",
  "delivered",
  "installing",
  "completed",
];

export interface DayMetrics {
  date: string; // YYYY-MM-DD (Asia/Kuwait)
  orders: number;
  revenue: number;
  aov: number;
}

export interface LowStockLine {
  name: string;
  sku: string | null;
  available: number;
}

export interface BusinessSnapshot {
  generated_at: string;
  timezone: string;
  today: DayMetrics;
  yesterday: DayMetrics;
  new_orders_by_status: Record<string, number>;
  late_tasks: number;
  unassigned_tasks: number;
  open_tickets: number;
  low_stock: LowStockLine[];
}

// Kuwait is UTC+3 with no DST → fixed offset is correct year-round.
const KW_OFFSET_MS = 3 * 60 * 60 * 1000;

/** YYYY-MM-DD for a given instant in Asia/Kuwait. */
function kwDate(d: Date): string {
  return new Date(d.getTime() + KW_OFFSET_MS).toISOString().slice(0, 10);
}

/** Start-of-day (UTC instant) for a Kuwait calendar date string. */
function kwDayStartUtc(dateStr: string): Date {
  // Midnight Kuwait (00:00 +03:00) = 21:00 UTC the previous day.
  return new Date(new Date(`${dateStr}T00:00:00.000Z`).getTime() - KW_OFFSET_MS);
}

async function dayMetrics(
  admin: SupabaseClient,
  dateStr: string,
): Promise<DayMetrics> {
  const start = kwDayStartUtc(dateStr);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  try {
    const { data, error } = await admin
      .from("orders")
      .select("total, placed_at, created_at, status")
      .in("status", PAID_STATUSES)
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString());
    if (error) throw error;
    const rows = data ?? [];
    const orders = rows.length;
    const revenue = kwd(
      rows.reduce((s: number, r: { total: number | null }) => s + (r.total ?? 0), 0),
    );
    return { date: dateStr, orders, revenue, aov: orders ? kwd(revenue / orders) : 0 };
  } catch (_e) {
    return { date: dateStr, orders: 0, revenue: 0, aov: 0 };
  }
}

async function newOrdersByStatus(
  admin: SupabaseClient,
  fromIso: string,
): Promise<Record<string, number>> {
  try {
    const { data, error } = await admin
      .from("orders")
      .select("status")
      .gte("created_at", fromIso);
    if (error) throw error;
    const out: Record<string, number> = {};
    for (const r of data ?? []) {
      const s = (r as { status: string }).status;
      out[s] = (out[s] ?? 0) + 1;
    }
    return out;
  } catch (_e) {
    return {};
  }
}

async function lateTasks(admin: SupabaseClient): Promise<number> {
  try {
    const nowIso = new Date().toISOString();
    const { count, error } = await admin
      .from("fulfillment_tasks")
      .select("id", { count: "exact", head: true })
      .lt("window_end", nowIso)
      .not("status", "in", "(completed,failed,cancelled)");
    if (error) throw error;
    return count ?? 0;
  } catch (_e) {
    return 0;
  }
}

async function unassignedTasks(admin: SupabaseClient): Promise<number> {
  try {
    const { count, error } = await admin
      .from("fulfillment_tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "unassigned");
    if (error) throw error;
    return count ?? 0;
  } catch (_e) {
    return 0;
  }
}

async function openTickets(admin: SupabaseClient): Promise<number> {
  try {
    const { count, error } = await admin
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "pending"]);
    if (error) throw error;
    return count ?? 0;
  } catch (_e) {
    return 0;
  }
}

async function lowStock(admin: SupabaseClient, limit = 5): Promise<LowStockLine[]> {
  // Reuse the gated SECURITY DEFINER reader (service-role passes is_ops()).
  try {
    const { data, error } = await admin.rpc("admin_low_stock", { p_threshold: 5 });
    if (error) throw error;
    const rows = (data ?? []) as Array<{
      name_en: string | null;
      name_ar: string | null;
      sku: string | null;
      available: number;
    }>;
    return rows
      .sort((a, b) => (a.available ?? 0) - (b.available ?? 0))
      .slice(0, limit)
      .map((r) => ({
        name: r.name_ar || r.name_en || r.sku || "—",
        sku: r.sku ?? null,
        available: r.available ?? 0,
      }));
  } catch (_e) {
    return [];
  }
}

/** Compose the full business snapshot used by the AI layer. */
export async function buildSnapshot(admin: SupabaseClient): Promise<BusinessSnapshot> {
  const now = new Date();
  const todayStr = kwDate(now);
  const yesterdayStr = kwDate(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [today, yesterday, byStatus, late, unassigned, tickets, low] = await Promise.all([
    dayMetrics(admin, todayStr),
    dayMetrics(admin, yesterdayStr),
    newOrdersByStatus(admin, since),
    lateTasks(admin),
    unassignedTasks(admin),
    openTickets(admin),
    lowStock(admin, 5),
  ]);

  return {
    generated_at: now.toISOString(),
    timezone: "Asia/Kuwait",
    today,
    yesterday,
    new_orders_by_status: byStatus,
    late_tasks: late,
    unassigned_tasks: unassigned,
    open_tickets: tickets,
    low_stock: low,
  };
}

/** Percentage delta of `cur` vs `prev` (0 when prev is 0). */
export function pctDelta(cur: number, prev: number): number {
  if (!prev) return cur > 0 ? 100 : 0;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

/**
 * Deterministic Arabic markdown brief from a snapshot. Works WITHOUT any LLM.
 * The daily-report function uses this as the body when ANTHROPIC_API_KEY is
 * unset, and as the base context when it is set.
 */
export function deterministicBriefAr(s: BusinessSnapshot): { title: string; body_md: string } {
  const rev = pctDelta(s.today.revenue, s.yesterday.revenue);
  const ord = pctDelta(s.today.orders, s.yesterday.orders);
  const sign = (n: number) => (n >= 0 ? `▲ ${n}%` : `▼ ${Math.abs(n)}%`);

  const statusLines = Object.entries(s.new_orders_by_status)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n") || "- لا توجد طلبات جديدة في آخر 24 ساعة";

  const attention: string[] = [];
  if (s.late_tasks > 0) attention.push(`- ⏰ مهام متأخرة عن موعدها: **${s.late_tasks}**`);
  if (s.unassigned_tasks > 0) attention.push(`- 🧭 مهام غير مُسندة: **${s.unassigned_tasks}**`);
  if (s.open_tickets > 0) attention.push(`- 🎫 تذاكر دعم مفتوحة: **${s.open_tickets}**`);
  for (const l of s.low_stock) {
    attention.push(`- 📦 مخزون منخفض: ${l.name} (متاح: ${l.available})`);
  }
  if (attention.length === 0) attention.push("- لا توجد بنود حرجة تحتاج انتباه ✅");

  const title = `الموجز اليومي — ${s.today.date}`;
  const body_md = [
    `# ${title}`,
    "",
    "## الأداء اليوم",
    `- الإيرادات: **${s.today.revenue.toLocaleString()} د.ك** (${sign(rev)} مقابل الأمس)`,
    `- عدد الطلبات: **${s.today.orders}** (${sign(ord)} مقابل الأمس)`,
    `- متوسط قيمة الطلب: **${s.today.aov.toLocaleString()} د.ك**`,
    "",
    "## طلبات آخر 24 ساعة حسب الحالة",
    statusLines,
    "",
    "## بنود تحتاج انتباه",
    attention.join("\n"),
    "",
    `_تم التوليد آلياً في ${new Date(s.generated_at).toISOString()} — التوقيت: ${s.timezone}_`,
  ].join("\n");

  return { title, body_md };
}

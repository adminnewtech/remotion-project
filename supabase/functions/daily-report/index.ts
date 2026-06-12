// NewTech OS — daily-report Edge Function (Deno, service-role).
//
// Aggregates the current business snapshot (today/yesterday revenue & orders,
// new orders by status, late/unassigned tasks, low stock top-5, open tickets),
// composes a concise Arabic markdown executive brief, optionally enhances the
// summary via Claude (claude-sonnet-4-6) when ANTHROPIC_API_KEY is set, inserts
// it into `ai_reports` (kind 'daily_brief'), and optionally fans the brief out
// to all admins via enqueue_notification.
//
// Works WITHOUT any LLM key — the deterministic Arabic template is the baseline.
//
// Auth: caller must present EITHER the service-role bearer token (cron / trusted
// invoker) OR an is_ops JWT (admin clicking "generate now" in the CEO page).
//
// Contract
//   POST  (body optional) { notify?: boolean }   default notify = false
//   200   { ok: true, report: { id, kind, title, body_md, data, created_at }, ai: boolean, anomaly_count: number }
//   401   { error }  — not authorized
//   500   { error, detail }

import { serve } from "https://deno.land/std/http/server.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handlePreflight, json, jsonError } from "../_shared/cors.ts";
import { getAdminClient, getUserFromRequest, AuthError } from "../_shared/supabaseAdmin.ts";
import { buildSnapshot, deterministicBriefAr } from "../_shared/aggregates.ts";
import { askClaude, hasClaude } from "../_shared/anthropic.ts";

const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// ---------------------------------------------------------------------------
// Anomaly detection types
// ---------------------------------------------------------------------------

type AnomalyKind =
  | "revenue_spike_or_drop"
  | "negative_margin_sales"
  | "unremitted_cod"
  | "ledger_mismatch"
  | "serials_without_warranty";

interface AnomalyCandidate {
  kind: AnomalyKind;
  // deno-lint-ignore no-explicit-any
  data: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Helper: execute raw SQL via the service-role execute_sql RPC.
// Returns rows or [] on any error so anomaly checks never crash the report.
// ---------------------------------------------------------------------------

async function fetchSql<T>(admin: SupabaseClient, sql: string): Promise<T[]> {
  try {
    // deno-lint-ignore no-explicit-any
    const { data, error } = await (admin as any).rpc("execute_sql", { sql_query: sql });
    if (error) {
      console.warn("[daily-report] fetchSql error:", error);
      return [];
    }
    return (data as T[]) ?? [];
  } catch (e) {
    console.warn("[daily-report] fetchSql threw:", e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Deterministic anomaly detection pre-pass
// ---------------------------------------------------------------------------

async function detectAnomalies(admin: SupabaseClient): Promise<AnomalyCandidate[]> {
  // Run all five checks in parallel.
  const [
    revenueRows,
    negMarginRows,
    codRows,
    ledgerRows,
    serialsRows,
  ] = await Promise.all([
    // 1. Revenue z-score — compare today vs 28-day mean/stddev
    fetchSql<{ today_rev: number | null; mu: number | null; sd: number | null; zscore: number | null }>(
      admin,
      `WITH daily AS (
        SELECT date_trunc('day', created_at) d, sum(amount) rev
        FROM payments WHERE status='paid' AND created_at > now()-interval '29 days'
        GROUP BY 1
      ), stats AS (
        SELECT avg(rev) mu, stddev(rev) sd FROM daily WHERE d < current_date
      )
      SELECT
        (SELECT rev FROM daily WHERE d=current_date) today_rev,
        mu,
        sd,
        CASE WHEN sd>0 THEN round(((SELECT rev FROM daily WHERE d=current_date)-mu)/sd,2) END zscore
      FROM stats`,
    ),

    // 2. Negative-margin sales in last 24 hours
    fetchSql<{ cnt: number }>(
      admin,
      `SELECT count(*) cnt FROM order_items oi
       JOIN product_variants pv ON pv.id=oi.variant_id
       WHERE oi.unit_price < pv.avg_cost AND pv.avg_cost > 0
         AND oi.created_at > now()-interval '24 hours'`,
    ),

    // 3. Unremitted COD older than 3 days
    fetchSql<{ cnt: number; total: number }>(
      admin,
      `SELECT count(*) cnt, coalesce(sum(amount),0) total FROM cod_remittances
       WHERE status='received' AND created_at < now()-interval '3 days'`,
    ),

    // 4. Ledger delta from the v_ledger_delta view
    fetchSql<{ delta: number }>(admin, `SELECT delta FROM v_ledger_delta`),

    // 5. Product serials sold without a linked warranty in last 24 hours
    fetchSql<{ cnt: number }>(
      admin,
      `SELECT count(*) cnt FROM product_serials ps
       LEFT JOIN warranties w ON w.serial_id=ps.id
       WHERE ps.status='sold' AND w.id IS NULL
         AND ps.updated_at > now()-interval '24 hours'`,
    ),
  ]);

  const anomalies: AnomalyCandidate[] = [];

  // Check 1: Revenue z-score
  if (revenueRows.length > 0) {
    const row = revenueRows[0];
    const z = row?.zscore != null ? Number(row.zscore) : null;
    if (z != null && (z < -2 || z > 3)) {
      anomalies.push({
        kind: "revenue_spike_or_drop",
        data: {
          today_rev: row.today_rev,
          mean_28d: row.mu,
          stddev_28d: row.sd,
          zscore: z,
        },
      });
    }
  }

  // Check 2: Negative-margin sales
  if (negMarginRows.length > 0) {
    const cnt = Number(negMarginRows[0]?.cnt ?? 0);
    if (cnt > 0) {
      anomalies.push({
        kind: "negative_margin_sales",
        data: { count: cnt },
      });
    }
  }

  // Check 3: Unremitted COD
  if (codRows.length > 0) {
    const row = codRows[0];
    const cnt = Number(row?.cnt ?? 0);
    if (cnt > 0) {
      anomalies.push({
        kind: "unremitted_cod",
        data: { count: cnt, total_amount: row.total },
      });
    }
  }

  // Check 4: Ledger delta
  if (ledgerRows.length > 0) {
    const delta = Number(ledgerRows[0]?.delta ?? 0);
    if (Math.abs(delta) > 0.01) {
      anomalies.push({
        kind: "ledger_mismatch",
        data: { delta },
      });
    }
  }

  // Check 5: Serials sold without warranty
  if (serialsRows.length > 0) {
    const cnt = Number(serialsRows[0]?.cnt ?? 0);
    if (cnt > 0) {
      anomalies.push({
        kind: "serials_without_warranty",
        data: { count: cnt },
      });
    }
  }

  return anomalies;
}

// ---------------------------------------------------------------------------
// Build a markdown section summarising detected anomalies (Arabic)
// ---------------------------------------------------------------------------

function anomalyMarkdownAr(anomalies: AnomalyCandidate[]): string {
  if (anomalies.length === 0) return "";

  const kindLabels: Record<AnomalyKind, string> = {
    revenue_spike_or_drop: "انحراف الإيرادات",
    negative_margin_sales: "مبيعات بهامش سلبي",
    unremitted_cod: "COD غير محوّل (> 3 أيام)",
    ledger_mismatch: "فارق في دفتر الأستاذ",
    serials_without_warranty: "أجهزة مباعة بلا ضمان",
  };

  const lines: string[] = ["\n\n---\n\n## ⚠️ تنبيهات تلقائية"];
  for (const a of anomalies) {
    const label = kindLabels[a.kind] ?? a.kind;
    const dataStr = Object.entries(a.data)
      .map(([k, v]) => `${k}: ${v}`)
      .join(" | ");
    lines.push(`- **${label}** — ${dataStr}`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/** True if the request carries the service-role bearer token. */
function isServiceRole(req: Request): boolean {
  const auth = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  return !!SERVICE_ROLE_KEY && auth.toLowerCase().startsWith("bearer ") &&
    auth.slice(7).trim() === SERVICE_ROLE_KEY;
}

/** Allow service-role OR an is_ops (employee/admin) JWT. */
async function authorize(req: Request): Promise<void> {
  if (isServiceRole(req)) return;
  const user = await getUserFromRequest(req); // throws AuthError if invalid
  if (user.role !== "admin" && user.role !== "employee") {
    throw new AuthError("Ops role required");
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req: Request): Promise<Response> => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  try {
    await authorize(req);
  } catch (err) {
    if (err instanceof AuthError) return jsonError(err.message, 401);
    return jsonError("Unauthorized", 401);
  }

  let notify = false;
  try {
    const body = await req.json();
    notify = body?.notify === true;
  } catch {
    /* empty body is fine */
  }

  const admin = getAdminClient();

  try {
    // Stable session ID shared across all agent_actions inserts for this run.
    const sessionId = crypto.randomUUID();

    // -----------------------------------------------------------------------
    // Anomaly detection pre-pass (deterministic, before any LLM call)
    // -----------------------------------------------------------------------
    let anomalies: AnomalyCandidate[] = [];
    try {
      anomalies = await detectAnomalies(admin);
    } catch (e) {
      // Anomaly detection is best-effort; never crash the report.
      console.error("[daily-report] detectAnomalies failed", e);
    }

    // Persist each anomaly as a proposal in agent_actions (best-effort).
    if (anomalies.length > 0) {
      try {
        await admin.from("agent_actions").insert(
          anomalies.map((candidate) => ({
            agent: "insight",
            session_id: sessionId,
            tool: "propose_action",
            input: { anomaly: candidate.kind, data: candidate.data },
            status: "proposed",
            risk: "sensitive",
          })),
        );
      } catch (e) {
        console.error("[daily-report] agent_actions insert failed", e);
      }
    }

    // -----------------------------------------------------------------------
    // Snapshot + deterministic Arabic brief
    // -----------------------------------------------------------------------
    const snapshot = await buildSnapshot(admin);
    const base = deterministicBriefAr(snapshot);

    // Append anomaly section to the deterministic brief so Claude also sees it.
    const anomalySection = anomalyMarkdownAr(anomalies);
    const baseBodyWithAnomalies = base.body_md + anomalySection;

    // -----------------------------------------------------------------------
    // Optionally enhance the executive summary with Claude.
    // Claude receives both the raw snapshot and the anomaly list.
    // -----------------------------------------------------------------------
    let body_md = baseBodyWithAnomalies;
    let usedAi = false;
    if (hasClaude()) {
      const enhanced = await askClaude({
        maxTokens: 800,
        system:
          "أنت محلل أعمال تنفيذي لمتجر إلكترونيات وتوصيل وتركيب في الكويت (Newtech). " +
          "اكتب موجزاً تنفيذياً موجزاً بالعربية بصيغة Markdown من بيانات JSON المعطاة. " +
          "ابدأ بعنوان، ثم فقرة ملخص من 2-3 جمل، ثم قسم 'الأرقام' بنقاط، ثم قسم " +
          "'بنود تحتاج انتباه' يبرز المهام المتأخرة وغير المُسندة والمخزون المنخفض والتذاكر. " +
          "إذا وُجدت تنبيهات تلقائية في البيانات، أضف قسم 'تنبيهات النظام' وأبرزها بوضوح. " +
          "كن دقيقاً بالأرقام ولا تخترع بيانات غير موجودة. اجعله قابلاً للقراءة في 20 ثانية.",
        messages: [
          {
            role: "user",
            content:
              "بيانات اليوم (JSON):\n```json\n" +
              JSON.stringify({ snapshot, anomalies }, null, 2) +
              "\n```\nالموجز الأولي:\n" +
              baseBodyWithAnomalies +
              "\n\nاكتب الموجز التنفيذي المحسّن.",
          },
        ],
      });
      if (enhanced && enhanced.trim().length > 0) {
        body_md = enhanced.trim();
        usedAi = true;
      }
    }

    const { data: report, error: insErr } = await admin
      .from("ai_reports")
      .insert({
        kind: "daily_brief",
        title: base.title,
        body_md,
        data: { snapshot, ai: usedAi, anomaly_count: anomalies.length, anomalies },
      })
      .select("id, kind, title, body_md, data, created_at")
      .single();
    if (insErr) throw insErr;

    // Optional fan-out to all admins (best-effort).
    if (notify) {
      try {
        const { data: admins } = await admin
          .from("profiles")
          .select("id")
          .eq("role", "admin")
          .eq("is_active", true);
        for (const a of admins ?? []) {
          await admin.rpc("enqueue_notification", {
            p_user_id: (a as { id: string }).id,
            p_kind: "daily_brief",
            p_title_ar: base.title,
            p_title_en: "Daily executive brief",
            p_body_ar: "الموجز اليومي التنفيذي جاهز في لوحة الرئيس التنفيذي.",
            p_body_en: "The daily executive brief is ready in the CEO dashboard.",
            p_data: { report_id: report.id, kind: "daily_brief" },
          });
        }
      } catch (e) {
        console.error("[daily-report] notify fan-out failed", e);
      }
    }

    return json({ ok: true, report, ai: usedAi, anomaly_count: anomalies.length });
  } catch (err) {
    console.error("[daily-report] error", err);
    return jsonError("Failed to generate daily report", 500, {
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

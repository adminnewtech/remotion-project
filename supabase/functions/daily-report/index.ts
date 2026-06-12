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
//   200   { ok: true, report: { id, kind, title, body_md, data, created_at }, ai: boolean }
//   401   { error }  — not authorized
//   500   { error, detail }

import { serve } from "https://deno.land/std/http/server.ts";
import { handlePreflight, json, jsonError } from "../_shared/cors.ts";
import { getAdminClient, getUserFromRequest, AuthError } from "../_shared/supabaseAdmin.ts";
import { buildSnapshot, deterministicBriefAr } from "../_shared/aggregates.ts";
import { askClaude, hasClaude } from "../_shared/anthropic.ts";

const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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
    const snapshot = await buildSnapshot(admin);
    const base = deterministicBriefAr(snapshot);

    // Optionally enhance the executive summary with Claude.
    let body_md = base.body_md;
    let usedAi = false;
    if (hasClaude()) {
      const enhanced = await askClaude({
        maxTokens: 800,
        system:
          "أنت محلل أعمال تنفيذي لمتجر إلكترونيات وتوصيل وتركيب في الكويت (Newtech). " +
          "اكتب موجزاً تنفيذياً موجزاً بالعربية بصيغة Markdown من بيانات JSON المعطاة. " +
          "ابدأ بعنوان، ثم فقرة ملخص من 2-3 جمل، ثم قسم 'الأرقام' بنقاط، ثم قسم " +
          "'بنود تحتاج انتباه' يبرز المهام المتأخرة وغير المُسندة والمخزون المنخفض والتذاكر. " +
          "كن دقيقاً بالأرقام ولا تخترع بيانات غير موجودة. اجعله قابلاً للقراءة في 20 ثانية.",
        messages: [
          {
            role: "user",
            content:
              "بيانات اليوم (JSON):\n```json\n" +
              JSON.stringify(snapshot, null, 2) +
              "\n```\nاكتب الموجز التنفيذي.",
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
        data: { snapshot, ai: usedAi },
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

    return json({ ok: true, report, ai: usedAi });
  } catch (err) {
    console.error("[daily-report] error", err);
    return jsonError("Failed to generate daily report", 500, {
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

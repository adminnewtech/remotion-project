// NewTech OS — ai-copilot Edge Function (Deno).
//
// An ops-only conversational copilot over live business data. Verifies the
// caller's JWT and that they are is_ops (employee/admin via profiles). Builds a
// fresh business snapshot and either:
//   * answers with Claude (claude-sonnet-4-6) using the snapshot as grounded
//     context, when ANTHROPIC_API_KEY is set; OR
//   * returns a deterministic answer for known intents (sales today, low stock,
//     late orders) parsed by Arabic/English keywords, with a note that full AI
//     needs the API key.
//
// Both sides of the exchange are logged to `ai_conversations` (user + assistant)
// for the audit trail.
//
// Contract
//   POST { message: string, context?: string }
//   200  { ok: true, answer: string, ai: boolean, data: { snapshot } }
//   400  { error }   — missing message
//   401  { error }   — not ops
//   500  { error, detail }

import { serve } from "https://deno.land/std/http/server.ts";
import { handlePreflight, json, jsonError } from "../_shared/cors.ts";
import { getAdminClient, getUserFromRequest, AuthError } from "../_shared/supabaseAdmin.ts";
import { buildSnapshot, type BusinessSnapshot, pctDelta } from "../_shared/aggregates.ts";
import { askClaude, hasClaude } from "../_shared/anthropic.ts";

interface CopilotRequest {
  message: string;
  context?: string;
}

const SYSTEM_PROMPT =
  "أنت مساعد العمليات الذكي لـ Newtech (متجر إلكترونيات + توصيل + تركيب في الكويت). " +
  "تجيب على فريق العمليات والإدارة بإيجاز ودقة بالعربية (أو بلغة السؤال). لديك لقطة " +
  "JSON محدّثة لحالة العمل (الإيرادات، الطلبات، المهام المتأخرة/غير المُسندة، المخزون " +
  "المنخفض، التذاكر). استند فقط إلى هذه البيانات؛ إذا سُئلت عن شيء غير موجود فيها، " +
  "وضّح أنك لا تملك تلك البيانات. أعطِ أرقاماً عند توفرها واقترح إجراءً عند وجود بند " +
  "يحتاج انتباه.";

/** Build the deterministic answer when no LLM key is configured. */
function deterministicAnswer(message: string, s: BusinessSnapshot): string {
  const q = message.toLowerCase();
  const has = (...kw: string[]) => kw.some((k) => q.includes(k.toLowerCase()) || message.includes(k));

  const parts: string[] = [];

  const wantsSales = has("sales", "revenue", "مبيعات", "ايرادات", "إيرادات", "اليوم", "today");
  const wantsLowStock = has("stock", "inventory", "مخزون", "نفاد", "low");
  const wantsLate = has("late", "delay", "متأخر", "متأخرة", "تأخير", "unassigned", "غير مسند", "مهام");
  const wantsTickets = has("ticket", "support", "تذاكر", "دعم");

  if (wantsSales) {
    const rev = pctDelta(s.today.revenue, s.yesterday.revenue);
    parts.push(
      `مبيعات اليوم (${s.today.date}): ${s.today.revenue.toLocaleString()} د.ك من ${s.today.orders} طلب ` +
        `(متوسط ${s.today.aov.toLocaleString()} د.ك) — ${rev >= 0 ? "▲" : "▼"} ${Math.abs(rev)}% مقابل الأمس.`,
    );
  }
  if (wantsLate) {
    parts.push(
      `المهام المتأخرة: ${s.late_tasks} — المهام غير المُسندة: ${s.unassigned_tasks}.`,
    );
  }
  if (wantsLowStock) {
    if (s.low_stock.length) {
      parts.push(
        "المخزون المنخفض:\n" +
          s.low_stock.map((l) => `- ${l.name}: ${l.available} متاح`).join("\n"),
      );
    } else {
      parts.push("لا يوجد مخزون منخفض حالياً.");
    }
  }
  if (wantsTickets) {
    parts.push(`تذاكر الدعم المفتوحة: ${s.open_tickets}.`);
  }

  if (parts.length === 0) {
    parts.push(
      "يمكنني الإجابة عن: مبيعات اليوم، المخزون المنخفض، المهام المتأخرة/غير المُسندة، وتذاكر الدعم. " +
        "اسألني مثلاً: «كم مبيعات اليوم؟» أو «وش المخزون اللي خلص؟».",
    );
  }
  parts.push(
    "\n_ملاحظة: الذكاء الاصطناعي الكامل غير مفعّل (لم يُضبط ANTHROPIC_API_KEY) — هذه إجابة محسوبة من البيانات المباشرة._",
  );
  return parts.join("\n\n");
}

serve(async (req: Request): Promise<Response> => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  // ── Authn/z: must be ops ───────────────────────────────────────────────
  let userId: string;
  try {
    const user = await getUserFromRequest(req);
    if (user.role !== "admin" && user.role !== "employee") {
      return jsonError("Ops role required", 401);
    }
    userId = user.id;
  } catch (err) {
    if (err instanceof AuthError) return jsonError(err.message, 401);
    return jsonError("Unauthorized", 401);
  }

  let body: CopilotRequest;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }
  const message = (body?.message ?? "").trim();
  if (!message) return jsonError("message is required", 400);

  const admin = getAdminClient();

  try {
    const snapshot = await buildSnapshot(admin);

    // Log the user turn (service-role write so it's attributed but trusted).
    await admin
      .from("ai_conversations")
      .insert({ user_id: userId, role: "user", content: message, data: {} })
      .then(({ error }) => {
        if (error) console.error("[ai-copilot] log user failed", error);
      });

    let answer: string;
    let usedAi = false;

    if (hasClaude()) {
      const ctx =
        "حالة العمل الحالية (JSON):\n```json\n" +
        JSON.stringify(snapshot, null, 2) +
        "\n```" +
        (body.context ? `\n\nسياق إضافي من المستخدم: ${body.context}` : "");
      const reply = await askClaude({
        maxTokens: 800,
        system: SYSTEM_PROMPT,
        messages: [
          { role: "user", content: `${ctx}\n\nسؤال المستخدم: ${message}` },
        ],
      });
      if (reply && reply.trim()) {
        answer = reply.trim();
        usedAi = true;
      } else {
        answer = deterministicAnswer(message, snapshot);
      }
    } else {
      answer = deterministicAnswer(message, snapshot);
    }

    // Log the assistant turn.
    await admin
      .from("ai_conversations")
      .insert({
        user_id: userId,
        role: "assistant",
        content: answer,
        data: { ai: usedAi },
      })
      .then(({ error }) => {
        if (error) console.error("[ai-copilot] log assistant failed", error);
      });

    return json({ ok: true, answer, ai: usedAi, data: { snapshot } });
  } catch (err) {
    console.error("[ai-copilot] error", err);
    return jsonError("Copilot failed", 500, {
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

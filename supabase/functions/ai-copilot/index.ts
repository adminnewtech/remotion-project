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
// When the message matches an action intent, tool-use mode activates and routes
// through the HITL approval system via `agent_actions`.
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
import { hasClaude } from "../_shared/anthropic.ts";

// ── Constants ──────────────────────────────────────────────────────────────────
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-6";
const ANTHROPIC_VERSION = "2023-06-01";

interface CopilotRequest {
  message: string;
  context?: string;
}

// ── System prompt (conversational + tool instructions) ─────────────────────────
const SYSTEM_PROMPT =
  "أنت مساعد العمليات الذكي لـ Newtech (متجر إلكترونيات + توصيل + تركيب في الكويت). " +
  "تجيب على فريق العمليات والإدارة بإيجاز ودقة بالعربية (أو بلغة السؤال). لديك لقطة " +
  "JSON محدّثة لحالة العمل (الإيرادات، الطلبات، المهام المتأخرة/غير المُسندة، المخزون " +
  "المنخفض، التذاكر). استند فقط إلى هذه البيانات؛ إذا سُئلت عن شيء غير موجود فيها، " +
  "وضّح أنك لا تملك تلك البيانات. أعطِ أرقاماً عند توفرها واقترح إجراءً عند وجود بند " +
  "يحتاج انتباه.\n\n" +
  "## أدوات الإجراءات\n" +
  "عندما يطلب المستخدم تنفيذ إجراء (إنشاء أمر شراء، كود خصم، أو استعلام مقياس)، " +
  "استخدم الأداة المناسبة بدلاً من الإجابة النصية فقط. قواعد تنفيذ الأدوات:\n" +
  "- read: تُنفَّذ فوراً وتُعاد النتيجة.\n" +
  "- write: تُنفَّذ فوراً كمسودة وتُضاف ملاحظة بالإنشاء.\n" +
  "- sensitive: تُسجَّل كاقتراح للموافقة البشرية في /admin/approvals ولا تُنفَّذ.";

// ── Tool definitions (Claude tool_use format) ──────────────────────────────────
const TOOLS = [
  {
    name: "query_metric",
    description:
      "استعلام مقياس عمل محدد من قاعدة البيانات المباشرة. " +
      "استخدمه عندما يسأل المستخدم عن: إيرادات اليوم، عدد المنتجات منخفضة المخزون، " +
      "المهام المتأخرة، التذاكر المفتوحة، أو أوامر الشراء المعلقة.",
    input_schema: {
      type: "object",
      properties: {
        metric: {
          type: "string",
          enum: [
            "revenue_today",
            "low_stock_count",
            "late_tasks",
            "open_tickets",
            "pending_pos",
          ],
          description:
            "المقياس المطلوب: revenue_today | low_stock_count | late_tasks | open_tickets | pending_pos",
        },
      },
      required: ["metric"],
    },
  },
  {
    name: "create_purchase_order",
    description:
      "ينشئ أمر شراء مسودة (draft) لمورد بمجموعة SKUs ومستودع محدد. " +
      "استخدمه عندما يطلب المستخدم إنشاء أمر شراء أو PO.",
    input_schema: {
      type: "object",
      properties: {
        supplier_name: {
          type: "string",
          description: "اسم المورد (يُبحث عنه بـ ILIKE)",
        },
        variant_skus: {
          type: "array",
          items: { type: "string" },
          description: "قائمة بأكواد SKU للمنتجات المراد طلبها",
        },
        location_id: {
          type: "string",
          description: "UUID للمستودع/الموقع",
        },
      },
      required: ["supplier_name", "variant_skus", "location_id"],
    },
  },
  {
    name: "create_discount_code",
    description:
      "يقترح إنشاء كود خصم جديد — يُحال للموافقة البشرية (HITL) ولا يُنفَّذ فوراً. " +
      "استخدمه عندما يطلب المستخدم إنشاء كود خصم أو كوبون.",
    input_schema: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "كود الخصم (نص فريد)",
        },
        kind: {
          type: "string",
          enum: ["pct", "fixed"],
          description: "نوع الخصم: pct (نسبة مئوية) أو fixed (مبلغ ثابت)",
        },
        value: {
          type: "number",
          description: "قيمة الخصم (رقم موجب)",
        },
        expires_days: {
          type: "number",
          description: "عدد الأيام حتى انتهاء الصلاحية (اختياري)",
        },
      },
      required: ["code", "kind", "value"],
    },
  },
];

// ── Tool risk tiers ────────────────────────────────────────────────────────────
const TOOL_RISK: Record<string, "read" | "write" | "sensitive"> = {
  query_metric: "read",
  create_purchase_order: "write",
  create_discount_code: "sensitive",
};

// ── Input interfaces ───────────────────────────────────────────────────────────

interface QueryMetricInput {
  metric: "revenue_today" | "low_stock_count" | "late_tasks" | "open_tickets" | "pending_pos";
}

interface CreatePurchaseOrderInput {
  supplier_name: string;
  variant_skus: string[];
  location_id: string;
}

interface CreateDiscountCodeInput {
  code: string;
  kind: "pct" | "fixed";
  value: number;
  expires_days?: number;
}

// ── Tool executors ─────────────────────────────────────────────────────────────

async function executeQueryMetric(
  input: QueryMetricInput,
  admin: ReturnType<typeof getAdminClient>,
): Promise<{ metric: string; value: number; label: string }> {
  const { metric } = input;

  if (metric === "revenue_today") {
    const todayKw = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const startUtc = new Date(
      new Date(`${todayKw}T00:00:00.000Z`).getTime() - 3 * 60 * 60 * 1000,
    );
    const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
    const { data } = await admin
      .from("orders")
      .select("total")
      .in("status", [
        "paid", "processing", "out_for_delivery", "delivered", "installing", "completed",
      ])
      .gte("created_at", startUtc.toISOString())
      .lt("created_at", endUtc.toISOString());
    const value =
      Math.round(
        ((data ?? []).reduce(
          (s: number, r: { total: number | null }) => s + (r.total ?? 0),
          0,
        ) +
          Number.EPSILON) *
          1000,
      ) / 1000;
    return { metric, value, label: `إيرادات اليوم: ${value.toLocaleString()} د.ك` };
  }

  if (metric === "low_stock_count") {
    const { data } = await admin.rpc("admin_low_stock", { p_threshold: 5 });
    const value = (data ?? []).length;
    return { metric, value, label: `منتجات المخزون المنخفض: ${value}` };
  }

  if (metric === "late_tasks") {
    const { count } = await admin
      .from("fulfillment_tasks")
      .select("id", { count: "exact", head: true })
      .lt("window_end", new Date().toISOString())
      .not("status", "in", "(completed,failed,cancelled)");
    const value = count ?? 0;
    return { metric, value, label: `المهام المتأخرة: ${value}` };
  }

  if (metric === "open_tickets") {
    const { count } = await admin
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "pending"]);
    const value = count ?? 0;
    return { metric, value, label: `التذاكر المفتوحة: ${value}` };
  }

  if (metric === "pending_pos") {
    const { count } = await admin
      .from("purchase_orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["draft", "ordered"]);
    const value = count ?? 0;
    return { metric, value, label: `أوامر الشراء المعلقة: ${value}` };
  }

  throw new Error(`unknown metric: ${metric}`);
}

async function executeCreatePurchaseOrder(
  input: CreatePurchaseOrderInput,
  userId: string,
  admin: ReturnType<typeof getAdminClient>,
): Promise<{ po_id: string; po_number: string; item_count: number }> {
  const { supplier_name, variant_skus, location_id } = input;

  // Lookup supplier by name (case-insensitive)
  const { data: suppliers, error: suppErr } = await admin
    .from("suppliers")
    .select("id, name")
    .ilike("name", `%${supplier_name}%`)
    .limit(1);
  if (suppErr) throw new Error(`خطأ في البحث عن المورد: ${suppErr.message}`);
  if (!suppliers || suppliers.length === 0) {
    throw new Error(`لم يُعثر على مورد بالاسم: ${supplier_name}`);
  }
  const supplier = suppliers[0] as { id: string; name: string };

  // Lookup variants by SKU
  const { data: variants, error: varErr } = await admin
    .from("product_variants")
    .select("id, sku")
    .in("sku", variant_skus);
  if (varErr) throw new Error(`خطأ في البحث عن المنتجات: ${varErr.message}`);
  if (!variants || variants.length === 0) {
    throw new Error(
      `لم يُعثر على منتجات بالـ SKUs المحددة: ${variant_skus.join(", ")}`,
    );
  }

  // Insert draft PO
  const { data: po, error: poErr } = await admin
    .from("purchase_orders")
    .insert({
      supplier_id: supplier.id,
      location_id,
      status: "draft",
      created_by: userId,
      note: "تم الإنشاء بواسطة مساعد العمليات الذكي",
    })
    .select("id, po_number")
    .single();
  if (poErr || !po) {
    throw new Error(`خطأ في إنشاء أمر الشراء: ${poErr?.message ?? "unknown"}`);
  }
  const poRow = po as { id: string; po_number: string };

  // Insert PO items (qty_ordered=1, unit_cost=0 as defaults for draft)
  const items = (variants as { id: string; sku: string }[]).map((v) => ({
    po_id: poRow.id,
    variant_id: v.id,
    qty_ordered: 1,
    unit_cost: 0,
  }));
  const { error: itemsErr } = await admin.from("purchase_order_items").insert(items);
  if (itemsErr) {
    throw new Error(`خطأ في إضافة بنود أمر الشراء: ${itemsErr.message}`);
  }

  return { po_id: poRow.id, po_number: poRow.po_number, item_count: items.length };
}

async function proposeDiscountCode(
  input: CreateDiscountCodeInput,
  sessionId: string,
  admin: ReturnType<typeof getAdminClient>,
): Promise<{ proposed: true; action_id: string }> {
  const { data, error } = await admin
    .from("agent_actions")
    .insert({
      agent: "ops",
      session_id: sessionId,
      tool: "create_discount_code",
      input: input as unknown as Record<string, unknown>,
      output: null,
      status: "proposed",
      risk: "sensitive",
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`خطأ في تسجيل الاقتراح: ${error?.message ?? "unknown"}`);
  }
  return { proposed: true, action_id: (data as { id: string }).id };
}

// ── Anthropic API with tools ───────────────────────────────────────────────────

interface ContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: string;
  [key: string]: unknown;
}

interface ToolUseBlock extends ContentBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}

async function callAnthropicWithTools(opts: {
  system: string;
  messages: { role: string; content: string | ContentBlock[] }[];
  maxTokens?: number;
}): Promise<{ stop_reason: string; content: ContentBlock[] }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: opts.maxTokens ?? 1024,
      system: opts.system,
      messages: opts.messages,
      tools: TOOLS,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }

  return await res.json() as { stop_reason: string; content: ContentBlock[] };
}

/** Build the deterministic answer when no LLM key is configured. */
function deterministicAnswer(message: string, s: BusinessSnapshot): string {
  const q = message.toLowerCase();
  const has = (...kw: string[]) =>
    kw.some((k) => q.includes(k.toLowerCase()) || message.includes(k));

  const parts: string[] = [];

  const wantsSales = has("sales", "revenue", "مبيعات", "ايرادات", "إيرادات", "اليوم", "today");
  const wantsLowStock = has("stock", "inventory", "مخزون", "نفاد", "low");
  const wantsLate = has(
    "late",
    "delay",
    "متأخر",
    "متأخرة",
    "تأخير",
    "unassigned",
    "غير مسند",
    "مهام",
  );
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

// ── Main handler ───────────────────────────────────────────────────────────────
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

  // Stable session ID for this turn — links agent_actions to this conversation
  const sessionId = crypto.randomUUID();

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
      const userContent =
        "حالة العمل الحالية (JSON):\n```json\n" +
        JSON.stringify(snapshot, null, 2) +
        "\n```" +
        (body.context ? `\n\nسياق إضافي من المستخدم: ${body.context}` : "") +
        `\n\nسؤال/طلب المستخدم: ${message}`;

      // ── First turn: Claude may respond with text or request tool calls ──
      const firstResp = await callAnthropicWithTools({
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userContent }],
        maxTokens: 1024,
      });

      const firstText =
        (firstResp.content.find((b) => b.type === "text")?.text as string | undefined)?.trim() ??
        null;
      const toolCalls = firstResp.content.filter(
        (b): b is ToolUseBlock => b.type === "tool_use",
      );

      if (toolCalls.length > 0) {
        // ── Tool-use branch ──────────────────────────────────────────────
        usedAi = true;

        // Build the assistant content array (text block + tool_use blocks)
        const assistantBlocks: ContentBlock[] = [];
        if (firstText) assistantBlocks.push({ type: "text", text: firstText });
        for (const tc of toolCalls) {
          assistantBlocks.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.input });
        }

        // Execute each tool and collect results + human-readable notes
        const toolResultBlocks: ContentBlock[] = [];
        const actionNotes: string[] = [];

        for (const tc of toolCalls) {
          const risk = TOOL_RISK[tc.name] ?? "read";

          try {
            if (tc.name === "query_metric") {
              const result = await executeQueryMetric(tc.input as QueryMetricInput, admin);
              toolResultBlocks.push({
                type: "tool_result",
                tool_use_id: tc.id,
                content: JSON.stringify(result),
              });

            } else if (tc.name === "create_purchase_order" && risk === "write") {
              const result = await executeCreatePurchaseOrder(
                tc.input as CreatePurchaseOrderInput,
                userId,
                admin,
              );
              toolResultBlocks.push({
                type: "tool_result",
                tool_use_id: tc.id,
                content: JSON.stringify(result),
              });
              actionNotes.push(
                `تم إنشاء أمر الشراء ${result.po_number} كمسودة (${result.item_count} بنود).`,
              );
              // Log the write action
              await admin.from("agent_actions").insert({
                agent: "ops",
                session_id: sessionId,
                tool: tc.name,
                input: tc.input as Record<string, unknown>,
                output: result,
                status: "executed",
                risk: "write",
              });

            } else if (tc.name === "create_discount_code" && risk === "sensitive") {
              // Never execute — insert as proposed for HITL approval
              const result = await proposeDiscountCode(
                tc.input as CreateDiscountCodeInput,
                sessionId,
                admin,
              );
              toolResultBlocks.push({
                type: "tool_result",
                tool_use_id: tc.id,
                content: JSON.stringify(result),
              });
              actionNotes.push(
                `تم اقتراح كود الخصم وهو بانتظار الموافقة في /admin/approvals` +
                  ` (رقم الإجراء: ${result.action_id}).`,
              );

            } else {
              toolResultBlocks.push({
                type: "tool_result",
                tool_use_id: tc.id,
                content: JSON.stringify({ error: `أداة غير معروفة: ${tc.name}` }),
              });
            }
          } catch (toolErr) {
            const errMsg = toolErr instanceof Error ? toolErr.message : String(toolErr);
            console.error(`[ai-copilot] tool ${tc.name} failed`, toolErr);
            toolResultBlocks.push({
              type: "tool_result",
              tool_use_id: tc.id,
              content: JSON.stringify({ error: errMsg }),
            });
          }
        }

        // ── Second turn: Claude summarises results in natural language ──
        const secondResp = await callAnthropicWithTools({
          system: SYSTEM_PROMPT,
          messages: [
            { role: "user", content: userContent },
            { role: "assistant", content: assistantBlocks },
            { role: "user", content: toolResultBlocks },
          ],
          maxTokens: 800,
        });

        const summaryText =
          (
            secondResp.content.find((b) => b.type === "text")?.text as string | undefined
          )?.trim() ??
          firstText ??
          "تم تنفيذ الإجراء.";

        answer =
          actionNotes.length > 0
            ? `${summaryText}\n\n---\n${actionNotes.join("\n")}`
            : summaryText;
      } else {
        // ── Conversational branch (no tools called) ──────────────────────
        if (firstText) {
          answer = firstText;
          usedAi = true;
        } else {
          answer = deterministicAnswer(message, snapshot);
        }
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

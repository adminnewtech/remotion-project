// Elite v1 — agent-triage: auto-classify tickets + draft replies
// Called by DB webhook on tickets insert.
// POST {ticket_id}

import { serve } from "https://deno.land/std/http/server.ts";
import { handlePreflight, json, jsonError } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { runAgentLoop, type AgentTool } from "../_shared/agent.ts";

const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `أنت وكيل تصنيف تذاكر الدعم لنيوتك الكويت.
مهمتك:
1. صنّف التذكرة: warranty | return | complaint | general
2. حدد الأولوية: high (شكاوى، أجهزة معطلة) | medium | low
3. اقترح رد مسودة بالعربية (مهذب، مختصر)
4. لا ترسل ردوداً — فقط أنشئ مسودة (is_draft=true)`;

serve(async (req: Request): Promise<Response> => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  let body: { ticket_id: string };
  try { body = await req.json(); } catch { return jsonError("Invalid JSON", 400); }
  if (!body.ticket_id) return jsonError("ticket_id required", 400);

  const admin = getAdminClient();

  // Check kill switch (reads app_settings.ai.triage_agent — false = disabled)
  const { data: settings } = await admin.from("app_settings").select("ai").single();
  const aiKill = (settings?.ai as Record<string, boolean> | null) ?? {};
  if (aiKill.triage_agent === false) {
    return json({ ok: false, reason: "triage agent disabled" });
  }

  const sessionId = crypto.randomUUID();

  const tools: AgentTool[] = [
    {
      name: "get_ticket_thread",
      description: "احصل على رسائل التذكرة ومعلومات العميل.",
      risk: "read",
      input_schema: { type: "object", properties: { ticket_id: { type: "string" } }, required: ["ticket_id"] },
      execute: async (input: unknown) => {
        const { ticket_id } = input as { ticket_id: string };
        const { data } = await admin
          .from("tickets")
          .select(`id, kind, status, customer_phone,
                   ticket_messages(sender_role, body, created_at)`)
          .eq("id", ticket_id)
          .single();
        return data ?? { error: "not found" };
      },
    },
    {
      name: "lookup_warranty",
      description: "ابحث عن ضمان بالسيريال أو رقم الطلب.",
      risk: "read",
      input_schema: {
        type: "object",
        properties: { serial: { type: "string" }, order_id: { type: "string" } },
      },
      execute: async (input: unknown) => {
        try {
          const { serial, order_id } = input as { serial?: string; order_id?: string };
          if (serial) {
            const { data } = await admin
              .from("warranties")
              .select(`id, status, starts_at, expires_at, serial_id,
                       product_serials(serial, product_variants(products(name)))`)
              .eq("product_serials.serial" as never, serial)
              .single();
            return data ?? { found: false };
          }
          if (order_id) {
            const { data } = await admin
              .from("warranties")
              .select("id, status, starts_at, expires_at")
              .eq("order_id", order_id);
            return data ?? [];
          }
          return { error: "provide serial or order_id" };
        } catch (e) {
          // warranties table may not exist yet (migration 0028)
          return { error: "warranty lookup unavailable", detail: e instanceof Error ? e.message : String(e) };
        }
      },
    },
    {
      name: "lookup_order",
      description: "ابحث عن طلب برقم الطلب أو رقم الهاتف.",
      risk: "read",
      input_schema: {
        type: "object",
        properties: { order_number: { type: "string" }, phone: { type: "string" } },
      },
      execute: async (input: unknown) => {
        const { order_number, phone } = input as { order_number?: string; phone?: string };
        let q = admin.from("orders").select("id, order_number, status, total, created_at");
        if (order_number) q = q.eq("order_number", order_number);
        if (phone) {
          const { data: profile } = await admin.from("profiles").select("id").eq("phone", phone).single();
          if (profile) q = q.eq("user_id", (profile as { id: string }).id);
        }
        const { data } = await q.limit(5);
        return data ?? [];
      },
    },
    {
      name: "set_ticket_fields",
      description: "عدّل حقول التذكرة: kind, priority, assignee_role.",
      risk: "write",
      input_schema: {
        type: "object",
        properties: {
          ticket_id: { type: "string" },
          kind: { type: "string" },
          priority: { type: "string", enum: ["low","medium","high"] },
          assignee_role: { type: "string" },
        },
        required: ["ticket_id"],
      },
      execute: async (input: unknown) => {
        const { ticket_id, kind, priority } = input as {
          ticket_id: string; kind?: string; priority?: string; assignee_role?: string;
        };
        const updates: Record<string, unknown> = {};
        if (kind) updates.kind = kind;
        if (priority) updates.meta = { priority };
        const { error } = await admin.from("tickets").update(updates as never).eq("id", ticket_id);
        return error ? { error: error.message } : { updated: true };
      },
    },
    {
      name: "draft_reply",
      description: "أنشئ مسودة رد (is_draft=true) — لا يُرسل للعميل تلقائياً.",
      risk: "write",
      input_schema: {
        type: "object",
        properties: {
          ticket_id: { type: "string" },
          body: { type: "string" },
        },
        required: ["ticket_id", "body"],
      },
      execute: async (input: unknown) => {
        const { ticket_id, body } = input as { ticket_id: string; body: string };
        const { error } = await admin.from("ticket_messages").insert({
          ticket_id, sender_role: "ops", body, is_draft: true,
        } as never);
        return error ? { error: error.message } : { draft_created: true };
      },
    },
  ];

  const { reply } = await runAgentLoop({
    agentName: "triage",
    sessionId,
    model: MODEL,
    system: SYSTEM_PROMPT,
    initialMessages: [{
      role: "user",
      content: `صنّف التذكرة ${body.ticket_id} وأنشئ مسودة رد مناسبة.`,
    }],
    tools,
    maxIterations: 5,
    maxTokens: 600,
  });

  return json({ ok: true, session_id: sessionId, summary: reply });
});

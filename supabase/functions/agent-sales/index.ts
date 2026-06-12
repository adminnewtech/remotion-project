// Elite v1 — agent-sales: WhatsApp sales agent
// Called by whatsapp-webhook for unassigned threads when ai.sales_agent=true.
// POST {phone, message, thread_history:[{direction,body,created_at}], ticket_id?}

import { serve } from "https://deno.land/std/http/server.ts";
import { handlePreflight, json, jsonError } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { runAgentLoop, type AgentTool } from "../_shared/agent.ts";

const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `أنت مساعد مبيعات لشركة نيوتك الكويت لمعدات التكييف والأجهزة الكهربائية.
تجاوب بالعربية دائماً. كن ودوداً ومختصراً ومفيداً.

قواعد صارمة:
- لا تذكر أرقاماً للخصم أبداً
- لا تعد بمواعيد توصيل خارج نطاق المناطق المعتمدة
- لا تناقش المرتجعات أو المشاكل — حول فوراً للمشرف
- عند أي طلب خصم أو شكوى: استخدم handoff_to_human فوراً`;

serve(async (req: Request): Promise<Response> => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  let body: { phone: string; message: string; thread_history?: unknown[]; ticket_id?: string; session_id?: string };
  try { body = await req.json(); } catch { return jsonError("Invalid JSON", 400); }
  if (!body.phone || !body.message) return jsonError("phone and message required", 400);

  // Check kill switch
  const admin = getAdminClient();
  const { data: settings } = await admin
    .from("app_settings")
    .select("notifications")
    .single();
  const aiSettings = (settings?.notifications as Record<string, unknown>)?.ai as Record<string, unknown> ?? {};
  if (aiSettings.sales_agent === false) {
    return json({ ok: false, reason: "agent disabled" });
  }

  const sessionId = body.session_id ?? crypto.randomUUID();

  const tools: AgentTool[] = [
    {
      name: "search_catalog",
      description: "ابحث عن منتجات بالعربية أو الإنجليزية، فئة، نطاق سعر. يُرجع أفضل 5 نتائج.",
      risk: "read",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string" },
          max_price: { type: "number" },
          category: { type: "string" },
        },
        required: ["query"],
      },
      execute: async (input: unknown) => {
        const { query, max_price, category } = input as { query: string; max_price?: number; category?: string };
        let q = admin
          .from("products")
          .select(`id, name_ar, name_en, description_ar,
                   product_variants(id, sku, price, sale_price)`)
          .or(`name_ar.ilike.%${query}%,name_en.ilike.%${query}%`)
          .limit(5);
        if (category) q = q.ilike("name_ar" as never, `%${category}%`);
        const { data } = await q;
        return (data ?? []).map((p: unknown) => {
          const prod = p as { id: string; name_ar: string; name_en: string; product_variants: { price: number; sale_price?: number }[] };
          const minPrice = Math.min(...(prod.product_variants ?? []).map((v) => v.sale_price ?? v.price ?? 999));
          return {
            id: prod.id,
            name: prod.name_ar || prod.name_en,
            min_price: minPrice,
            in_range: max_price ? minPrice <= max_price : true,
          };
        }).filter((p: { in_range: boolean }) => p.in_range);
      },
    },
    {
      name: "get_product_details",
      description: "تفاصيل المنتج: variants، ضمان، bundle (مع تركيب), رسوم التوصيل.",
      risk: "read",
      input_schema: {
        type: "object",
        properties: { product_id: { type: "string" } },
        required: ["product_id"],
      },
      execute: async (input: unknown) => {
        const { product_id } = input as { product_id: string };
        const { data } = await admin
          .from("products")
          .select(`id, name_ar, name_en, warranty_months, product_variants(id, sku, price, sale_price)`)
          .eq("id", product_id)
          .single();
        return data ?? { error: "not found" };
      },
    },
    {
      name: "create_cart_link",
      description: "أنشئ رابط سلة جاهزة وأرسله للعميل.",
      risk: "write",
      input_schema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                variant_id: { type: "string" },
                qty: { type: "integer" },
              },
              required: ["variant_id", "qty"],
            },
          },
        },
        required: ["items"],
      },
      execute: async (input: unknown, sessionId: string) => {
        const { items } = input as { items: { variant_id: string; qty: number }[] };
        const token = "ca-" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        // Insert cart without user_id by using a system placeholder or null
        // The claim_token allows anonymous cart creation for agent-generated carts
        const { data: cart } = await admin
          .from("carts")
          .insert({ claim_token: token, meta: { agent_session: sessionId } } as never)
          .select("id")
          .single();
        if (!cart) return { error: "failed to create cart" };
        await admin.from("cart_items").insert(
          items.map((i) => ({ cart_id: (cart as { id: string }).id, variant_id: i.variant_id, qty: i.qty }))
        );
        const storeUrl = Deno.env.get("STORE_URL") ?? "https://remotion-project-6dvr.vercel.app";
        return { url: `${storeUrl}/ar/cart/claim/${token}`, cart_id: (cart as { id: string }).id };
      },
    },
    {
      name: "get_customer_context",
      description: "نقاط الولاء، الدرجة، الطلبات المفتوحة لهذا الهاتف.",
      risk: "read",
      input_schema: { type: "object", properties: {}, required: [] },
      execute: async (_input: unknown) => {
        const { data } = await admin
          .from("profiles")
          .select("loyalty_points, orders(id, status, total)")
          .eq("phone", body.phone)
          .single();
        if (!data) return { tier: "new", loyalty_points: 0, open_orders: 0 };
        const orders = (data.orders as { status: string; total: number }[]) ?? [];
        return {
          loyalty_points: (data as { loyalty_points?: number }).loyalty_points ?? 0,
          open_orders: orders.filter((o) => !["completed","cancelled"].includes(o.status)).length,
        };
      },
    },
    {
      name: "handoff_to_human",
      description: "أحل المحادثة لمشرف بشري عند الشكاوى، طلبات الخصم، أو المرتجعات.",
      risk: "write",
      input_schema: {
        type: "object",
        properties: { reason: { type: "string" } },
        required: ["reason"],
      },
      execute: async (input: unknown) => {
        const { reason } = input as { reason: string };
        if (body.ticket_id) {
          await admin.from("tickets").update({
            assignee_id: null, meta: { ai_handoff_reason: reason }
          } as never).eq("id", body.ticket_id);
        }
        return { handoff: true, reason };
      },
    },
  ];

  // Build messages from thread history
  const messages = [
    {
      role: "user" as const,
      content: body.message,
    },
  ];

  const { reply } = await runAgentLoop({
    agentName: "sales",
    sessionId,
    model: MODEL,
    system: SYSTEM_PROMPT,
    initialMessages: messages,
    tools,
    maxIterations: 4,
    maxTokens: 800,
  });

  // Send reply via WhatsApp
  const fnBase = Deno.env.get("SUPABASE_URL") + "/functions/v1";
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  await fetch(`${fnBase}/whatsapp-send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${svcKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ phone: body.phone, body: reply, ticket_id: body.ticket_id }),
  });

  return json({ ok: true, reply, session_id: sessionId });
});

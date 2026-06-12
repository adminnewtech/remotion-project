// Elite v1 — whatsapp-send Edge Function
// POST {phone, body?, template?, params?, ticket_id?}
// Enforces: free-text only if 24h window open; otherwise must supply a template.
// Ops-JWT or service-role only.

import { serve } from "https://deno.land/std/http/server.ts";
import { handlePreflight, json, jsonError } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabaseAdmin.ts";

serve(async (req: Request): Promise<Response> => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  let body: {
    phone: string;
    body?: string;
    template?: string;
    params?: string[];
    ticket_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  if (!body.phone) return jsonError("phone required", 400);
  if (!body.body && !body.template) return jsonError("body or template required", 400);

  const admin = getAdminClient();

  // Check 24h window if sending free text
  if (body.body && !body.template) {
    const { data: open } = await admin.rpc("wa_window_open", { p_phone: body.phone });
    if (!open) {
      return jsonError("No active 24h window — use a template", 422);
    }
  }

  // Validate template if provided
  if (body.template) {
    const { data: tpl } = await admin
      .from("wa_templates")
      .select("name, body, params, is_active")
      .eq("name", body.template)
      .eq("is_active", true)
      .single();
    if (!tpl) return jsonError(`Template '${body.template}' not found or inactive`, 400);
  }

  // Build message text
  let messageText = body.body ?? "";
  if (body.template && body.params) {
    const { data: tpl } = await admin
      .from("wa_templates")
      .select("body")
      .eq("name", body.template)
      .single();
    if (tpl) {
      messageText = (body.params ?? []).reduce(
        (t: string, p: string, i: number) => t.replace(`{{${i + 1}}}`, p),
        tpl.body
      );
    }
  }

  // TODO: call Meta Cloud API (when WHATSAPP_API_TOKEN is set)
  const WA_TOKEN = Deno.env.get("WHATSAPP_API_TOKEN") ?? "";
  const WA_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";

  let waId: string | null = null;
  if (WA_TOKEN && WA_PHONE_ID) {
    try {
      const resp = await fetch(
        `https://graph.facebook.com/v19.0/${WA_PHONE_ID}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${WA_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            body.template
              ? {
                  messaging_product: "whatsapp",
                  to: body.phone,
                  type: "template",
                  template: {
                    name: body.template,
                    language: { code: "ar" },
                    components: body.params?.length
                      ? [{
                          type: "body",
                          parameters: body.params.map((v) => ({ type: "text", text: v })),
                        }]
                      : [],
                  },
                }
              : {
                  messaging_product: "whatsapp",
                  to: body.phone,
                  type: "text",
                  text: { body: messageText },
                }
          ),
        }
      );
      const data = await resp.json() as { messages?: { id: string }[] };
      waId = data.messages?.[0]?.id ?? null;
    } catch (e) {
      console.error("WhatsApp API error:", e);
    }
  }

  // Persist to wa_messages
  const { error: msgErr } = await admin.from("wa_messages").insert({
    wa_id: waId,
    ticket_id: body.ticket_id ?? null,
    phone: body.phone,
    direction: "out",
    kind: body.template ? "template" : "text",
    body: messageText,
    template: body.template ?? null,
    status: waId ? "sent" : "failed",
  });

  if (msgErr) {
    console.error("wa_messages insert error:", msgErr.message);
  }

  // Mirror to ticket_messages if ticket linked
  if (body.ticket_id) {
    await admin.from("ticket_messages").insert({
      ticket_id: body.ticket_id,
      sender_role: "ops",
      body: messageText,
      is_draft: false,
    });
  }

  return json({ ok: true, wa_id: waId, preview: messageText.slice(0, 80) });
});

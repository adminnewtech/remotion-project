// NewTech OS — chatwoot-webhook Edge Function (Deno + TypeScript).
//
// Receives Chatwoot webhook events (message_created, conversation_created, …)
// and maps each Chatwoot conversation → a NewTech ticket (channel 'chatwoot',
// external_id = conversation id), inserting messages with direction.
//
// Chatwoot message payload (message_created):
//   {
//     event: 'message_created',
//     id, content, message_type: 'incoming' | 'outgoing',
//     conversation: { id, meta: { sender: { name, phone_number, email } } },
//     sender: { name, ... }, source_id, ...
//   }
//
// Secret check: a shared token is sent in the `X-Chatwoot-Token` header and
// compared against env CHATWOOT_WEBHOOK_TOKEN. Unknown events → safe no-op 200.
//
// Env:
//   CHATWOOT_WEBHOOK_TOKEN   shared secret expected in X-Chatwoot-Token header

import { serve } from "https://deno.land/std/http/server.ts";
import { handlePreflight, json, jsonError } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabaseAdmin.ts";

const WEBHOOK_TOKEN = Deno.env.get("CHATWOOT_WEBHOOK_TOKEN") ?? "";

serve(async (req: Request): Promise<Response> => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405);
  }

  // Secret check (only enforced when a token is configured).
  if (WEBHOOK_TOKEN) {
    const got =
      req.headers.get("x-chatwoot-token") ??
      req.headers.get("X-Chatwoot-Token") ??
      "";
    if (got !== WEBHOOK_TOKEN) {
      return jsonError("Invalid webhook token", 401);
    }
  }

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const event = String(body?.event ?? "");

  // Only message events drive the inbox. Everything else → safe no-op 200.
  if (event !== "message_created" && event !== "message_updated") {
    return json({ ok: true, ignored: event || "unknown" });
  }

  const conversation = body?.conversation ?? {};
  const conversationId = String(
    conversation?.id ?? body?.conversation_id ?? "",
  );
  const content = String(body?.content ?? "").trim();
  // 'incoming' = from the customer → inbound; 'outgoing' = agent → outbound.
  const messageType = String(body?.message_type ?? "incoming");
  const direction = messageType === "outgoing" ? "outbound" : "inbound";

  if (!conversationId || !content) {
    return json({ ok: true, ignored: "no_conversation_or_content" });
  }

  const sender = conversation?.meta?.sender ?? body?.sender ?? {};
  const senderName = String(sender?.name ?? "");
  const senderPhone = String(sender?.phone_number ?? "");

  const admin = getAdminClient();

  try {
    const ticket = await findOrCreateTicket(
      admin,
      conversationId,
      senderName,
      senderPhone,
    );

    // Idempotency: skip if we've already stored this Chatwoot message id.
    const externalId = body?.id != null ? String(body.id) : null;
    if (externalId) {
      const { data: dup } = await admin
        .from("ticket_messages")
        .select("id")
        .eq("ticket_id", ticket.id)
        .eq("external_id", externalId)
        .maybeSingle();
      if (dup) return json({ ok: true, deduped: true });
    }

    await admin.from("ticket_messages").insert({
      ticket_id: ticket.id,
      sender_id: null,
      body: content,
      direction,
      external_id: externalId,
    });
    await admin
      .from("tickets")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", ticket.id);

    if (direction === "inbound" && ticket.user_id) {
      await admin
        .rpc("enqueue_notification", {
          p_user_id: ticket.user_id,
          p_kind: "support_message",
          p_title_ar: "رسالة دعم جديدة",
          p_title_en: "New support message",
          p_body_ar: content.slice(0, 140),
          p_body_en: content.slice(0, 140),
          p_data: { ticket_id: ticket.id, channel: "chatwoot" },
        })
        .then(undefined, (e: unknown) => console.error("[chatwoot] enqueue", e));
    }

    return json({ ok: true, ticket_id: ticket.id, direction });
  } catch (err) {
    console.error("[chatwoot-webhook] error", err);
    return jsonError("Webhook processing failed", 500, {
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

interface TicketRow {
  id: string;
  user_id: string | null;
}

async function findOrCreateTicket(
  admin: ReturnType<typeof getAdminClient>,
  conversationId: string,
  senderName: string,
  senderPhone: string,
): Promise<TicketRow> {
  const { data: existing } = await admin
    .from("tickets")
    .select("id, user_id")
    .eq("channel", "chatwoot")
    .eq("external_id", conversationId)
    .neq("status", "closed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return existing as TicketRow;

  // Try to bind a known customer by phone.
  let userId: string | null = null;
  if (senderPhone) {
    const last8 = senderPhone.replace(/[^\d]/g, "").slice(-8);
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .or(`phone.eq.${senderPhone},phone.like.%${last8}`)
      .limit(1)
      .maybeSingle();
    userId = profile?.id ?? null;
  }

  const subject = senderName
    ? `Chatwoot · ${senderName}`
    : `Chatwoot · #${conversationId}`;

  const { data: created, error } = await admin
    .from("tickets")
    .insert({
      channel: "chatwoot",
      external_id: conversationId,
      customer_phone: senderPhone || null,
      user_id: userId,
      kind: "general",
      status: "open",
      subject,
    })
    .select("id, user_id")
    .single();
  if (error) throw error;
  return created as TicketRow;
}

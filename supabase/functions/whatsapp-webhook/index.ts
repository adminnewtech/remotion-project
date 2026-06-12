// NewTech OS — whatsapp-webhook Edge Function (Deno + TypeScript).
//
// Implements the WhatsApp Cloud API (Meta Graph) webhook + an ops send action.
//
//   GET  ?hub.mode=subscribe&hub.verify_token=<X>&hub.challenge=<C>
//        → verifies hub.verify_token == WHATSAPP_VERIFY_TOKEN, echoes challenge.
//
//   POST (webhook event)
//        → extract wa_id + profile name + text from the messages payload
//        → find-or-create ticket (channel 'whatsapp', external_id = wa_id),
//          try to bind profiles.phone → user_id and their latest order
//        → insert the inbound ticket_message
//        → notify ops via enqueue_notification (service-role rpc)
//        → if WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID set, send an
//          auto-ack text reply via Graph API.
//
//   POST { action: 'send', ticket_id, body }
//        → ops outbound: verify is_ops JWT, send free-form text via Graph API,
//          record an outbound ticket_message.
//
// Env:
//   WHATSAPP_VERIFY_TOKEN      webhook verification token (GET)
//   WHATSAPP_ACCESS_TOKEN      permanent / system-user token (send)
//   WHATSAPP_PHONE_NUMBER_ID   Cloud API phone-number id (sender)
//   WHATSAPP_API_VERSION       optional, default v19.0
//
// Safe in sandbox: when send creds are unset, replies are skipped (logged), the
// webhook still records the inbound message and returns 200.

import { serve } from "https://deno.land/std/http/server.ts";
import { handlePreflight, json, jsonError } from "../_shared/cors.ts";
import { getAdminClient, getUserFromRequest, AuthError } from "../_shared/supabaseAdmin.ts";

const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "";
const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
const ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") ?? "";
const API_VERSION = Deno.env.get("WHATSAPP_API_VERSION") ?? "v19.0";
const sendConfigured = Boolean(PHONE_NUMBER_ID && ACCESS_TOKEN);

interface SendTextResult {
  sent: boolean;
  id?: string;
  skipped?: string;
}

/** Send a free-form WhatsApp text message (within the 24h service window). */
async function sendText(to: string, body: string): Promise<SendTextResult> {
  if (!sendConfigured) {
    console.log(`[wa-webhook] (send stub) → to=${to} body="${body}"`);
    return { sent: false, skipped: "unconfigured" };
  }
  try {
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body, preview_url: false },
        }),
      },
    );
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[wa-webhook] send HTTP", res.status, j?.error?.message ?? "");
      return { sent: false, skipped: `http_${res.status}` };
    }
    return { sent: true, id: j?.messages?.[0]?.id };
  } catch (e) {
    console.error("[wa-webhook] send error", e);
    return { sent: false, skipped: "error" };
  }
}

/** Normalize a phone to WhatsApp E.164 (no '+'); KW 8-digit → 965 prefix. */
function normalizePhone(raw: string): string {
  const digits = (raw ?? "").replace(/[^\d]/g, "");
  if (digits.length === 8) return `965${digits}`;
  return digits;
}

serve(async (req: Request): Promise<Response> => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  // ── GET: webhook verification ──────────────────────────────────────────────
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && token === VERIFY_TOKEN) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const admin = getAdminClient();

  // ── POST action=send: ops outbound reply ──────────────────────────────────
  if (body?.action === "send") {
    let user;
    try {
      user = await getUserFromRequest(req);
    } catch (e) {
      if (e instanceof AuthError) return jsonError(e.message, 401);
      throw e;
    }
    if (!(user.role === "employee" || user.role === "admin")) {
      return jsonError("Forbidden: ops only", 403);
    }
    const ticketId = String(body.ticket_id ?? "");
    const text = String(body.body ?? "").trim();
    if (!ticketId || !text) return jsonError("ticket_id and body are required", 400);

    const { data: ticket, error: tErr } = await admin
      .from("tickets")
      .select("id, channel, external_id, customer_phone")
      .eq("id", ticketId)
      .maybeSingle();
    if (tErr) return jsonError("Ticket lookup failed", 500, { detail: tErr.message });
    if (!ticket) return jsonError("Ticket not found", 404);
    if (ticket.channel !== "whatsapp") {
      return jsonError("Ticket is not a WhatsApp conversation", 400);
    }

    const to = normalizePhone(String(ticket.external_id ?? ticket.customer_phone ?? ""));
    if (!to) return jsonError("Ticket has no WhatsApp recipient", 400);

    const result = await sendText(to, text);

    // Record the outbound message regardless (durable thread record).
    const { data: msg, error: mErr } = await admin
      .from("ticket_messages")
      .insert({
        ticket_id: ticketId,
        sender_id: user.id,
        body: text,
        direction: "outbound",
        external_id: result.id ?? null,
      })
      .select("*")
      .single();
    if (mErr) return jsonError("Failed to record message", 500, { detail: mErr.message });

    await admin.from("tickets").update({ updated_at: new Date().toISOString() }).eq("id", ticketId);

    return json({ ok: true, message: msg, send: result }, 201);
  }

  // ── POST: WhatsApp webhook event ───────────────────────────────────────────
  try {
    const entries = (body?.entry as any[]) ?? [];
    let processed = 0;

    for (const entry of entries) {
      for (const change of (entry?.changes as any[]) ?? []) {
        const value = change?.value ?? {};
        const contacts: any[] = value?.contacts ?? [];
        const messages: any[] = value?.messages ?? [];
        if (messages.length === 0) continue; // statuses / read receipts → no-op

        const contact = contacts[0] ?? {};
        const waId: string = contact?.wa_id ?? messages[0]?.from ?? "";
        const profileName: string = contact?.profile?.name ?? "";
        if (!waId) continue;

        for (const m of messages) {
          const text = extractText(m);
          if (!text) continue;

          const ticket = await findOrCreateTicket(admin, waId, profileName, text);

          await admin.from("ticket_messages").insert({
            ticket_id: ticket.id,
            sender_id: null,
            body: text,
            direction: "inbound",
            external_id: m?.id ?? null,
          });
          await admin
            .from("tickets")
            .update({ updated_at: new Date().toISOString(), status: "open" })
            .eq("id", ticket.id);

          // Notify ops (service-role rpc). Bound to the ticket owner if known,
          // otherwise to each ops user is out of scope — we enqueue for the
          // ticket's user_id when present (their own thread surfaces it).
          if (ticket.user_id) {
            await admin.rpc("enqueue_notification", {
              p_user_id: ticket.user_id,
              p_kind: "support_message",
              p_title_ar: "رسالة دعم جديدة (واتساب)",
              p_title_en: "New support message (WhatsApp)",
              p_body_ar: text.slice(0, 140),
              p_body_en: text.slice(0, 140),
              p_data: { ticket_id: ticket.id, channel: "whatsapp" },
            }).then(undefined, (e: unknown) => console.error("[wa-webhook] enqueue", e));
          }

          // Auto-ack reply (best-effort).
          await sendText(
            normalizePhone(waId),
            "شكراً لتواصلك مع نيوتك. تم استلام رسالتك وسيتواصل معك فريق الدعم قريباً.\nThank you for contacting Newtech. We received your message and our support team will reply shortly.",
          );

          processed++;
        }
      }
    }

    return json({ ok: true, processed });
  } catch (err) {
    console.error("[wa-webhook] error", err);
    // Always 200-class to avoid Meta retry storms on our own bugs? No — surface
    // real failures so they're observable, but Meta only retries on >=500.
    return jsonError("Webhook processing failed", 500, {
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

/** Extract a plain-text body from a WhatsApp inbound message of any type. */
function extractText(m: any): string {
  if (m?.type === "text") return String(m?.text?.body ?? "").trim();
  if (m?.type === "button") return String(m?.button?.text ?? "").trim();
  if (m?.type === "interactive") {
    return String(
      m?.interactive?.button_reply?.title ??
        m?.interactive?.list_reply?.title ??
        "",
    ).trim();
  }
  // Media: record a placeholder so the thread reflects the inbound event.
  if (m?.type) return `[${m.type}]`;
  return "";
}

interface TicketRow {
  id: string;
  user_id: string | null;
  order_id: string | null;
}

/**
 * Find an open WhatsApp ticket for this wa_id, or create one. On create, try to
 * bind a known customer (profiles.phone) and their latest order.
 */
async function findOrCreateTicket(
  admin: ReturnType<typeof getAdminClient>,
  waId: string,
  profileName: string,
  firstText: string,
): Promise<TicketRow> {
  // Reuse the most recent non-closed ticket for continuity.
  const { data: existing } = await admin
    .from("tickets")
    .select("id, user_id, order_id")
    .eq("channel", "whatsapp")
    .eq("external_id", waId)
    .neq("status", "closed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return existing as TicketRow;

  // Try to bind a known customer by phone (match last 8 digits as well).
  const last8 = waId.slice(-8);
  let userId: string | null = null;
  let orderId: string | null = null;
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .or(`phone.eq.${waId},phone.eq.+${waId},phone.like.%${last8}`)
    .limit(1)
    .maybeSingle();
  if (profile?.id) {
    userId = profile.id;
    const { data: order } = await admin
      .from("orders")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    orderId = order?.id ?? null;
  }

  const subject = profileName
    ? `WhatsApp · ${profileName}`
    : `WhatsApp · ${waId}`;

  const { data: created, error } = await admin
    .from("tickets")
    .insert({
      channel: "whatsapp",
      external_id: waId,
      customer_phone: waId,
      user_id: userId,
      order_id: orderId,
      kind: "general",
      status: "open",
      subject,
    })
    .select("id, user_id, order_id")
    .single();
  if (error) throw error;
  return created as TicketRow;
}

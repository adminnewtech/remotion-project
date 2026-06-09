// Elite v1 — payment-webhook Edge Function.
// Deno + TypeScript (Supabase Edge Functions).
//
// Flow (see ARCHITECTURE.md 3.3 Checkout & 3.4 Fulfillment):
//   gateway POSTs a payment result
//   → verify signature (PAYMENT_WEBHOOK_SECRET — TODO: real per-gateway scheme)
//   → resolve order + payment
//   → on SUCCESS: payment.status='paid', order.status='paid',
//                 invoke `dispatch` (create fulfillment tasks),
//                 trigger `notify` (order paid)
//   → on FAILURE: payment.status='failed', order.status='cancelled',
//                 release reserved stock for each order line
//
// This webhook is unauthenticated (no caller JWT) — trust is established by
// the signature check, NOT by a Supabase session. All writes use the service
// role. Money is KWD with 3 decimals.

import { serve } from "https://deno.land/std/http/server.ts";
import { handlePreflight, json, jsonError } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabaseAdmin.ts";

const WEBHOOK_SECRET = Deno.env.get("PAYMENT_WEBHOOK_SECRET") ?? "";
const FUNCTIONS_BASE_URL =
  Deno.env.get("SUPABASE_FUNCTIONS_URL") ??
  (Deno.env.get("SUPABASE_URL") ? `${Deno.env.get("SUPABASE_URL")}/functions/v1` : "");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Normalized webhook payload. Real gateways (MyFatoorah / Tap) wrap this in
// their own envelope — map their fields to this shape in `normalizePayload`.
interface WebhookPayload {
  // One of order_id / order_number / payment_id must resolve a payment row.
  order_id?: string;
  order_number?: string;
  payment_id?: string;
  gateway_ref?: string;
  // 'paid' | 'failed' (also accepts authorized → treated as paid here).
  status: "paid" | "authorized" | "failed" | "cancelled" | string;
  raw?: Record<string, unknown>;
}

serve(async (req: Request): Promise<Response> => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405);
  }

  // Read the raw body once — needed for signature verification.
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return jsonError("Unable to read body", 400);
  }

  // ── Verify signature ────────────────────────────────────────────────────
  // TODO(payments): replace with the real per-gateway verification.
  //   MyFatoorah: HMAC-SHA256 over a sorted field string, header 'Authorization'.
  //   Tap: HMAC-SHA256 over a canonical string, header 'tap-signature'.
  // Safe fallback: compare an HMAC of the raw body to the 'x-signature' header
  // using PAYMENT_WEBHOOK_SECRET. If no secret is configured (sandbox), skip.
  const signature =
    req.headers.get("x-signature") ??
    req.headers.get("tap-signature") ??
    req.headers.get("authorization") ??
    "";
  const verified = await verifySignature(rawBody, signature);
  if (!verified) {
    return jsonError("Invalid signature", 401);
  }

  let payload: WebhookPayload;
  try {
    payload = normalizePayload(JSON.parse(rawBody));
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  if (!payload.status) {
    return jsonError("Missing payment status", 400);
  }
  if (!payload.order_id && !payload.order_number && !payload.payment_id) {
    return jsonError("Missing order_id, order_number or payment_id", 400);
  }

  const admin = getAdminClient();

  try {
    // ── Resolve the payment + its order ──────────────────────────────────
    let paymentQuery = admin
      .from("payments")
      .select("id, order_id, status, amount, orders:order_id ( id, order_number, user_id, status )");

    if (payload.payment_id) {
      paymentQuery = paymentQuery.eq("id", payload.payment_id);
    } else if (payload.order_id) {
      paymentQuery = paymentQuery.eq("order_id", payload.order_id);
    } else {
      // Resolve order by order_number first.
      const { data: ord, error: ordErr } = await admin
        .from("orders")
        .select("id")
        .eq("order_number", payload.order_number!)
        .maybeSingle();
      if (ordErr) throw ordErr;
      if (!ord) return jsonError("Order not found", 404);
      paymentQuery = paymentQuery.eq("order_id", ord.id);
    }

    const { data: payment, error: payErr } = await paymentQuery
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (payErr) throw payErr;
    if (!payment) return jsonError("Payment not found", 404);

    const order = (payment as any).orders;
    if (!order) return jsonError("Order not found for payment", 404);

    // ── Idempotency: don't reprocess a settled payment ───────────────────
    if (payment.status === "paid" || payment.status === "refunded") {
      return json({ ok: true, idempotent: true, order_id: order.id, payment_status: payment.status });
    }

    const isSuccess = payload.status === "paid" || payload.status === "authorized";

    if (isSuccess) {
      // ── Mark payment + order paid ──────────────────────────────────────
      await admin
        .from("payments")
        .update({
          status: "paid",
          gateway_ref: payload.gateway_ref ?? null,
          raw: payload.raw ?? null,
        })
        .eq("id", payment.id);

      await admin
        .from("orders")
        .update({ status: "paid" })
        .eq("id", order.id);

      // ── Invoke dispatch (create fulfillment tasks) ─────────────────────
      // Best-effort: a failure here must not 500 the webhook (gateway would
      // retry and we'd double-process). Log and continue.
      await invokeFunction("dispatch", { order_id: order.id }).catch((e) =>
        console.error("[payment-webhook] dispatch invoke failed", e)
      );

      // ── Trigger notification ───────────────────────────────────────────
      await invokeFunction("notify", {
        user_id: order.user_id,
        kind: "order_paid",
        title_ar: "تم تأكيد الدفع",
        title_en: "Payment confirmed",
        body_ar: `تم استلام دفعة طلبك ${order.order_number} بنجاح.`,
        body_en: `We received payment for your order ${order.order_number}.`,
        data: { order_id: order.id, order_number: order.order_number },
      }).catch((e) => console.error("[payment-webhook] notify invoke failed", e));

      return json({ ok: true, order_id: order.id, status: "paid" });
    }

    // ── FAILURE: mark failed + release reserved stock ────────────────────
    await admin
      .from("payments")
      .update({
        status: "failed",
        gateway_ref: payload.gateway_ref ?? null,
        raw: payload.raw ?? null,
      })
      .eq("id", payment.id);

    await admin.from("orders").update({ status: "cancelled" }).eq("id", order.id);

    // Release the stock reserved at checkout for each line.
    const { data: lines, error: linesErr } = await admin
      .from("order_items")
      .select("variant_id, qty")
      .eq("order_id", order.id);
    if (linesErr) throw linesErr;

    for (const line of lines ?? []) {
      if (!line.variant_id) continue;
      await admin
        .rpc("release_variant_stock", { p_variant_id: line.variant_id, p_qty: line.qty })
        .then(({ error }) => {
          if (error) console.error("[payment-webhook] release failed", line.variant_id, error);
        });
    }

    // Notify the customer of failure (best-effort).
    await invokeFunction("notify", {
      user_id: order.user_id,
      kind: "payment_failed",
      title_ar: "فشل الدفع",
      title_en: "Payment failed",
      body_ar: `لم تكتمل عملية الدفع للطلب ${order.order_number}. الرجاء المحاولة مرة أخرى.`,
      body_en: `Payment for order ${order.order_number} did not complete. Please try again.`,
      data: { order_id: order.id, order_number: order.order_number },
    }).catch((e) => console.error("[payment-webhook] notify invoke failed", e));

    return json({ ok: true, order_id: order.id, status: "failed" });
  } catch (err) {
    console.error("[payment-webhook] error", err);
    return jsonError("Webhook processing failed", 500, {
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

/**
 * Map a raw gateway envelope to our normalized WebhookPayload.
 * TODO(payments): expand per gateway (MyFatoorah InvoiceId/InvoiceStatus,
 * Tap charge.id/status). For now accept our normalized shape plus a couple of
 * common aliases.
 */
function normalizePayload(input: any): WebhookPayload {
  const status = String(
    input.status ?? input.InvoiceStatus ?? input.payment_status ?? "",
  ).toLowerCase();
  const normalizedStatus =
    status === "success" || status === "captured" || status === "paid"
      ? "paid"
      : status === "authorized"
      ? "authorized"
      : status === "failed" || status === "declined" || status === "cancelled"
      ? "failed"
      : status;

  return {
    order_id: input.order_id ?? undefined,
    order_number: input.order_number ?? undefined,
    payment_id: input.payment_id ?? undefined,
    gateway_ref:
      input.gateway_ref ?? input.InvoiceId?.toString() ?? input.id ?? input.charge_id ?? undefined,
    status: normalizedStatus,
    raw: input,
  };
}

/**
 * Verify the webhook signature.
 * TODO(payments): swap for the exact gateway algorithm/header. Current scheme:
 * HMAC-SHA256(rawBody, PAYMENT_WEBHOOK_SECRET) compared (constant-time) to the
 * hex signature header. If no secret is configured we are in sandbox → allow.
 */
async function verifySignature(rawBody: string, signature: string): Promise<boolean> {
  if (!WEBHOOK_SECRET) {
    console.warn("[payment-webhook] PAYMENT_WEBHOOK_SECRET unset — skipping verification (sandbox)");
    return true;
  }
  if (!signature) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");

  // Strip common prefixes (e.g. "sha256=", "Bearer ").
  const provided = signature.replace(/^sha256=/i, "").replace(/^bearer\s+/i, "").trim();
  return timingSafeEqual(expected, provided.toLowerCase());
}

/** Constant-time string comparison to avoid signature timing leaks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Invoke a sibling Edge Function with the service role key. */
async function invokeFunction(name: string, body: unknown): Promise<void> {
  if (!FUNCTIONS_BASE_URL) {
    console.warn(`[payment-webhook] FUNCTIONS base URL unset — cannot invoke ${name}`);
    return;
  }
  const res = await fetch(`${FUNCTIONS_BASE_URL}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${name} returned ${res.status}: ${text}`);
  }
}

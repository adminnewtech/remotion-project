// Elite v1 — notify Edge Function.
// Deno + TypeScript (Supabase Edge Functions).
//
// Input: { user_id, kind, title_ar?, title_en?, body_ar?, body_en?, data?, email? }
//
// Flow (see ARCHITECTURE.md 3.7 Notifications):
//   → insert an in-app `notifications` row (system of record for the bell feed)
//   → send Expo push to each of the user's push_tokens
//   → send transactional email via Gmail (stub / adapter)
//
// Privileged (service role): invoked by other Edge Functions (payment-webhook,
// dispatch) and DB-event triggers. No end-user identity binding. Channel
// failures are non-fatal — the in-app notification is the durable record and a
// push/email outage must not fail the caller.

import { serve } from "https://deno.land/std/http/server.ts";
import { handlePreflight, json, jsonError } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabaseAdmin.ts";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_ACCESS_TOKEN = Deno.env.get("EXPO_ACCESS_TOKEN") ?? "";

interface NotifyRequest {
  user_id: string;
  kind: string;
  title_ar?: string;
  title_en?: string;
  body_ar?: string;
  body_en?: string;
  data?: Record<string, unknown>;
  // Override recipient email; otherwise resolved from the profile.
  email?: string;
  // Channel toggles (default: all on).
  channels?: { push?: boolean; email?: boolean; inApp?: boolean };
}

interface ChannelResult {
  in_app: boolean;
  push: { sent: number; failed: number; skipped?: string };
  email: { sent: boolean; skipped?: string };
}

serve(async (req: Request): Promise<Response> => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405);
  }

  let body: NotifyRequest;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }
  if (!body?.user_id || !body?.kind) {
    return jsonError("user_id and kind are required", 400);
  }

  const channels = {
    inApp: body.channels?.inApp !== false,
    push: body.channels?.push !== false,
    email: body.channels?.email !== false,
  };

  const admin = getAdminClient();
  const result: ChannelResult = {
    in_app: false,
    push: { sent: 0, failed: 0 },
    email: { sent: false },
  };

  try {
    // Resolve the recipient's locale + email for channel content.
    const { data: profile } = await admin
      .from("profiles")
      .select("email, locale")
      .eq("id", body.user_id)
      .maybeSingle();

    const locale = (profile?.locale === "en" ? "en" : "ar") as "ar" | "en";
    const title = pick(locale, body.title_en, body.title_ar) ?? body.kind;
    const messageBody = pick(locale, body.body_en, body.body_ar) ?? "";

    // ── 1. In-app notification (durable record) ──────────────────────────
    let notificationId: string | null = null;
    if (channels.inApp) {
      const { data: notif, error: notifErr } = await admin
        .from("notifications")
        .insert({
          user_id: body.user_id,
          kind: body.kind,
          title_ar: body.title_ar ?? null,
          title_en: body.title_en ?? null,
          body_ar: body.body_ar ?? null,
          body_en: body.body_en ?? null,
          data: body.data ?? {},
        })
        .select("id")
        .single();
      if (notifErr) throw notifErr; // in-app is the contract — fail loudly.
      notificationId = notif.id;
      result.in_app = true;
    }

    // ── 2. Expo push to all of the user's device tokens ──────────────────
    if (channels.push) {
      const { data: tokens, error: tokErr } = await admin
        .from("push_tokens")
        .select("expo_token")
        .eq("user_id", body.user_id);
      if (tokErr) {
        console.error("[notify] failed to load push tokens", tokErr);
      }

      const expoTokens = (tokens ?? [])
        .map((t) => t.expo_token)
        .filter((t): t is string => typeof t === "string" && t.startsWith("ExponentPushToken"));

      if (expoTokens.length === 0) {
        result.push.skipped = "no_tokens";
      } else {
        const messages = expoTokens.map((to) => ({
          to,
          title,
          body: messageBody,
          sound: "default",
          data: { kind: body.kind, ...(body.data ?? {}) },
        }));
        try {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            Accept: "application/json",
          };
          // TODO(push): set EXPO_ACCESS_TOKEN to use Expo's enhanced security.
          if (EXPO_ACCESS_TOKEN) headers["Authorization"] = `Bearer ${EXPO_ACCESS_TOKEN}`;

          const res = await fetch(EXPO_PUSH_URL, {
            method: "POST",
            headers,
            body: JSON.stringify(messages),
          });
          if (res.ok) {
            // Expo returns a ticket per message; count ok vs error.
            const payload = await res.json().catch(() => null);
            const tickets: any[] = payload?.data ?? [];
            const ok = tickets.filter((t) => t?.status === "ok").length;
            result.push.sent = ok || expoTokens.length;
            result.push.failed = expoTokens.length - (ok || expoTokens.length);
          } else {
            console.error("[notify] expo push HTTP", res.status, await res.text().catch(() => ""));
            result.push.failed = expoTokens.length;
          }
        } catch (e) {
          console.error("[notify] expo push error", e);
          result.push.failed = expoTokens.length;
        }
      }
    }

    // ── 3. Email via Gmail (stub adapter) ────────────────────────────────
    if (channels.email) {
      const to = body.email ?? profile?.email ?? null;
      if (!to) {
        result.email.skipped = "no_email";
      } else {
        result.email.sent = await sendEmailViaGmail(to, title, messageBody);
        if (!result.email.sent) result.email.skipped = "stub_or_unconfigured";
      }
    }

    return json({ ok: true, notification_id: notificationId, channels: result }, 201);
  } catch (err) {
    console.error("[notify] error", err);
    return jsonError("Notify failed", 500, {
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

/** Locale-aware content picker with a fallback to the other language. */
function pick(locale: "ar" | "en", en?: string, ar?: string): string | undefined {
  if (locale === "en") return en ?? ar ?? undefined;
  return ar ?? en ?? undefined;
}

/**
 * Send a transactional email via Gmail.
 * TODO(email): wire to the Gmail integration adapter
 * (packages/core/integrations) using a service account / OAuth, or relay
 * through an internal mail Edge Function. Safe sandbox fallback: log and
 * report not-sent so callers stay coherent.
 */
async function sendEmailViaGmail(to: string, subject: string, text: string): Promise<boolean> {
  const apiUrl = Deno.env.get("GMAIL_RELAY_URL");
  const apiKey = Deno.env.get("GMAIL_RELAY_KEY");
  if (!apiUrl || !apiKey) {
    console.log(`[notify] (gmail stub) → to=${to} subject="${subject}" body="${text}"`);
    return false;
  }
  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ to, subject, text }),
    });
    if (!res.ok) {
      console.error("[notify] gmail relay HTTP", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[notify] gmail relay error", e);
    return false;
  }
}

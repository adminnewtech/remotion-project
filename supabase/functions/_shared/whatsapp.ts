// Elite v1 — shared WhatsApp adapter for Edge Functions (Deno).
//
// WhatsApp Cloud API (Meta Graph). Config-driven via Deno.env; never hardcoded.
// Mirrors packages/core/src/integrations/whatsapp.ts (Edge Functions can't
// import the workspace @elite/core package). Keep the two in sync.
//
// Env:
//   WHATSAPP_PHONE_NUMBER_ID   Cloud API phone-number id (sender)
//   WHATSAPP_ACCESS_TOKEN      permanent / system-user token
//   WHATSAPP_API_VERSION       optional, default v19.0
//
// Outside the 24h customer-service window WhatsApp only allows pre-approved
// templates — exactly the order-milestone case. Safe in sandbox: when unset,
// sendTemplate is a no-op returning { skipped: 'unconfigured' }.

const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
const ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") ?? "";
const API_VERSION = Deno.env.get("WHATSAPP_API_VERSION") ?? "v19.0";

export const whatsappConfigured = Boolean(PHONE_NUMBER_ID && ACCESS_TOKEN);

export interface WhatsAppTemplateInput {
  /** Recipient in E.164 (e.g. 9655XXXXXXX, no '+'). */
  to: string;
  template: string;
  language?: string;
  bodyParams?: string[];
}

export interface WhatsAppResult {
  sent: boolean;
  id?: string;
  skipped?: string;
}

/** Send a pre-approved WhatsApp template. No-op (skipped) when unconfigured. */
export async function sendTemplate(input: WhatsAppTemplateInput): Promise<WhatsAppResult> {
  if (!whatsappConfigured) {
    console.log(
      `[notify] (whatsapp stub) → to=${input.to} template=${input.template} params=${
        JSON.stringify(input.bodyParams ?? [])
      }`,
    );
    return { sent: false, skipped: "unconfigured" };
  }

  const components = input.bodyParams && input.bodyParams.length > 0
    ? [{
      type: "body",
      parameters: input.bodyParams.map((text) => ({ type: "text", text })),
    }]
    : undefined;

  const payload = {
    messaging_product: "whatsapp",
    to: input.to,
    type: "template",
    template: {
      name: input.template,
      language: { code: input.language ?? "ar" },
      ...(components ? { components } : {}),
    },
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ACCESS_TOKEN}`,
        },
        body: JSON.stringify(payload),
      },
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[notify] whatsapp HTTP", res.status, json?.error?.message ?? "");
      return { sent: false, skipped: `http_${res.status}` };
    }
    return { sent: true, id: json?.messages?.[0]?.id };
  } catch (e) {
    console.error("[notify] whatsapp error", e);
    return { sent: false, skipped: "error" };
  }
}

/**
 * Map a notification `kind` to an approved WhatsApp template name. Templates
 * must be created/approved in WhatsApp Manager with a {{1}} body param for the
 * order number. Unknown kinds → null (skip WhatsApp for that notification).
 * TODO(whatsapp): align these names with the approved templates for the WABA.
 */
export function templateForKind(kind: string): string | null {
  switch (kind) {
    case "order_paid":
      return "order_paid";
    case "order_out_for_delivery":
    case "task_out_for_delivery":
      return "order_out_for_delivery";
    case "order_delivered":
    case "task_delivered":
      return "order_delivered";
    case "order_installing":
    case "task_installing":
      return "order_installing";
    case "order_completed":
    case "task_install_completed":
      return "order_completed";
    default:
      return null;
  }
}

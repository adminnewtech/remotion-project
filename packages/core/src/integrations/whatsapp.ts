/**
 * WhatsApp adapter — WhatsApp Cloud API (Meta Graph).
 *
 * Stub-with-real-shape: credentials (`phoneNumberId`, `accessToken`) are read
 * from the passed `config` (env-backed); never hardcoded. `sendTemplate` is the
 * primary entry point — outside the 24h customer-service window WhatsApp only
 * allows pre-approved message templates, which is exactly the order-milestone
 * use case (paid / out-for-delivery / delivered / installing / completed).
 *
 * Behaviour:
 *   - Unconfigured → `sendTemplate` throws `NotConfiguredError` (consistent with
 *     the other adapters), so callers can detect and fall back gracefully.
 *   - Configured → POSTs to the Cloud API messages endpoint.
 *
 * TODO(whatsapp): confirm template names + the language/components mapping
 * against the WhatsApp Manager templates for the Newtech WABA.
 *   - send: POST https://graph.facebook.com/{version}/{phoneNumberId}/messages
 *   Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 */
import {
  type Adapter,
  type ExternalRef,
  type WhatsAppConfig,
  type WhatsAppTemplateInput,
  requireConfig,
} from './types';

const API_REF =
  'https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages';
const DEFAULT_API_VERSION = 'v19.0';
const GRAPH_BASE = 'https://graph.facebook.com';

export interface WhatsAppAdapter extends Adapter {
  /** Send a pre-approved template message (order milestones, OTP, etc.). */
  sendTemplate(input: WhatsAppTemplateInput): Promise<ExternalRef>;
}

export function createWhatsAppAdapter(config?: Partial<WhatsAppConfig>): WhatsAppAdapter {
  const configured = Boolean(config?.phoneNumberId && config?.accessToken);

  return {
    service: 'WhatsApp Cloud API',
    configured,

    async sendTemplate(input: WhatsAppTemplateInput): Promise<ExternalRef> {
      requireConfig<WhatsAppConfig>(
        'WhatsApp Cloud API',
        config,
        ['phoneNumberId', 'accessToken'],
        API_REF,
      );

      const version = config.apiVersion ?? DEFAULT_API_VERSION;
      const url = `${GRAPH_BASE}/${version}/${config.phoneNumberId}/messages`;

      const components =
        input.bodyParams && input.bodyParams.length > 0
          ? [
              {
                type: 'body',
                parameters: input.bodyParams.map((text) => ({ type: 'text', text })),
              },
            ]
          : undefined;

      const payload = {
        messaging_product: 'whatsapp',
        to: input.to,
        type: 'template',
        template: {
          name: input.template,
          language: { code: input.language ?? 'ar' },
          ...(components ? { components } : {}),
        },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = json?.error?.message ?? `HTTP ${res.status}`;
        throw new Error(`WhatsApp sendTemplate failed: ${msg}`);
      }
      const id = json?.messages?.[0]?.id ?? '';
      return { id: String(id) };
    },
  };
}

export { API_REF as WHATSAPP_API_REF };

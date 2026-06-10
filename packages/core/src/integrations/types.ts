/**
 * Integration adapter contracts.
 *
 * Per ARCHITECTURE §3.8 / §6: integrations are adapters, not couplings. Each
 * service sits behind an interface so it can be swapped or stubbed. Credentials
 * are *passed in* (read from Supabase/Vercel env by the caller) — NEVER
 * hardcoded here. A stub with missing config throws `NotConfiguredError`.
 */

/** Thrown when an adapter is invoked without the credentials it needs. */
export class NotConfiguredError extends Error {
  constructor(service: string, missing: string[], apiRef: string) {
    super(
      `${service} integration is not configured: missing ${missing.join(', ')}. ` +
        `Provide these via env-backed config. See: ${apiRef}`,
    );
    this.name = 'NotConfiguredError';
  }
}

/** Assert required config fields are present; otherwise throw NotConfiguredError. */
export function requireConfig<T extends object>(
  service: string,
  config: Partial<T> | undefined,
  keys: (keyof T)[],
  apiRef: string,
): asserts config is T {
  const missing = keys.filter((k) => {
    const value = config?.[k];
    return value == null || value === '';
  });
  if (missing.length > 0) {
    throw new NotConfiguredError(service, missing.map(String), apiRef);
  }
}

/** Base shape every adapter shares: a `configured` flag derived from config. */
export interface Adapter {
  readonly service: string;
  readonly configured: boolean;
}

// ── Per-service config shapes (env-backed; passed by caller) ───────────────

export interface ZohoBooksConfig {
  organizationId: string;
  accessToken: string;
  /** Regional API base, e.g. https://www.zohoapis.com/books/v3 */
  apiBase?: string;
}

export interface ZohoDeskConfig {
  orgId: string;
  accessToken: string;
  departmentId?: string;
  apiBase?: string;
}

export interface GmailConfig {
  /** Sender mailbox, e.g. orders@newtechq8.com */
  sender: string;
  accessToken: string;
}

export interface MetaConfig {
  accessToken: string;
  /** Product catalog id for the feed sync. */
  catalogId: string;
  /** Ad account id (act_XXXX) for campaign automation. */
  adAccountId?: string;
  apiVersion?: string;
}

export interface CloudflareConfig {
  /** Image delivery base, e.g. https://imagedelivery.net/<account-hash> or a zone. */
  deliveryBase: string;
}

export interface PaymentConfig {
  /** MyFatoorah API token (Bearer). */
  apiToken: string;
  /**
   * API base. Sandbox: https://apitest.myfatoorah.com
   * Live (KW region): https://api.myfatoorah.com
   */
  apiBase: string;
  /** URL the gateway redirects the customer to on success. */
  callbackUrl?: string;
  /** URL the gateway redirects the customer to on failure/cancel. */
  errorUrl?: string;
  /** Shared secret used to verify gateway webhook callbacks (HMAC). */
  webhookSecret?: string;
}

export interface WhatsAppConfig {
  /** WhatsApp Cloud API phone-number id (the sender). */
  phoneNumberId: string;
  /** Permanent / system-user access token. */
  accessToken: string;
  /** Graph API version, e.g. v19.0 (adapter applies a default). */
  apiVersion?: string;
}

// ── Adapter operation result/argument shapes ──────────────────────────────

export interface ZohoInvoiceLine {
  name: string;
  quantity: number;
  rate: number;
}

export interface CreateInvoiceInput {
  customerId: string;
  /** Elite order number for reference. */
  reference: string;
  currency: string;
  lines: ZohoInvoiceLine[];
}

export interface RecordPaymentInput {
  invoiceId: string;
  amount: number;
  /** ISO date the payment was received. */
  date: string;
  mode?: string;
}

export interface ExternalRef {
  /** Identifier in the external system. */
  id: string;
}

export interface DeskTicketInput {
  subject: string;
  description: string;
  contactEmail: string;
  /** Optional Elite ticket id for cross-linking. */
  reference?: string;
}

export interface EmailInput {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}

export interface MetaCampaignInput {
  name: string;
  /** Daily budget in minor units of the ad account currency. */
  dailyBudget: number;
  objective: string;
  status?: 'PAUSED' | 'ACTIVE';
}

export interface CloudflareResizeOptions {
  width?: number;
  height?: number;
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
  quality?: number;
  format?: 'auto' | 'webp' | 'avif' | 'jpeg' | 'png';
}

// ── Payment (MyFatoorah / KNET) shapes ─────────────────────────────────────

/** Supported payment methods (mirrors the DB `payment_method` enum). */
export type PaymentMethodCode = 'knet' | 'apple_pay' | 'google_pay' | 'card' | 'cod';

export interface InitiatePaymentInput {
  /** Internal order id (round-tripped via the gateway reference). */
  orderId: string;
  /** Human-facing order number (NT-xxxxx). */
  orderNumber: string;
  /** Charge amount in KWD (3 decimals). DB-computed; never client-supplied. */
  amount: number;
  /** ISO-4217 currency. Defaults to KWD. */
  currency?: string;
  method: PaymentMethodCode;
  /** Customer contact (used by the gateway for receipts / 3DS). */
  customerName?: string;
  customerEmail?: string;
  customerMobile?: string;
  /** Override the configured success/error return URLs for this charge. */
  callbackUrl?: string;
  errorUrl?: string;
}

export interface InitiatePaymentResult {
  /**
   * Hosted payment-page URL to redirect the customer to. Undefined for COD
   * (no redirect). In sandbox without config, a safe placeholder URL.
   */
  paymentUrl?: string;
  /** Gateway reference (e.g. MyFatoorah InvoiceId) to persist on the payment. */
  gatewayRef?: string;
  /** True when no live gateway call was made (COD or sandbox fallback). */
  sandbox?: boolean;
}

export interface VerifyPaymentInput {
  /** Gateway reference / key returned at initiation (e.g. MyFatoorah Key/InvoiceId). */
  gatewayRef: string;
  /** Optional expected amount for a defensive cross-check (KWD). */
  expectedAmount?: number;
}

export interface VerifyPaymentResult {
  status: 'paid' | 'failed' | 'pending';
  /** Amount the gateway reports as captured (KWD), when known. */
  amount?: number;
  gatewayRef?: string;
  /** Raw gateway payload for auditing on the payment row. */
  raw?: Record<string, unknown>;
}

// ── WhatsApp Cloud API shapes ──────────────────────────────────────────────

export interface WhatsAppTemplateInput {
  /** Recipient in E.164 (e.g. 9655XXXXXXX). */
  to: string;
  /** Template name as approved in WhatsApp Manager. */
  template: string;
  /** Template language code, e.g. 'ar' or 'en'. Default 'ar'. */
  language?: string;
  /** Ordered body parameter values substituted into {{1}}, {{2}}, … */
  bodyParams?: string[];
}

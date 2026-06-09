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

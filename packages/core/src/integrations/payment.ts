/**
 * Payment adapter (Kuwait) — MyFatoorah / KNET.
 *
 * MyFatoorah is the aggregator most KW retailers use; it fronts KNET, Apple Pay,
 * Google Pay and cards behind one hosted payment page. This adapter is
 * config-driven: ALL credentials (`apiToken`, `apiBase`, return URLs, webhook
 * secret) are read from the passed `config` (env-backed by the caller) and are
 * NEVER hardcoded.
 *
 * Two operations:
 *   - initiatePayment → create a hosted payment session, return its URL + ref.
 *   - verifyPayment   → confirm a charge's final status (called from the
 *                       payment-webhook before settling the order).
 *
 * COD: no gateway call; returns success with no redirect URL.
 *
 * Safe in sandbox: when `config` is absent/incomplete the adapter does NOT throw
 * for initiatePayment — it returns a graceful placeholder `paymentUrl` so local
 * checkout keeps working — while marking `sandbox: true`. `verifyPayment`
 * against an unconfigured adapter reports `pending` rather than throwing.
 *
 * TODO(payments): the live endpoint shapes below are the documented MyFatoorah
 * v2 contract; confirm field names against the account's API docs before go-live
 *   - initiate: POST {apiBase}/v2/SendPayment  (or /v2/ExecutePayment for direct)
 *   - verify:   POST {apiBase}/v2/GetPaymentStatus  { Key, KeyType: 'InvoiceId' }
 *   Docs: https://docs.myfatoorah.com/docs/api-documentation
 */
import {
  type Adapter,
  type InitiatePaymentInput,
  type InitiatePaymentResult,
  type PaymentConfig,
  type VerifyPaymentInput,
  type VerifyPaymentResult,
} from './types';

const API_REF = 'https://docs.myfatoorah.com/docs/api-documentation';
const DEFAULT_CURRENCY = 'KWD';

export interface PaymentAdapter extends Adapter {
  /**
   * Begin a charge. COD returns no URL; configured gateway returns the hosted
   * page URL + gateway ref; unconfigured (sandbox) returns a placeholder URL.
   */
  initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult>;
  /** Confirm a charge's final status by gateway reference. */
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;
}

/** Round to KWD's 3 decimals (fils). Avoids float drift. */
function kwd(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

/** A deterministic, clearly-fake URL so sandbox checkout still returns one. */
function sandboxUrl(input: InitiatePaymentInput): string {
  const params = new URLSearchParams({
    order: input.orderNumber,
    amount: String(kwd(input.amount)),
    method: input.method,
    sandbox: '1',
  });
  return `https://sandbox.pay.newtech.local/checkout?${params.toString()}`;
}

export function createPaymentAdapter(config?: Partial<PaymentConfig>): PaymentAdapter {
  const configured = Boolean(config?.apiToken && config?.apiBase);

  async function callMyFatoorah(path: string, payload: unknown): Promise<any> {
    const base = config!.apiBase!.replace(/\/$/, '');
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config!.apiToken!}`,
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.IsSuccess === false) {
      const msg = json?.Message ?? `HTTP ${res.status}`;
      throw new Error(`MyFatoorah ${path} failed: ${msg}`);
    }
    return json;
  }

  return {
    service: 'MyFatoorah / KNET',
    configured,

    async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
      // COD: nothing to charge online.
      if (input.method === 'cod') {
        return { sandbox: false };
      }

      const amount = kwd(input.amount);

      // Sandbox / not configured → graceful placeholder, never throw.
      if (!configured) {
        return { paymentUrl: sandboxUrl(input), sandbox: true };
      }

      // ── Live: create a hosted payment session ──────────────────────────
      // TODO(payments): confirm SendPayment vs ExecutePayment + PaymentMethodId
      // mapping (KNET=1 etc.) against the account. SendPayment returns a hosted
      // page that lets the customer pick KNET/Apple Pay/Card.
      const payload = {
        CustomerName: input.customerName ?? 'Customer',
        NotificationOption: 'LNK',
        InvoiceValue: amount,
        DisplayCurrencyIso: input.currency ?? DEFAULT_CURRENCY,
        CustomerEmail: input.customerEmail ?? undefined,
        CustomerMobile: input.customerMobile ?? undefined,
        // Round-trip our identifiers so the webhook can resolve the order.
        CustomerReference: input.orderNumber,
        UserDefinedField: input.orderId,
        CallBackUrl: input.callbackUrl ?? config!.callbackUrl ?? undefined,
        ErrorUrl: input.errorUrl ?? config!.errorUrl ?? config!.callbackUrl ?? undefined,
      };

      const json = await callMyFatoorah('/v2/SendPayment', payload);
      const data = json?.Data ?? {};
      return {
        paymentUrl: data.InvoiceURL ?? data.PaymentURL ?? undefined,
        gatewayRef: data.InvoiceId != null ? String(data.InvoiceId) : undefined,
        sandbox: false,
      };
    },

    async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
      // Unconfigured: we cannot confirm anything → report pending (non-throwing).
      if (!configured) {
        return { status: 'pending', gatewayRef: input.gatewayRef };
      }

      // TODO(payments): GetPaymentStatus with KeyType 'InvoiceId' (or 'PaymentId'
      // for the payment-page key). Map InvoiceStatus → our status.
      const json = await callMyFatoorah('/v2/GetPaymentStatus', {
        Key: input.gatewayRef,
        KeyType: 'InvoiceId',
      });
      const data = json?.Data ?? {};
      const invoiceStatus = String(data.InvoiceStatus ?? '').toLowerCase();
      const status: VerifyPaymentResult['status'] =
        invoiceStatus === 'paid'
          ? 'paid'
          : invoiceStatus === 'failed' ||
              invoiceStatus === 'expired' ||
              invoiceStatus === 'canceled' ||
              invoiceStatus === 'cancelled'
            ? 'failed'
            : 'pending';

      // Sum captured transaction amounts when present.
      const txns: any[] = Array.isArray(data.InvoiceTransactions)
        ? data.InvoiceTransactions
        : [];
      const captured = txns
        .filter((t) => String(t?.TransactionStatus ?? '').toLowerCase() === 'succss' ||
          String(t?.TransactionStatus ?? '').toLowerCase() === 'success')
        .reduce((s, t) => s + Number(t?.TransactionValue ?? 0), 0);

      return {
        status,
        amount: captured > 0 ? kwd(captured) : Number(data.InvoiceValue ?? input.expectedAmount ?? 0),
        gatewayRef: data.InvoiceId != null ? String(data.InvoiceId) : input.gatewayRef,
        raw: json,
      };
    },
  };
}

export { API_REF as PAYMENT_API_REF };

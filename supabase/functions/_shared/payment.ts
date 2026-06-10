// Elite v1 — shared payment adapter for Edge Functions (Deno).
//
// MyFatoorah / KNET aggregator. Config-driven: reads ALL credentials from
// Deno.env (never hardcoded). Mirrors packages/core/src/integrations/payment.ts
// but lives here because Edge Functions can't import the workspace @elite/core
// package (bare specifiers). Keep the two in sync.
//
// Env:
//   MYFATOORAH_API_TOKEN   Bearer token
//   MYFATOORAH_API_BASE    https://apitest.myfatoorah.com (sandbox)
//                          https://api.myfatoorah.com (live KW)
//   PAYMENT_CALLBACK_URL   success redirect
//   PAYMENT_ERROR_URL      failure/cancel redirect
//
// Safe in sandbox: when the token/base are unset, initiatePayment returns a
// placeholder URL (sandbox:true) instead of throwing, and verifyPayment reports
// 'pending'. COD never calls the gateway.

const API_TOKEN = Deno.env.get("MYFATOORAH_API_TOKEN") ?? "";
const API_BASE = (Deno.env.get("MYFATOORAH_API_BASE") ?? "").replace(/\/$/, "");
const CALLBACK_URL = Deno.env.get("PAYMENT_CALLBACK_URL") ??
  Deno.env.get("PAYMENT_RETURN_URL") ?? "https://pay.newtech.example/checkout";
const ERROR_URL = Deno.env.get("PAYMENT_ERROR_URL") ?? CALLBACK_URL;

export const paymentConfigured = Boolean(API_TOKEN && API_BASE);

export type PaymentMethodCode = "knet" | "apple_pay" | "google_pay" | "card" | "cod";

export interface InitiatePaymentInput {
  orderId: string;
  orderNumber: string;
  amount: number;
  currency?: string;
  method: PaymentMethodCode;
  customerName?: string;
  customerEmail?: string;
  customerMobile?: string;
}

export interface InitiatePaymentResult {
  paymentUrl?: string;
  gatewayRef?: string;
  sandbox?: boolean;
}

export interface VerifyPaymentResult {
  status: "paid" | "failed" | "pending";
  amount?: number;
  gatewayRef?: string;
  raw?: Record<string, unknown>;
}

function kwd(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

async function callMyFatoorah(path: string, payload: unknown): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_TOKEN}`,
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

/**
 * Begin a charge. COD → no URL. Configured gateway → hosted page URL + ref.
 * Unconfigured (sandbox) → placeholder URL so local checkout keeps working.
 */
export async function initiatePayment(
  input: InitiatePaymentInput,
): Promise<InitiatePaymentResult> {
  if (input.method === "cod") {
    return { sandbox: false };
  }

  const amount = kwd(input.amount);

  if (!paymentConfigured) {
    const params = new URLSearchParams({
      order: input.orderNumber,
      amount: String(amount),
      method: input.method,
      sandbox: "1",
    });
    return {
      paymentUrl: `${CALLBACK_URL}?${params.toString()}`,
      sandbox: true,
    };
  }

  // TODO(payments): confirm SendPayment vs ExecutePayment + PaymentMethodId
  // (KNET=1) mapping against the live MyFatoorah account.
  const json = await callMyFatoorah("/v2/SendPayment", {
    CustomerName: input.customerName ?? "Customer",
    NotificationOption: "LNK",
    InvoiceValue: amount,
    DisplayCurrencyIso: input.currency ?? "KWD",
    CustomerEmail: input.customerEmail ?? undefined,
    CustomerMobile: input.customerMobile ?? undefined,
    CustomerReference: input.orderNumber,
    UserDefinedField: input.orderId,
    CallBackUrl: CALLBACK_URL,
    ErrorUrl: ERROR_URL,
  });
  const data = json?.Data ?? {};
  return {
    paymentUrl: data.InvoiceURL ?? data.PaymentURL ?? undefined,
    gatewayRef: data.InvoiceId != null ? String(data.InvoiceId) : undefined,
    sandbox: false,
  };
}

/** Confirm a charge's final status by gateway reference (InvoiceId). */
export async function verifyPayment(
  gatewayRef: string,
  expectedAmount?: number,
): Promise<VerifyPaymentResult> {
  if (!paymentConfigured) {
    return { status: "pending", gatewayRef };
  }
  // TODO(payments): map InvoiceStatus values precisely per account docs.
  const json = await callMyFatoorah("/v2/GetPaymentStatus", {
    Key: gatewayRef,
    KeyType: "InvoiceId",
  });
  const data = json?.Data ?? {};
  const s = String(data.InvoiceStatus ?? "").toLowerCase();
  const status: VerifyPaymentResult["status"] = s === "paid"
    ? "paid"
    : (s === "failed" || s === "expired" || s === "canceled" || s === "cancelled")
    ? "failed"
    : "pending";
  return {
    status,
    amount: Number(data.InvoiceValue ?? expectedAmount ?? 0),
    gatewayRef: data.InvoiceId != null ? String(data.InvoiceId) : gatewayRef,
    raw: json,
  };
}

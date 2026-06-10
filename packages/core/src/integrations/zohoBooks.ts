/**
 * Zoho Books adapter (accounting) — invoices & payments.
 *
 * Stub: credentials are read from the passed `config` (env-backed); nothing is
 * hardcoded. Calls throw `NotConfiguredError` until config is supplied.
 *
 * TODO: implement against Zoho Books API v3.
 *   - createInvoice  → POST {apiBase}/invoices?organization_id={orgId}
 *   - recordPayment  → POST {apiBase}/customerpayments?organization_id={orgId}
 *   Docs: https://www.zoho.com/books/api/v3/invoices/  /  /customer-payments/
 */
import {
  type Adapter,
  type CreateInvoiceInput,
  type ExternalRef,
  type RecordPaymentInput,
  type ZohoBooksConfig,
  requireConfig,
} from './types';

const API_REF = 'https://www.zoho.com/books/api/v3/invoices/';

export interface ZohoBooksAdapter extends Adapter {
  createInvoice(input: CreateInvoiceInput): Promise<ExternalRef>;
  recordPayment(input: RecordPaymentInput): Promise<ExternalRef>;
}

export function createZohoBooksAdapter(
  config?: Partial<ZohoBooksConfig>,
): ZohoBooksAdapter {
  const configured = Boolean(config?.organizationId && config?.accessToken);

  return {
    service: 'Zoho Books',
    configured,

    async createInvoice(_input: CreateInvoiceInput): Promise<ExternalRef> {
      requireConfig('Zoho Books', config, ['organizationId', 'accessToken'], API_REF);
      // TODO: POST to {apiBase}/invoices?organization_id={organizationId}
      throw new Error('Zoho Books createInvoice: not implemented (stub).');
    },

    async recordPayment(_input: RecordPaymentInput): Promise<ExternalRef> {
      requireConfig('Zoho Books', config, ['organizationId', 'accessToken'], API_REF);
      // TODO: POST to {apiBase}/customerpayments?organization_id={organizationId}
      throw new Error('Zoho Books recordPayment: not implemented (stub).');
    },
  };
}

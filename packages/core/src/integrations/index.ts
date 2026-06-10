/**
 * Integration adapters barrel.
 *
 * Adapters, not couplings (ARCHITECTURE §3.8). Construct each with env-backed
 * config; nothing is hardcoded. Operations throw `NotConfiguredError` until
 * the required credentials are provided.
 */
export * from './types';
export * from './zohoBooks';
export * from './zohoDesk';
export * from './gmail';
export * from './meta';
export * from './cloudflare';
export * from './payment';
export * from './whatsapp';

import type {
  CloudflareConfig,
  GmailConfig,
  MetaConfig,
  PaymentConfig,
  WhatsAppConfig,
  ZohoBooksConfig,
  ZohoDeskConfig,
} from './types';
import { createZohoBooksAdapter } from './zohoBooks';
import { createZohoDeskAdapter } from './zohoDesk';
import { createGmailAdapter } from './gmail';
import { createMetaAdapter } from './meta';
import { createCloudflareAdapter } from './cloudflare';
import { createPaymentAdapter } from './payment';
import { createWhatsAppAdapter } from './whatsapp';

/** Combined config for all integrations (each optional / env-backed). */
export interface IntegrationsConfig {
  zohoBooks?: Partial<ZohoBooksConfig>;
  zohoDesk?: Partial<ZohoDeskConfig>;
  gmail?: Partial<GmailConfig>;
  meta?: Partial<MetaConfig>;
  cloudflare?: Partial<CloudflareConfig>;
  payment?: Partial<PaymentConfig>;
  whatsapp?: Partial<WhatsAppConfig>;
}

/** Build the full set of adapters from a single config object. */
export function createIntegrations(config: IntegrationsConfig = {}) {
  return {
    zohoBooks: createZohoBooksAdapter(config.zohoBooks),
    zohoDesk: createZohoDeskAdapter(config.zohoDesk),
    gmail: createGmailAdapter(config.gmail),
    meta: createMetaAdapter(config.meta),
    cloudflare: createCloudflareAdapter(config.cloudflare),
    payment: createPaymentAdapter(config.payment),
    whatsapp: createWhatsAppAdapter(config.whatsapp),
  };
}

export type Integrations = ReturnType<typeof createIntegrations>;

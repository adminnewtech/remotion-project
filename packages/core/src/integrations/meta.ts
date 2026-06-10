/**
 * Meta (Facebook/Instagram) Ads adapter — catalog feed + campaign automation.
 *
 * Stub: credentials read from passed `config` (env-backed); never hardcoded.
 * Throws `NotConfiguredError` until configured.
 *
 * TODO: implement against Meta Marketing / Graph API.
 *   - syncCatalogFeed → POST /{catalogId}/batch  (product feed upsert)
 *   - createCampaign  → POST /{adAccountId}/campaigns
 *   Docs: https://developers.facebook.com/docs/marketing-api/
 */
import {
  type Adapter,
  type ExternalRef,
  type MetaCampaignInput,
  type MetaConfig,
  requireConfig,
} from './types';

const API_REF = 'https://developers.facebook.com/docs/marketing-api/';

/** Minimal product feed item; mirrors Meta catalog batch fields. */
export interface MetaCatalogItem {
  retailer_id: string;
  name: string;
  description?: string;
  /** Price as "amount currency", e.g. "12.500 KWD". */
  price: string;
  availability: 'in stock' | 'out of stock' | 'preorder';
  image_url: string;
  url: string;
}

export interface MetaAdapter extends Adapter {
  syncCatalogFeed(items: MetaCatalogItem[]): Promise<{ synced: number }>;
  createCampaign(input: MetaCampaignInput): Promise<ExternalRef>;
}

export function createMetaAdapter(config?: Partial<MetaConfig>): MetaAdapter {
  const configured = Boolean(config?.accessToken && config?.catalogId);

  return {
    service: 'Meta Ads',
    configured,

    async syncCatalogFeed(_items: MetaCatalogItem[]): Promise<{ synced: number }> {
      requireConfig('Meta Ads', config, ['accessToken', 'catalogId'], API_REF);
      // TODO: POST /{catalogId}/batch with the product feed payload.
      throw new Error('Meta syncCatalogFeed: not implemented (stub).');
    },

    async createCampaign(_input: MetaCampaignInput): Promise<ExternalRef> {
      requireConfig('Meta Ads', config, ['accessToken', 'adAccountId'], API_REF);
      // TODO: POST /{adAccountId}/campaigns.
      throw new Error('Meta createCampaign: not implemented (stub).');
    },
  };
}

import 'server-only';

/**
 * Admin marketing data seam (OSALPHA gold) — native campaigns + own catalog.
 *
 * Campaigns are stored first-party in `marketing_campaigns` (migration 0016)
 * rather than read-only from Meta, and the catalog item count comes from our
 * own `products` — so the product feed we export (feeds/google-merchant.xml,
 * feeds/meta-catalog.csv) is sourced from us, not Shopify. ROAS is derived from
 * stored spend + attributed revenue. Sample fallback keeps the page rendering.
 */
import { getServerClient } from '@/lib/supabase/server';
import { metaCampaigns } from '@/lib/admin-sample';

export interface MarketingCampaign {
  id: string;
  name: string;
  channel: string;
  status: 'active' | 'paused' | 'ended';
  spend: number;
  reach: number;
  roas: number;
}

export interface DiscountRow {
  id: string;
  code: string;
  kind: string;
  value: number;
  min_subtotal: number;
  used_count: number;
  usage_limit: number | null;
  is_active: boolean;
}

export interface MarketingData {
  live: boolean;
  totalSpend: number;
  totalReach: number;
  roas: number;
  catalogItems: number;
  campaigns: MarketingCampaign[];
  discounts: DiscountRow[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export async function fetchMarketing(): Promise<MarketingData> {
  const client = await getServerClient();
  if (client) {
    try {
      const [{ data: rows }, { count }, { data: discRows }] = await Promise.all([
        client
          .from('marketing_campaigns')
          .select('id, name, channel, status, spend, reach, revenue')
          .order('created_at', { ascending: false }),
        client
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true),
        client.from('discounts').select('id, code, kind, value, min_subtotal, used_count, usage_limit, is_active').order('created_at', { ascending: false }).limit(30),
      ]);

      const discounts: DiscountRow[] = ((discRows ?? []) as DiscountRow[]).map((d) => ({
        ...d, value: Number(d.value), min_subtotal: Number(d.min_subtotal),
      }));
      if (rows && rows.length) {
        const campaigns: MarketingCampaign[] = (rows as CampaignRow[]).map((c) => ({
          id: c.id,
          name: c.name,
          channel: c.channel,
          status: normalizeStatus(c.status),
          spend: c.spend,
          reach: c.reach,
          roas: c.spend > 0 ? round1(c.revenue / c.spend) : 0,
        }));
        const totalSpend = round1(campaigns.reduce((s, c) => s + c.spend, 0));
        const totalRevenue = (rows as CampaignRow[]).reduce((s, c) => s + (c.revenue || 0), 0);
        return {
          live: true,
          totalSpend,
          totalReach: campaigns.reduce((s, c) => s + c.reach, 0),
          roas: totalSpend > 0 ? round1(totalRevenue / totalSpend) : 0,
          catalogItems: count ?? 0,
          campaigns,
          discounts,
        };
      }
    } catch {
      /* fall through */
    }
  }

  const campaigns: MarketingCampaign[] = metaCampaigns.map((c) => ({
    id: c.id,
    name: c.name,
    channel: 'meta',
    status: c.status === 'Active' ? 'active' : 'paused',
    spend: c.spend,
    reach: c.reach,
    roas: c.roas,
  }));
  const totalSpend = round1(campaigns.reduce((s, c) => s + c.spend, 0));
  return {
    live: false,
    totalSpend,
    totalReach: campaigns.reduce((s, c) => s + c.reach, 0),
    roas: 4.6,
    catalogItems: 24,
    campaigns,
    discounts: [
      { id: 'd1', code: 'NEWTECH10', kind: 'percent', value: 10, min_subtotal: 0, used_count: 42, usage_limit: null, is_active: true },
    ],
  };
}

function normalizeStatus(s: string): 'active' | 'paused' | 'ended' {
  return s === 'active' || s === 'paused' || s === 'ended' ? s : 'paused';
}

interface CampaignRow {
  id: string;
  name: string;
  channel: string;
  status: string;
  spend: number;
  reach: number;
  revenue: number;
}

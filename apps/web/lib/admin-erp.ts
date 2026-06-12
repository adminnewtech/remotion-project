import 'server-only';
import { getServerClient } from '@/lib/supabase/server';

// ── Cycle counts ────────────────────────────────────────────────────────────

export interface CountRow {
  id: string;
  count_number: string;
  location: string;
  locationId: string;
  status: 'draft' | 'counting' | 'review' | 'posted' | 'cancelled';
  note: string | null;
  createdAt: string;
  postedAt: string | null;
  itemCount: number;
  variance: number;
}

export interface CountItemRow {
  id: string;
  variantId: string;
  product: string;
  sku: string | null;
  expected: number;
  counted: number | null;
  variance: number | null;
}

export interface CycleCountsData {
  live: boolean;
  counts: CountRow[];
  locations: { id: string; name: string; kind: string }[];
}

export async function fetchCycleCounts(): Promise<CycleCountsData> {
  const sb = await getServerClient();

  const [{ data: counts }, { data: locs }] = await Promise.all([
    sb
      ? sb.from('cycle_counts')
          .select(`id, count_number, status, note, created_at, posted_at,
                   locations(name),
                   cycle_count_items(id, expected, counted)`)
          .order('created_at', { ascending: false })
          .limit(50)
      : { data: null },
    sb
      ? sb.from('locations').select('id, name, kind').eq('is_active', true).order('name')
      : { data: null },
  ]);

  if (!counts) {
    return {
      live: false,
      counts: sampleCounts,
      locations: [{ id: 'loc-1', name: 'الشويخ', kind: 'store' }],
    };
  }

  return {
    live: true,
    counts: (counts as unknown as CycleCountRaw[]).map((c) => ({
      id: c.id,
      count_number: c.count_number,
      location: (c.locations as { name: string } | null)?.name ?? '—',
      locationId: '',
      status: c.status as CountRow['status'],
      note: c.note,
      createdAt: c.created_at,
      postedAt: c.posted_at,
      itemCount: Array.isArray(c.cycle_count_items) ? c.cycle_count_items.length : 0,
      variance: Array.isArray(c.cycle_count_items)
        ? (c.cycle_count_items as { expected: number; counted: number | null }[]).filter(
            (i) => i.counted !== null && i.counted !== i.expected
          ).length
        : 0,
    })),
    locations: (locs ?? []) as { id: string; name: string; kind: string }[],
  };
}

interface CycleCountRaw {
  id: string;
  count_number: string;
  status: string;
  note: string | null;
  created_at: string;
  posted_at: string | null;
  locations: unknown;
  cycle_count_items: unknown[];
}

const sampleCounts: CountRow[] = [
  {
    id: 's1',
    count_number: 'CC-101',
    location: 'الشويخ',
    locationId: 'l1',
    status: 'review',
    note: 'جرد شهري',
    createdAt: new Date().toISOString(),
    postedAt: null,
    itemCount: 24,
    variance: 3,
  },
  {
    id: 's2',
    count_number: 'CC-102',
    location: 'السالمية',
    locationId: 'l2',
    status: 'posted',
    note: null,
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    postedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    itemCount: 18,
    variance: 0,
  },
  {
    id: 's3',
    count_number: 'CC-103',
    location: 'الفروانية',
    locationId: 'l3',
    status: 'draft',
    note: 'جرد أسبوعي',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    postedAt: null,
    itemCount: 0,
    variance: 0,
  },
];

// ── Reorder policies ────────────────────────────────────────────────────────

export interface ReorderPolicyRow {
  variantId: string;
  product: string;
  sku: string | null;
  location: string;
  locationId: string;
  onHand: number;
  minQty: number;
  maxQty: number;
  supplierName: string | null;
  supplierId: string | null;
  isActive: boolean;
  needsReorder: boolean;
}

export interface ReorderData {
  live: boolean;
  policies: ReorderPolicyRow[];
  draftPoCount: number;
}

export async function fetchReorderPolicies(): Promise<ReorderData> {
  const sb = await getServerClient();

  if (!sb) {
    return { live: false, policies: samplePolicies, draftPoCount: 0 };
  }

  const { data } = (await sb
    .from('reorder_policies')
    .select(
      `variant_id, min_qty, max_qty, is_active,
       product_variants(sku, products(name)),
       locations(id, name),
       suppliers(id, name)`,
    )
    .order('is_active', { ascending: false })
    .limit(200)) as unknown as { data: ReorderRaw[] | null };

  const { data: drafts } = await sb
    .from('purchase_orders')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'draft')
    .ilike('note', '%auto-reorder%');

  if (!data) {
    return { live: false, policies: samplePolicies, draftPoCount: 0 };
  }

  const { data: inv } = await sb.from('inventory').select('variant_id, location_id, on_hand');
  const invMap = new Map<string, number>();
  (inv ?? []).forEach((r: { variant_id: string; location_id: string; on_hand: number }) =>
    invMap.set(`${r.variant_id}:${r.location_id}`, r.on_hand),
  );

  return {
    live: true,
    draftPoCount: (drafts as { count?: number } | null)?.count ?? 0,
    policies: data.map((r) => {
      const loc = r.locations as { id: string; name: string } | null;
      const oh = invMap.get(`${r.variant_id}:${loc?.id ?? ''}`) ?? 0;
      return {
        variantId: r.variant_id,
        product: (r.product_variants?.products as { name: string } | null)?.name ?? '—',
        sku: r.product_variants?.sku ?? null,
        location: loc?.name ?? '—',
        locationId: loc?.id ?? '',
        onHand: oh,
        minQty: r.min_qty,
        maxQty: r.max_qty,
        supplierName: (r.suppliers as { name: string } | null)?.name ?? null,
        supplierId: (r.suppliers as { id: string } | null)?.id ?? null,
        isActive: r.is_active,
        needsReorder: oh <= r.min_qty,
      };
    }),
  };
}

interface ReorderRaw {
  variant_id: string;
  min_qty: number;
  max_qty: number;
  is_active: boolean;
  product_variants: { sku: string | null; products: unknown } | null;
  locations: unknown;
  suppliers: unknown;
}

const samplePolicies: ReorderPolicyRow[] = [
  {
    variantId: 'v1',
    product: 'مكيف سبليت 1.5 طن',
    sku: 'AC-150',
    location: 'الشويخ',
    locationId: 'l1',
    onHand: 2,
    minQty: 5,
    maxQty: 20,
    supplierName: 'مورد الخليج',
    supplierId: 's1',
    isActive: true,
    needsReorder: true,
  },
  {
    variantId: 'v2',
    product: 'تلفزيون 55 بوصة OLED',
    sku: 'TV-55O',
    location: 'الشويخ',
    locationId: 'l1',
    onHand: 12,
    minQty: 5,
    maxQty: 25,
    supplierName: 'مورد الخليج',
    supplierId: 's1',
    isActive: true,
    needsReorder: false,
  },
];

// ── Van stock ────────────────────────────────────────────────────────────────

export interface VanRow {
  id: string;
  name: string;
  ownerName: string | null;
  items: { product: string; sku: string | null; onHand: number }[];
  totalItems: number;
}

export interface VanStockData {
  live: boolean;
  vans: VanRow[];
  warehouses: { id: string; name: string }[];
}

export async function fetchVanStock(): Promise<VanStockData> {
  const sb = await getServerClient();

  if (!sb) {
    return {
      live: false,
      vans: [
        {
          id: 'v1',
          name: 'سيارة أحمد',
          ownerName: 'أحمد خالد',
          items: [{ product: 'مكيف', sku: 'AC-150', onHand: 2 }],
          totalItems: 2,
        },
      ],
      warehouses: [{ id: 'w1', name: 'المستودع الرئيسي' }],
    };
  }

  const [{ data: vans }, { data: warehouses }] = await Promise.all([
    (sb
      .from('locations')
      .select(
        `id, name, profiles(full_name),
         inventory(on_hand, product_variants(sku, products(name)))`,
      )
      .eq('kind', 'van')
      .eq('is_active', true)) as unknown as Promise<{ data: VanRaw[] | null }>,
    sb.from('locations').select('id, name').eq('kind', 'warehouse').eq('is_active', true),
  ]);

  return {
    live: true,
    warehouses: (warehouses ?? []) as { id: string; name: string }[],
    vans: (vans ?? []).map((v) => ({
      id: v.id,
      name: v.name,
      ownerName: (v.profiles as { full_name: string } | null)?.full_name ?? null,
      items: (Array.isArray(v.inventory) ? v.inventory : [])
        .map((i) => ({
          product: (i.product_variants?.products as { name: string } | null)?.name ?? '—',
          sku: i.product_variants?.sku ?? null,
          onHand: i.on_hand,
        }))
        .filter((i) => i.onHand > 0),
      totalItems: (Array.isArray(v.inventory) ? v.inventory : []).reduce(
        (s: number, i: { on_hand: number }) => s + i.on_hand,
        0,
      ),
    })),
  };
}

interface VanRaw {
  id: string;
  name: string;
  profiles: unknown;
  inventory: {
    on_hand: number;
    product_variants: { sku: string | null; products: unknown } | null;
  }[];
}

import 'server-only';

/**
 * Admin inventory suite seam (OSALPHA gold) — multi-location stock matrix,
 * movements ledger, serials, and locations. First-party (migration 0019);
 * on-hand changes ONLY flow through the atomic apply_stock_move/transfer_stock
 * SQL functions, so the ledger is always consistent. Sample fallback included.
 */
import { getServerClient } from '@/lib/supabase/server';
import { stockValue } from '@/lib/pure/inventory';

export interface LocationRow {
  id: string;
  name: string;
  area: string | null;
  is_active: boolean;
}

export interface StockRow {
  variantId: string;
  product: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  /** on-hand per location id. */
  byLocation: Record<string, number>;
  total: number;
}

export interface MoveRow {
  id: number;
  at: string;
  product: string;
  sku: string | null;
  location: string;
  qty: number;
  kind: string;
  ref: string | null;
  note: string | null;
}

export interface InventorySuite {
  live: boolean;
  locations: LocationRow[];
  stock: StockRow[];
  moves: MoveRow[];
  totalUnits: number;
  totalValue: number;
  lowCount: number;
}

const LOW = 5;

export async function fetchInventorySuite(): Promise<InventorySuite> {
  const client = await getServerClient();
  if (client) {
    try {
      const [{ data: locs }, { data: inv }, { data: variants }] = await Promise.all([
        client.from('locations').select('id, name, area, is_active').order('created_at'),
        client.from('inventory').select('variant_id, location_id, on_hand'),
        client.from('product_variants').select('id, sku, barcode, price, sale_price, product_id, products(name_ar)'),
      ]);

      if (locs && locs.length && variants && variants.length) {
        const locations = (locs as LocationRow[]).filter((l) => l.is_active);
        const invRows = (inv ?? []) as { variant_id: string; location_id: string; on_hand: number }[];

        const byVariant = new Map<string, Record<string, number>>();
        for (const r of invRows) {
          const m = byVariant.get(r.variant_id) ?? {};
          m[r.location_id] = (m[r.location_id] ?? 0) + (r.on_hand ?? 0);
          byVariant.set(r.variant_id, m);
        }

        const stock: StockRow[] = (variants as unknown as VariantRow[]).map((v) => {
          const byLocation = byVariant.get(v.id) ?? {};
          const total = Object.values(byLocation).reduce((s, n) => s + n, 0);
          return {
            variantId: v.id,
            product: v.products?.name_ar ?? '—',
            sku: v.sku,
            barcode: v.barcode,
            price: v.sale_price ?? v.price,
            byLocation,
            total,
          };
        });
        stock.sort((a, b) => a.total - b.total);

        // Recent ledger (joined names resolved client-side maps).
        const { data: moveRows } = await client
          .from('stock_moves')
          .select('id, variant_id, location_id, qty, kind, ref, note, created_at')
          .order('created_at', { ascending: false })
          .limit(60);
        const locName = new Map(locations.map((l) => [l.id, l.name]));
        const varInfo = new Map(stock.map((s) => [s.variantId, s]));
        const moves: MoveRow[] = ((moveRows ?? []) as RawMove[]).map((m) => ({
          id: m.id,
          at: m.created_at,
          product: varInfo.get(m.variant_id)?.product ?? '—',
          sku: varInfo.get(m.variant_id)?.sku ?? null,
          location: locName.get(m.location_id) ?? '—',
          qty: m.qty,
          kind: m.kind,
          ref: m.ref,
          note: m.note,
        }));

        return {
          live: true,
          locations,
          stock,
          moves,
          totalUnits: stock.reduce((s, r) => s + r.total, 0),
          totalValue: stockValue(stock.map((r) => ({ onHand: r.total, cost: r.price }))),
          lowCount: stock.filter((r) => r.total > 0 && r.total <= LOW).length,
        };
      }
    } catch {
      /* fall through */
    }
  }

  const locations: LocationRow[] = [
    { id: 'L1', name: 'معرض الري', area: 'الري', is_active: true },
    { id: 'L2', name: 'مخزن الشويخ', area: 'الشويخ الصناعية', is_active: true },
  ];
  const stock: StockRow[] = [
    { variantId: 'v1', product: 'داش كام أزدوم M660', sku: 'CA-01001', barcode: '628055', price: 79, byLocation: { L1: 12, L2: 87 }, total: 99 },
    { variantId: 'v2', product: 'قفل ذكي S630 Max', sku: 'SH-01003', barcode: '628060', price: 59, byLocation: { L1: 8, L2: 53 }, total: 61 },
    { variantId: 'v3', product: 'بروجكتر K5 Pro', sku: 'TP-01002', barcode: null, price: 144.9, byLocation: { L1: 0, L2: 0 }, total: 0 },
  ];
  return {
    live: false,
    locations,
    stock,
    moves: [
      { id: 3, at: new Date().toISOString(), product: 'داش كام أزدوم M660', sku: 'CA-01001', location: 'معرض الري', qty: -1, kind: 'sale', ref: '#NT-100245', note: null },
      { id: 2, at: new Date().toISOString(), product: 'قفل ذكي S630 Max', sku: 'SH-01003', location: 'مخزن الشويخ', qty: 20, kind: 'purchase', ref: 'PO-1001', note: null },
    ],
    totalUnits: stock.reduce((s, r) => s + r.total, 0),
    totalValue: stockValue(stock.map((r) => ({ onHand: r.total, cost: r.price }))),
    lowCount: 1,
  };
}

interface VariantRow {
  id: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  sale_price: number | null;
  products: { name_ar: string } | null;
}
interface RawMove {
  id: number;
  variant_id: string;
  location_id: string;
  qty: number;
  kind: string;
  ref: string | null;
  note: string | null;
  created_at: string;
}

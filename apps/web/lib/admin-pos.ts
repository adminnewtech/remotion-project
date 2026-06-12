import 'server-only';

/**
 * Admin POS (cashier) product seam — flat sellable units for in-store sales.
 *
 * Loads active products with their primary (cheapest active) variant id, price,
 * sale price, sku, image and on-hand stock, so the cashier can ring up a sale.
 * First-party reads with sample fallback. Money is KWD (3 decimals).
 */
import { getServerClient } from '@/lib/supabase/server';

export interface PosProduct {
  variantId: string;
  productId: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  image: string | null;
  stock: number;
}

export interface PosDiscount {
  id: string;
  code: string;
  kind: 'percent' | 'amount' | 'free_delivery';
  value: number;
  minSubtotal: number;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  usedCount: number;
}

export interface PosShift {
  id: string;
  openingFloat: number;
  openedAt: string;
  cashSales: number;
  knetSales: number;
  orderCount: number;
}

export interface PosHold {
  id: string;
  orderNumber: string;
  total: number;
  itemCount: number;
  createdAt: string;
}

export interface PosData {
  live: boolean;
  products: PosProduct[];
  discounts: PosDiscount[];
  shift: PosShift | null;
}

/** Load everything the cashier screen needs: products, active discounts, open shift. */
export async function fetchPosData(): Promise<PosData> {
  const products = await fetchPosProducts();
  const client = await getServerClient();
  if (!client) {
    return { ...products, discounts: SAMPLE_DISCOUNTS, shift: null };
  }
  const [discounts, shift] = await Promise.all([fetchActiveDiscounts(client), fetchOpenShift(client)]);
  return { ...products, discounts, shift };
}

async function fetchActiveDiscounts(client: NonNullable<Awaited<ReturnType<typeof getServerClient>>>): Promise<PosDiscount[]> {
  try {
    const { data } = await client
      .from('discounts')
      .select('id, code, kind, value, min_subtotal, starts_at, ends_at, usage_limit, used_count')
      .eq('is_active', true)
      .limit(100);
    return ((data ?? []) as DiscountRow[]).map((d) => ({
      id: d.id,
      code: d.code,
      kind: d.kind,
      value: Number(d.value),
      minSubtotal: Number(d.min_subtotal ?? 0),
      startsAt: d.starts_at,
      endsAt: d.ends_at,
      usageLimit: d.usage_limit,
      usedCount: d.used_count ?? 0,
    }));
  } catch {
    return [];
  }
}

async function fetchOpenShift(client: NonNullable<Awaited<ReturnType<typeof getServerClient>>>): Promise<PosShift | null> {
  try {
    const { data: auth } = await client.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return null;
    const { data } = await client
      .from('pos_shifts')
      .select('id, opening_float, opened_at, cash_sales, knet_sales, order_count')
      .eq('cashier_id', uid)
      .eq('status', 'open')
      .maybeSingle();
    if (!data) return null;
    const s = data as ShiftRow;
    return {
      id: s.id,
      openingFloat: Number(s.opening_float),
      openedAt: s.opened_at,
      cashSales: Number(s.cash_sales ?? 0),
      knetSales: Number(s.knet_sales ?? 0),
      orderCount: s.order_count ?? 0,
    };
  } catch {
    return null;
  }
}

interface ProductsResult {
  live: boolean;
  products: PosProduct[];
}

export async function fetchPosProducts(): Promise<ProductsResult> {
  const client = await getServerClient();
  if (client) {
    try {
      const { data: products } = await client
        .from('products')
        .select('id, name_ar, name_en')
        .eq('is_active', true)
        .limit(400);

      if (products && products.length) {
        const pids = (products as ProductRow[]).map((p) => p.id);
        const [{ data: variants }, { data: media }] = await Promise.all([
          client.from('product_variants').select('id, product_id, sku, barcode, price, sale_price, is_active').in('product_id', pids),
          client.from('product_media').select('product_id, url, sort').in('product_id', pids).order('sort', { ascending: true }),
        ]);
        const vrows = (variants ?? []) as VariantRow[];
        const vids = vrows.map((v) => v.id);
        const stockBy = new Map<string, number>();
        if (vids.length) {
          const { data: inv } = await client.from('inventory').select('variant_id, on_hand').in('variant_id', vids);
          for (const i of (inv ?? []) as { variant_id: string; on_hand: number }[]) {
            stockBy.set(i.variant_id, (stockBy.get(i.variant_id) ?? 0) + (i.on_hand ?? 0));
          }
        }
        const imgBy = new Map<string, string>();
        for (const m of (media ?? []) as { product_id: string; url: string }[]) {
          if (!imgBy.has(m.product_id)) imgBy.set(m.product_id, m.url);
        }
        // Pick cheapest active variant per product.
        const cheapest = new Map<string, VariantRow>();
        for (const v of vrows) {
          if (v.is_active === false) continue;
          const eff = v.sale_price ?? v.price;
          const cur = cheapest.get(v.product_id);
          if (!cur || eff < (cur.sale_price ?? cur.price)) cheapest.set(v.product_id, v);
        }

        const rows: PosProduct[] = [];
        for (const p of products as ProductRow[]) {
          const v = cheapest.get(p.id);
          if (!v) continue;
          rows.push({
            variantId: v.id,
            productId: p.id,
            name: p.name_ar || p.name_en,
            sku: v.sku,
            barcode: v.barcode,
            price: v.sale_price ?? v.price,
            image: imgBy.get(p.id) ?? null,
            stock: stockBy.get(v.id) ?? 0,
          });
        }
        rows.sort((a, b) => b.stock - a.stock);
        return { live: true, products: rows };
      }
    } catch {
      /* fall through */
    }
  }
  return { live: false, products: SAMPLE };
}

const SAMPLE: PosProduct[] = [
  { variantId: 's1', productId: 'p1', name: 'داش كام أزدوم M660', sku: 'CA-01001', barcode: null, price: 79.0, image: null, stock: 99 },
  { variantId: 's2', productId: 'p2', name: 'قفل ذكي Smart Lock S630 Max', sku: 'SH-01003', barcode: null, price: 59.0, image: null, stock: 61 },
  { variantId: 's3', productId: 'p3', name: 'شاشة السينما المنزلية 100 انش', sku: 'TP-02004', barcode: null, price: 65.9, image: null, stock: 78 },
  { variantId: 's4', productId: 'p4', name: 'كيبل Mcdodo 4 في 1', sku: 'MA-01006', barcode: null, price: 3.95, image: null, stock: 107 },
  { variantId: 's5', productId: 'p5', name: 'شاحن سيارة 4 في 1', sku: 'CA-04002', barcode: null, price: 8.5, image: null, stock: 22 },
  { variantId: 's6', productId: 'p6', name: 'بروجكتر Xnano Ultra 360', sku: 'TP-01003', barcode: null, price: 89.9, image: null, stock: 0 },
];

interface ProductRow {
  id: string;
  name_ar: string;
  name_en: string;
}
interface VariantRow {
  id: string;
  product_id: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  sale_price: number | null;
  is_active: boolean;
}
interface DiscountRow {
  id: string;
  code: string;
  kind: 'percent' | 'amount' | 'free_delivery';
  value: number;
  min_subtotal: number | null;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  used_count: number;
}
interface ShiftRow {
  id: string;
  opening_float: number;
  opened_at: string;
  cash_sales: number | null;
  knet_sales: number | null;
  order_count: number;
}

const SAMPLE_DISCOUNTS: PosDiscount[] = [
  { id: 'd1', code: 'NEWTECH10', kind: 'percent', value: 10, minSubtotal: 0, startsAt: null, endsAt: null, usageLimit: null, usedCount: 0 },
  { id: 'd2', code: 'KW5', kind: 'amount', value: 5, minSubtotal: 25, startsAt: null, endsAt: null, usageLimit: null, usedCount: 0 },
];

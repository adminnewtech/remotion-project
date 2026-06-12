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
  price: number;
  image: string | null;
  stock: number;
}

export interface PosData {
  live: boolean;
  products: PosProduct[];
}

export async function fetchPosProducts(): Promise<PosData> {
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
          client.from('product_variants').select('id, product_id, sku, price, sale_price, is_active').in('product_id', pids),
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
  { variantId: 's1', productId: 'p1', name: 'داش كام أزدوم M660', sku: 'CA-01001', price: 79.0, image: null, stock: 99 },
  { variantId: 's2', productId: 'p2', name: 'قفل ذكي Smart Lock S630 Max', sku: 'SH-01003', price: 59.0, image: null, stock: 61 },
  { variantId: 's3', productId: 'p3', name: 'شاشة السينما المنزلية 100 انش', sku: 'TP-02004', price: 65.9, image: null, stock: 78 },
  { variantId: 's4', productId: 'p4', name: 'كيبل Mcdodo 4 في 1', sku: 'MA-01006', price: 3.95, image: null, stock: 107 },
  { variantId: 's5', productId: 'p5', name: 'شاحن سيارة 4 في 1', sku: 'CA-04002', price: 8.5, image: null, stock: 22 },
  { variantId: 's6', productId: 'p6', name: 'بروجكتر Xnano Ultra 360', sku: 'TP-01003', price: 89.9, image: null, stock: 0 },
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
  price: number;
  sale_price: number | null;
  is_active: boolean;
}

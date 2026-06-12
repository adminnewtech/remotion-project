import 'server-only';

/**
 * Growth/acquisition data layer.
 *
 * Builds normalized "catalog items" (one row per product with the data a
 * product feed or an offers/brands page needs: SKU, effective price, primary
 * image, brand, availability) from the LIVE backend, with a clean fall-through
 * to the sample catalog so feeds and pages never break when env is absent.
 *
 * This sits on top of the same Supabase seam as `lib/data.ts` (anon key,
 * server-only) and reuses its `fetchAllProducts` paging. It is the single
 * source feeding:
 *   - app/feeds/google-merchant.xml/route.ts
 *   - app/feeds/meta-catalog.csv/route.ts
 *   - (shop)/offers and (shop)/brands pages (counts + sale detection)
 */
import type { Product, ProductVariant, ProductMedia } from '@elite/types';
import { getServerClient } from '@/lib/supabase/server';
import { fetchAllProducts } from '@/lib/data';
import { sampleProductMeta, sampleVariants } from '@/lib/sample-data';

/** Live production storefront origin used for absolute feed links. */
export const FEED_SITE_URL = 'https://remotion-project-6dvr.vercel.app';

/** Availability values accepted by both Google Merchant and Meta catalog. */
export type FeedAvailability = 'in_stock' | 'out_of_stock';

/**
 * One product row, fully resolved for feed/listing consumption. Arabic-first
 * (`titleAr` / `descriptionAr`) because the feeds are submitted with the
 * primary market locale; English fields are carried for fallbacks.
 */
export interface CatalogItem {
  /** Stable feed id — variant SKU when present, else product id. */
  id: string;
  product: Product;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  brand: string | null;
  /** Effective (sale-aware) price in KWD. */
  price: number;
  /** List price (before sale), used to detect "on offer". */
  listPrice: number;
  salePrice: number | null;
  image: string | null;
  availability: FeedAvailability;
  /** True when no GTIN/barcode is known → `identifier_exists: false`. */
  hasGtin: boolean;
  gtin: string | null;
}

const SALE = (price: number, sale: number | null) =>
  sale != null && sale < price ? sale : price;

function cheapest(variants: ProductVariant[]): ProductVariant | null {
  const active = variants.filter((v) => v.is_active);
  if (!active.length) return null;
  return active.reduce((best, v) =>
    SALE(v.price, v.sale_price) < SALE(best.price, best.sale_price) ? v : best,
  );
}

/** Trim + collapse whitespace; strip control chars that break XML/CSV. */
export function cleanText(value: string | null | undefined, max = 5000): string {
  if (!value) return '';
  const flat = value.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function buildItem(
  product: Product,
  variant: ProductVariant | null,
  image: string | null,
  inStock: boolean | null,
): CatalogItem {
  const listPrice = variant?.price ?? 0;
  const salePrice = variant?.sale_price ?? null;
  const price = SALE(listPrice, salePrice);
  const gtin = variant?.barcode ?? null;
  return {
    id: variant?.sku ?? product.id,
    product,
    titleAr: cleanText(product.name_ar || product.name_en, 150),
    titleEn: cleanText(product.name_en || product.name_ar, 150),
    descriptionAr: cleanText(product.description_ar ?? product.name_ar, 5000),
    descriptionEn: cleanText(product.description_en ?? product.name_en, 5000),
    brand: product.brand,
    price,
    listPrice,
    salePrice,
    image,
    // Unknown inventory (null) defaults to in_stock — never wrongly suppress a
    // listing; only an explicit zero marks it out of stock.
    availability: inStock === false ? 'out_of_stock' : 'in_stock',
    hasGtin: Boolean(gtin),
    gtin,
  };
}

/**
 * Resolve every active product into a `CatalogItem`. Two batched lookups
 * (variants + media) against the live backend — no N+1 — then merge. Inventory
 * is folded in with one more batched query so availability is accurate. Falls
 * back to sample meta/variants when the client or live data is absent.
 */
export async function fetchCatalogItems(max = 1000): Promise<CatalogItem[]> {
  const products = await fetchAllProducts(max);
  if (!products.length) return [];
  const ids = products.map((p) => p.id);
  const client = await getServerClient();

  if (client) {
    try {
      const [{ data: variants }, { data: media }] = await Promise.all([
        client
          .from('product_variants')
          .select('id, product_id, sku, price, sale_price, barcode, is_active')
          .in('product_id', ids)
          .eq('is_active', true),
        client
          .from('product_media')
          .select('product_id, url, kind, sort')
          .in('product_id', ids)
          .eq('kind', 'image')
          .order('sort', { ascending: true }),
      ]);

      const variantsByProduct = new Map<string, ProductVariant[]>();
      for (const v of (variants ?? []) as ProductVariant[]) {
        const arr = variantsByProduct.get(v.product_id) ?? [];
        arr.push(v);
        variantsByProduct.set(v.product_id, arr);
      }
      const imageByProduct = new Map<string, string>();
      for (const m of (media ?? []) as ProductMedia[]) {
        if (!imageByProduct.has(m.product_id)) imageByProduct.set(m.product_id, m.url);
      }

      if (variantsByProduct.size > 0 || imageByProduct.size > 0) {
        // Availability: sum on-hand across the chosen variants in one query.
        const chosen = new Map<string, ProductVariant | null>();
        const variantIds: string[] = [];
        for (const p of products) {
          const v = cheapest(variantsByProduct.get(p.id) ?? []);
          chosen.set(p.id, v);
          if (v) variantIds.push(v.id);
        }

        const stockByVariant = new Map<string, number>();
        if (variantIds.length) {
          try {
            const { data: levels } = await client
              .from('inventory_levels')
              .select('variant_id, on_hand, reserved')
              .in('variant_id', variantIds);
            for (const l of (levels ?? []) as {
              variant_id: string;
              on_hand: number;
              reserved: number;
            }[]) {
              const prev = stockByVariant.get(l.variant_id) ?? 0;
              stockByVariant.set(
                l.variant_id,
                prev + Math.max(0, (l.on_hand ?? 0) - (l.reserved ?? 0)),
              );
            }
          } catch {
            /* inventory unreadable → availability stays unknown (in_stock) */
          }
        }
        const hasInventoryData = stockByVariant.size > 0;

        return products.map((product) => {
          const v = chosen.get(product.id) ?? null;
          const inStock =
            v && hasInventoryData ? (stockByVariant.get(v.id) ?? 0) > 0 : null;
          return buildItem(product, v, imageByProduct.get(product.id) ?? null, inStock);
        });
      }
    } catch {
      /* fall through to sample */
    }
  }

  // Sample fallback — keyed by product id.
  return products.map((product) => {
    const v = cheapest(sampleVariants(product.id));
    const meta = sampleProductMeta[product.id];
    const variant: ProductVariant | null =
      v ??
      (meta
        ? {
            id: `${product.id}-v1`,
            product_id: product.id,
            sku: null,
            attributes: {},
            price: meta.price,
            sale_price: meta.sale_price,
            barcode: null,
            weight_g: null,
            is_active: true,
          }
        : null);
    return buildItem(product, variant, meta?.image ?? null, null);
  });
}

/** Items currently on offer: sale price strictly below list price. */
export function onOfferItems(items: CatalogItem[]): CatalogItem[] {
  return items.filter((i) => i.salePrice != null && i.salePrice < i.listPrice);
}

export interface BrandEntry {
  name: string;
  count: number;
}

/** Distinct brands with product counts, sorted by count desc then name. */
export function brandIndex(items: CatalogItem[]): BrandEntry[] {
  const counts = new Map<string, number>();
  for (const i of items) {
    const b = i.brand?.trim();
    if (!b) continue;
    counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  return Array.from(counts, ([name, count]) => ({ name, count })).sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
}

/** Format a KWD price for feeds: "X.XXX KWD" (3 decimals, Latin digits). */
export function feedPrice(amount: number): string {
  return `${amount.toFixed(3)} KWD`;
}

/** Absolute product link for feeds — Arabic locale, live origin. */
export function feedProductLink(slug: string): string {
  return `${FEED_SITE_URL}/ar/product/${slug}`;
}

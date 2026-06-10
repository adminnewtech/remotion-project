/**
 * Product tile summaries — price + primary image for list/grid tiles.
 *
 * The `@elite/core` `listProducts` payload is intentionally lean (a `Product`
 * row only; no variants or media), so list screens have no price/image to show.
 * Rather than fire a `getProduct` per tile, this batches two lightweight reads
 * for a page of products:
 *   1. `product_variants` (price / sale_price) → lowest effective price/product
 *   2. `product_media`     (url, sort)         → first image/product
 *
 * Live mode hits Supabase directly (these are simple, RLS-scoped reads that
 * don't warrant new @elite/core surface); demo mode resolves from the sample
 * module so the storefront still looks complete offline.
 */
import { useQuery } from '@tanstack/react-query';
import type { Product, ProductMedia, ProductVariant } from '@elite/types';
import { getSupabase } from './supabase';
import { hasLiveBackend } from './env';
import { sampleMedia, sampleVariants } from './sampleData';

export interface ProductSummary {
  price: number;
  compareAt: number | null;
  image: string | null;
}

export type SummaryMap = Record<string, ProductSummary>;

/** The minimal variant shape the price reducer needs. */
type PriceRow = Pick<ProductVariant, 'product_id' | 'price' | 'sale_price'>;
type MediaRow = Pick<ProductMedia, 'product_id' | 'url' | 'sort'>;

/** Reduce variants/media rows into a per-product price + primary image map. */
function buildSummaries(
  productIds: string[],
  variants: PriceRow[],
  media: MediaRow[],
): SummaryMap {
  const variantsByProduct = new Map<string, PriceRow[]>();
  for (const v of variants) {
    const list = variantsByProduct.get(v.product_id) ?? [];
    list.push(v);
    variantsByProduct.set(v.product_id, list);
  }

  // First image per product (rows already ordered by sort asc).
  const imageByProduct = new Map<string, string>();
  for (const m of media) {
    if (!imageByProduct.has(m.product_id)) imageByProduct.set(m.product_id, m.url);
  }

  const out: SummaryMap = {};
  for (const id of productIds) {
    out[id] = {
      ...lowestEffective(variantsByProduct.get(id) ?? []),
      image: imageByProduct.get(id) ?? null,
    };
  }
  return out;
}

/** Lowest effective price (sale_price wins per variant) + its compare-at. */
function lowestEffective(variants: PriceRow[]): { price: number; compareAt: number | null } {
  if (variants.length === 0) return { price: 0, compareAt: null };
  let best = variants[0]!;
  let bestEff = best.sale_price ?? best.price;
  for (const v of variants) {
    const eff = v.sale_price ?? v.price;
    if (eff < bestEff) {
      best = v;
      bestEff = eff;
    }
  }
  return { price: bestEff, compareAt: best.sale_price != null ? best.price : null };
}

async function fetchSummaries(productIds: string[]): Promise<SummaryMap> {
  if (productIds.length === 0) return {};

  const client = getSupabase();
  if (!client || !hasLiveBackend) {
    // Demo mode: resolve from the sample catalog.
    const variants = productIds.flatMap((id) => sampleVariants(id));
    const media = productIds.flatMap((id) => sampleMedia(id));
    return buildSummaries(productIds, variants, media);
  }

  const [{ data: variants, error: vErr }, { data: media, error: mErr }] = await Promise.all([
    client
      .from('product_variants')
      .select('product_id, price, sale_price')
      .in('product_id', productIds)
      .eq('is_active', true),
    client
      .from('product_media')
      .select('product_id, url, sort')
      .in('product_id', productIds)
      .order('sort', { ascending: true }),
  ]);
  if (vErr) throw vErr;
  if (mErr) throw mErr;

  return buildSummaries(
    productIds,
    (variants ?? []) as PriceRow[],
    (media ?? []) as MediaRow[],
  );
}

/**
 * Tile price + image for a page of products. Keyed on the product id set so it
 * caches per page and refetches only when the set changes.
 */
export function useProductSummaries(products: Product[]) {
  const ids = products.map((p) => p.id);
  return useQuery<SummaryMap>({
    queryKey: ['product-summaries', ids],
    queryFn: () => fetchSummaries(ids),
    enabled: ids.length > 0,
    staleTime: 60_000,
  });
}

const EMPTY: ProductSummary = { price: 0, compareAt: null, image: null };

/** Safe lookup for a single product's summary. */
export function summaryFor(map: SummaryMap | undefined, productId: string): ProductSummary {
  return map?.[productId] ?? EMPTY;
}

import 'server-only';

/**
 * Server-side data layer.
 *
 * Each function tries the live `@elite/core` read against the request-scoped
 * Supabase client; when the client is absent (no env) OR the live read returns
 * nothing, it falls back to the clearly-marked sample data so pages always
 * render. This is the single seam between the app and the backend contract.
 */
import { catalog, orders, support } from '@elite/core';
import type {
  Category,
  Order,
  Product,
  ProductMedia,
  ProductVariant,
  ProductWithVariants,
  Review,
  Ticket,
} from '@elite/types';
import type { OrderWithItems, OrderTracking } from '@elite/core';
import { getServerClient } from '@/lib/supabase/server';
import {
  sampleCategories,
  sampleProducts,
  sampleProductMeta,
  sampleProductWithVariants,
  sampleReviews,
  sampleOrders,
  sampleOrderItems,
  sampleTasks,
  sampleTickets,
} from '@/lib/sample-data';
import type { ProductDisplay, ProductWithDisplay } from '@/lib/product-display';

export async function fetchCategories(): Promise<Category[]> {
  const client = await getServerClient();
  if (client) {
    try {
      const rows = await catalog.listCategories(client);
      if (rows.length) return rows;
    } catch {
      /* fall through to sample data */
    }
  }
  return sampleCategories;
}

export async function fetchProducts(params: {
  categoryId?: string;
  search?: string;
  brand?: string;
} = {}): Promise<Product[]> {
  const client = await getServerClient();
  if (client) {
    try {
      const res = await catalog.listProducts(client, params);
      if (res.items.length) return res.items;
    } catch {
      /* fall through */
    }
  }
  let items = sampleProducts;
  if (params.categoryId) items = items.filter((p) => p.category_id === params.categoryId);
  if (params.brand) items = items.filter((p) => p.brand === params.brand);
  if (params.search) {
    const q = params.search.toLowerCase();
    items = items.filter(
      (p) =>
        p.name_en.toLowerCase().includes(q) ||
        p.name_ar.includes(params.search!) ||
        (p.brand ?? '').toLowerCase().includes(q),
    );
  }
  return items;
}

/**
 * All active products, paged through fully — used by the sitemap. Capped so a
 * runaway catalog can't generate an unbounded sitemap in one request.
 */
export async function fetchAllProducts(max = 1000): Promise<Product[]> {
  const client = await getServerClient();
  if (client) {
    try {
      const pageSize = 200;
      const out: Product[] = [];
      for (let page = 1; out.length < max; page++) {
        const res = await catalog.listProducts(client, { page, pageSize });
        out.push(...res.items);
        if (res.items.length < pageSize || out.length >= res.total) break;
      }
      if (out.length) return out.slice(0, max);
    } catch {
      /* fall through */
    }
  }
  return sampleProducts;
}

export async function fetchProduct(slug: string): Promise<ProductWithVariants | null> {
  const client = await getServerClient();
  if (client) {
    try {
      const p = await catalog.getProduct(client, slug);
      if (p) return p;
    } catch {
      /* fall through */
    }
  }
  return sampleProductWithVariants(slug);
}

export async function fetchCategory(slug: string): Promise<Category | null> {
  const cats = await fetchCategories();
  return cats.find((c) => c.slug === slug) ?? null;
}

export async function fetchReviews(productId: string): Promise<Review[]> {
  // Reviews read isn't in the core contract surface; sample-only for v1 UI.
  return sampleReviews(productId);
}

export async function fetchOrders(): Promise<Order[]> {
  const client = await getServerClient();
  if (client) {
    try {
      const rows = await orders.listOrders(client);
      if (rows.length) return rows;
    } catch {
      /* fall through */
    }
  }
  return sampleOrders;
}

export async function fetchOrder(id: string): Promise<OrderWithItems | null> {
  const client = await getServerClient();
  if (client) {
    try {
      const o = await orders.getOrder(client, id);
      if (o) return o;
    } catch {
      /* fall through */
    }
  }
  const o = sampleOrders.find((x) => x.id === id);
  if (!o) return null;
  return { ...o, items: sampleOrderItems(id) };
}

export async function fetchTracking(id: string): Promise<OrderTracking | null> {
  const client = await getServerClient();
  if (client) {
    try {
      const tr = await orders.trackOrder(client, id);
      if (tr) return tr;
    } catch {
      /* fall through */
    }
  }
  const o = sampleOrders.find((x) => x.id === id);
  if (!o) return null;
  return { order: o, tasks: sampleTasks(id), driverLocation: null };
}

// ── Display enrichment ──────────────────────────────────────
//
// A bare `Product` row carries no price or image — those live in
// `product_variants` / `product_media`. To render catalog cards against LIVE
// data, we batch-load the cheapest active variant price and the primary image
// for a set of products in two queries (no N+1), then merge. When the client
// is absent we fall back to the sample meta keyed by product id.

const SALE = (v: { price: number; sale_price: number | null }) =>
  v.sale_price != null && v.sale_price < v.price ? v.sale_price : v.price;

/** Pick the variant with the lowest effective (sale-aware) price. */
function cheapestVariant(variants: ProductVariant[]): ProductVariant | null {
  if (!variants.length) return null;
  return variants.reduce((best, v) => (SALE(v) < SALE(best) ? v : best));
}

function sampleDisplay(productId: string): ProductDisplay {
  const m = sampleProductMeta[productId];
  return {
    image: m?.image ?? null,
    price: m?.price ?? 0,
    salePrice: m?.sale_price ?? null,
    rating: m?.rating,
    reviews: m?.reviews,
  };
}

/**
 * Enrich a list of products with display extras (price + primary image) using
 * two batched lookups against the live backend. Order is preserved.
 */
export async function withDisplay(products: Product[]): Promise<ProductWithDisplay[]> {
  if (!products.length) return [];
  const ids = products.map((p) => p.id);
  const client = await getServerClient();

  if (client) {
    try {
      const [{ data: variants }, { data: media }] = await Promise.all([
        client
          .from('product_variants')
          .select('product_id, price, sale_price, is_active')
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

      // Use live enrichment only if we actually got variant data back.
      if (variantsByProduct.size > 0 || imageByProduct.size > 0) {
        return products.map((product) => {
          const cheapest = cheapestVariant(variantsByProduct.get(product.id) ?? []);
          const display: ProductDisplay = {
            image: imageByProduct.get(product.id) ?? null,
            price: cheapest?.price ?? 0,
            salePrice: cheapest?.sale_price ?? null,
          };
          return { product, display };
        });
      }
    } catch {
      /* fall through to sample meta */
    }
  }

  return products.map((product) => ({ product, display: sampleDisplay(product.id) }));
}

/** Convenience: fetch products and their display extras together. */
export async function fetchProductsWithDisplay(
  params: { categoryId?: string; search?: string; brand?: string } = {},
): Promise<ProductWithDisplay[]> {
  const products = await fetchProducts(params);
  return withDisplay(products);
}

/** Related products: other active products in the same category. */
export async function fetchRelatedProducts(
  product: Product,
  limit = 4,
): Promise<ProductWithDisplay[]> {
  if (!product.category_id) return [];
  const siblings = (await fetchProducts({ categoryId: product.category_id }))
    .filter((p) => p.id !== product.id)
    .slice(0, limit);
  return withDisplay(siblings);
}

/**
 * Best-effort in-stock check for a product's variants. Sums on-hand across
 * inventory levels; returns `null` (unknown) when inventory isn't readable so
 * the UI can default to "in stock" rather than wrongly showing "out of stock".
 */
export async function fetchInStock(variantIds: string[]): Promise<boolean | null> {
  if (!variantIds.length) return null;
  const client = await getServerClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('inventory_levels')
      .select('variant_id, on_hand, reserved')
      .in('variant_id', variantIds);
    if (error || !data || data.length === 0) return null;
    const available = (data as { on_hand: number; reserved: number }[]).reduce(
      (n, r) => n + Math.max(0, (r.on_hand ?? 0) - (r.reserved ?? 0)),
      0,
    );
    return available > 0;
  } catch {
    return null;
  }
}

export async function fetchTickets(): Promise<Ticket[]> {
  const client = await getServerClient();
  if (client) {
    try {
      const rows = await support.listTickets(client);
      if (rows.length) return rows;
    } catch {
      /* fall through */
    }
  }
  return sampleTickets;
}

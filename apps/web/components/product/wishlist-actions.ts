'use server';

/**
 * Storefront wishlist server actions.
 *
 * All writes/reads go through the RLS-gated, request-scoped server client.
 * Auth is required — unsigned callers receive { ok: false, error: 'unauthenticated' }.
 * No fallback sample data: wishlist is user-specific and silently empty when
 * the client is absent (dev / missing env).
 */

import { getServerClient } from '@/lib/supabase/server';
import type { Product } from '@elite/types';

// ── Result shapes ───────────────────────────────────────────

export interface WishlistActionResult {
  ok: boolean;
  /** Present when action failed. */
  error?: string;
  /** True when the item is now in the wishlist (after toggle). */
  wishlisted?: boolean;
}

export interface WishlistItem {
  product_id: string;
  created_at: string;
  product: Pick<Product, 'id' | 'name_ar' | 'name_en' | 'slug' | 'brand'>;
  /** Resolved display extras (price + image). */
  price: number;
  sale_price: number | null;
  image: string | null;
}

// ── Actions ─────────────────────────────────────────────────

/**
 * Toggle the wishlist state for a product for the signed-in user.
 * Inserts if not present; deletes if present.
 */
export async function toggleWishlist({
  productId,
}: {
  productId: string;
}): Promise<WishlistActionResult> {
  const client = await getServerClient();
  if (!client) return { ok: false, error: 'no_client' };

  const { data: authData } = await client.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) return { ok: false, error: 'unauthenticated' };

  // Check existing
  const { data: existing, error: fetchErr } = await client
    .from('wishlist_items')
    .select('product_id')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: fetchErr.message };

  if (existing) {
    // Remove
    const { error: delErr } = await client
      .from('wishlist_items')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', productId);
    if (delErr) return { ok: false, error: delErr.message };
    return { ok: true, wishlisted: false };
  } else {
    // Add
    const { error: insErr } = await client
      .from('wishlist_items')
      .insert({ user_id: userId, product_id: productId });
    if (insErr) return { ok: false, error: insErr.message };
    return { ok: true, wishlisted: true };
  }
}

/**
 * Returns true when the given product is wishlisted by the signed-in user.
 * Returns false for unauthenticated callers or when the client is absent.
 */
export async function isWishlisted(productId: string): Promise<boolean> {
  const client = await getServerClient();
  if (!client) return false;

  const { data: authData } = await client.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) return false;

  const { data } = await client
    .from('wishlist_items')
    .select('product_id')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .maybeSingle();

  return !!data;
}

/**
 * Returns all wishlisted items for the signed-in user, enriched with the
 * product name/slug + cheapest-active-variant price + primary image.
 * Returns an empty array for unauthenticated callers.
 */
export async function listWishlist(): Promise<WishlistItem[]> {
  const client = await getServerClient();
  if (!client) return [];

  const { data: authData } = await client.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) return [];

  // Fetch wishlist rows with product info
  const { data: rows, error } = await client
    .from('wishlist_items')
    .select(
      `product_id, created_at,
       products:product_id ( id, name_ar, name_en, slug, brand )`,
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !rows || rows.length === 0) return [];

  const productIds = rows.map((r) => r.product_id as string);

  // Fetch cheapest active variant price per product
  const { data: variants } = await client
    .from('product_variants')
    .select('product_id, price, sale_price')
    .in('product_id', productIds)
    .eq('is_active', true);

  // Fetch primary image per product
  const { data: media } = await client
    .from('product_media')
    .select('product_id, url, kind, sort')
    .in('product_id', productIds)
    .eq('kind', 'image')
    .order('sort', { ascending: true });

  // Build lookup maps
  const priceMap = new Map<string, { price: number; sale_price: number | null }>();
  for (const v of variants ?? []) {
    const pid = v.product_id as string;
    const existing = priceMap.get(pid);
    const effective = (v.sale_price ?? v.price) as number;
    if (!existing || effective < (existing.sale_price ?? existing.price)) {
      priceMap.set(pid, {
        price: v.price as number,
        sale_price: v.sale_price as number | null,
      });
    }
  }

  const imageMap = new Map<string, string>();
  for (const m of media ?? []) {
    const pid = m.product_id as string;
    if (!imageMap.has(pid)) imageMap.set(pid, m.url as string);
  }

  return rows.map((row) => {
    const r = row as unknown as {
      product_id: string;
      created_at: string;
      products: Pick<Product, 'id' | 'name_ar' | 'name_en' | 'slug' | 'brand'>;
    };
    const pricing = priceMap.get(r.product_id);
    return {
      product_id: r.product_id,
      created_at: r.created_at,
      product: r.products,
      price: pricing?.price ?? 0,
      sale_price: pricing?.sale_price ?? null,
      image: imageMap.get(r.product_id) ?? null,
    };
  });
}

'use server';

/**
 * Catalog write actions — server actions invoked from the client list + form.
 *
 * `@elite/core` does not yet expose catalog mutations, so these perform the live
 * `client.from(...)` upsert/update directly when a Supabase client is present
 * and otherwise resolve as no-ops against the sample set (returning the
 * optimistic payload back). The shapes match the eventual `catalog.*` mutation
 * contract — call sites and payloads won't change when it lands. Each action
 * revalidates the catalog routes so the server data re-reads.
 */
import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/supabase/server';

export interface SyncCatalogResult {
  ok: boolean;
  live: boolean;
  created?: number;
  updated?: number;
  variants?: number;
  images?: number;
  error?: string;
}

/**
 * Pull the live Shopify catalog into our DB via the `sync-catalog` Edge
 * Function (idempotent; preserves our curated categories — see the function).
 * No backend → documented no-op. Revalidates the catalog routes on success.
 */
export async function syncCatalog(): Promise<SyncCatalogResult> {
  const client = await getServerClient();
  if (!client) return { ok: true, live: false };
  try {
    const { data, error } = await client.functions.invoke('sync-catalog', { body: {} });
    if (error) return { ok: false, live: true, error: error.message };
    const r = (data ?? {}) as Record<string, number>;
    revalidatePath('/[locale]/admin/catalog', 'page');
    return {
      ok: true,
      live: true,
      created: r.created ?? 0,
      updated: r.updated ?? 0,
      variants: r.variants ?? 0,
      images: r.images ?? 0,
    };
  } catch (e) {
    return { ok: false, live: true, error: e instanceof Error ? e.message : 'unknown' };
  }
}

export interface ProductInput {
  id?: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  brand: string | null;
  category_id: string | null;
  slug: string;
  is_active: boolean;
  requires_installation: boolean;
  installation_fee: number;
  warranty_months: number;
}

export interface SaveResult {
  ok: boolean;
  id: string;
  live: boolean;
  error?: string;
}

function revalidate() {
  revalidatePath('/[locale]/admin/catalog', 'page');
  revalidatePath('/[locale]/admin/catalog/inventory', 'page');
}

/** Create or update a product. Returns the persisted (or echoed) id. */
export async function saveProduct(input: ProductInput): Promise<SaveResult> {
  const client = await getServerClient();
  if (client) {
    try {
      const row = {
        name_ar: input.name_ar,
        name_en: input.name_en,
        description_ar: input.description_ar,
        description_en: input.description_en,
        brand: input.brand,
        category_id: input.category_id,
        slug: input.slug,
        is_active: input.is_active,
        requires_installation: input.requires_installation,
        installation_fee: input.installation_fee,
        warranty_months: input.warranty_months,
      };
      if (input.id) {
        const { error } = await client.from('products').update(row).eq('id', input.id);
        if (error) throw error;
        revalidate();
        return { ok: true, id: input.id, live: true };
      }
      const { data, error } = await client.from('products').insert(row).select('id').single();
      if (error) throw error;
      revalidate();
      return { ok: true, id: (data as { id: string }).id, live: true };
    } catch (e) {
      return { ok: false, id: input.id ?? '', live: true, error: (e as Error).message };
    }
  }
  // No backend: echo back a synthetic id so the optimistic UI completes.
  return { ok: true, id: input.id ?? `new-${Date.now()}`, live: false };
}

/** Toggle published/hidden state for one product. */
export async function setProductActive(id: string, isActive: boolean): Promise<SaveResult> {
  const client = await getServerClient();
  if (client) {
    try {
      const { error } = await client.from('products').update({ is_active: isActive }).eq('id', id);
      if (error) throw error;
      revalidate();
      return { ok: true, id, live: true };
    } catch (e) {
      return { ok: false, id, live: true, error: (e as Error).message };
    }
  }
  return { ok: true, id, live: false };
}

/** Bulk publish/hide. */
export async function setProductsActive(ids: string[], isActive: boolean): Promise<SaveResult> {
  const client = await getServerClient();
  if (client && ids.length) {
    try {
      const { error } = await client.from('products').update({ is_active: isActive }).in('id', ids);
      if (error) throw error;
      revalidate();
      return { ok: true, id: '', live: true };
    } catch (e) {
      return { ok: false, id: '', live: true, error: (e as Error).message };
    }
  }
  return { ok: true, id: '', live: false };
}

/** Set the on-hand quantity for a single inventory variant. */
export async function adjustInventory(variantId: string, onHand: number): Promise<SaveResult> {
  const client = await getServerClient();
  if (client) {
    try {
      const { error } = await client
        .from('inventory_levels')
        .update({ on_hand: Math.max(0, Math.round(onHand)) })
        .eq('variant_id', variantId);
      if (error) throw error;
      revalidate();
      return { ok: true, id: variantId, live: true };
    } catch (e) {
      return { ok: false, id: variantId, live: true, error: (e as Error).message };
    }
  }
  return { ok: true, id: variantId, live: false };
}

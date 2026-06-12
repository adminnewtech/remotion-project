'use server';

import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/supabase/server';

export interface BundleInput {
  productId: string;
  bundlePrice: number;
  components: {
    component: 'variant' | 'service';
    variantId?: string;
    service?: 'installation' | 'inspection';
    qty: number;
    pricePart: number;
  }[];
}

export interface BundleResult {
  ok: boolean;
  id: string;
  live: boolean;
  error?: string;
}

function revalidate() {
  revalidatePath('/[locale]/admin/catalog/bundles', 'page');
}

export async function createBundle(input: BundleInput): Promise<BundleResult> {
  const sb = await getServerClient();
  if (!sb) return { ok: true, id: `bundle-${Date.now()}`, live: false };

  try {
    // Derive name from product
    const { data: product } = await sb
      .from('products')
      .select('name')
      .eq('id', input.productId)
      .maybeSingle();

    const { data: bundle, error: bundleErr } = await sb
      .from('product_bundles')
      .insert({
        product_id: input.productId,
        name: (product as { name: string } | null)?.name ?? 'باقة',
        bundle_price: input.bundlePrice,
        is_active: true,
      })
      .select('id')
      .single();

    if (bundleErr) throw new Error(bundleErr.message);

    const bundleId = (bundle as { id: string }).id;

    const componentRows = input.components.map((c) => ({
      bundle_id: bundleId,
      component: c.component,
      variant_id: c.variantId ?? null,
      service: c.service ?? null,
      qty: c.qty,
      price_part: c.pricePart,
    }));

    const { error: compErr } = await sb.from('bundle_components').insert(componentRows);
    if (compErr) throw new Error(compErr.message);

    revalidate();
    return { ok: true, id: bundleId, live: true };
  } catch (e) {
    return { ok: false, id: '', live: true, error: (e as Error).message };
  }
}

export async function setBundleActive(id: string, isActive: boolean): Promise<BundleResult> {
  const sb = await getServerClient();
  if (!sb) return { ok: true, id, live: false };

  try {
    const { error } = await sb
      .from('product_bundles')
      .update({ is_active: isActive })
      .eq('id', id);
    if (error) throw new Error(error.message);
    revalidate();
    return { ok: true, id, live: true };
  } catch (e) {
    return { ok: false, id, live: true, error: (e as Error).message };
  }
}

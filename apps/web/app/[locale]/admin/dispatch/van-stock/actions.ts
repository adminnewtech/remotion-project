'use server';

import { getServerClient } from '@/lib/supabase/server';

export interface TransferStockResult {
  ok: boolean;
  live: boolean;
  error?: string;
}

/**
 * Transfer stock from a source warehouse to a van location.
 * Calls the `transfer_stock` RPC (from migration 0019).
 *
 * transfer_stock(
 *   p_variant_id uuid,
 *   p_from_location uuid,
 *   p_to_location uuid,
 *   p_qty int,
 *   p_ref text
 * )
 */
export async function transferToVan(params: {
  variantId: string;
  fromLocationId: string;
  toLocationId: string;
  qty: number;
  ref?: string;
}): Promise<TransferStockResult> {
  const sb = await getServerClient();
  if (!sb) return { ok: true, live: false };

  const { variantId, fromLocationId, toLocationId, qty, ref } = params;

  if (qty <= 0) return { ok: false, live: true, error: 'الكمية يجب أن تكون أكبر من صفر' };

  try {
    const { error } = await sb.rpc('transfer_stock', {
      p_variant_id: variantId,
      p_from_location: fromLocationId,
      p_to_location: toLocationId,
      p_qty: qty,
      p_ref: ref ?? 'van-load',
    });
    if (error) return { ok: false, live: true, error: error.message };
    return { ok: true, live: true };
  } catch (e) {
    return { ok: false, live: true, error: e instanceof Error ? e.message : 'unknown' };
  }
}

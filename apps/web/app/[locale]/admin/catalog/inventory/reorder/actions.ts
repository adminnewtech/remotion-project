'use server';

import { getServerClient } from '@/lib/supabase/server';

export interface GenerateReorderPosResult {
  ok: boolean;
  live: boolean;
  poIds?: string[];
  count?: number;
  error?: string;
}

/**
 * Generate draft purchase orders for all variants at/below min_qty
 * at the given location — calls the `generate_reorder_pos` RPC.
 */
export async function generateReorderPos(
  locationId: string,
): Promise<GenerateReorderPosResult> {
  const sb = await getServerClient();
  if (!sb) return { ok: true, live: false };

  try {
    const { data, error } = await sb.rpc('generate_reorder_pos', {
      p_location: locationId,
    });
    if (error) return { ok: false, live: true, error: error.message };
    const ids = Array.isArray(data) ? (data as string[]) : [];
    return { ok: true, live: true, poIds: ids, count: ids.length };
  } catch (e) {
    return { ok: false, live: true, error: e instanceof Error ? e.message : 'unknown' };
  }
}

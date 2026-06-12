'use server';

import { getServerClient } from '@/lib/supabase/server';

export interface PostCycleCountResult {
  ok: boolean;
  live: boolean;
  moves?: number;
  error?: string;
}

/**
 * Post a cycle count in 'review' status — calls the `post_cycle_count` RPC
 * which applies stock adjustment moves for all counted variances.
 */
export async function postCycleCount(countId: string): Promise<PostCycleCountResult> {
  const sb = await getServerClient();
  if (!sb) return { ok: true, live: false };

  try {
    const { data, error } = await sb.rpc('post_cycle_count', { p_count: countId });
    if (error) return { ok: false, live: true, error: error.message };
    return { ok: true, live: true, moves: data as number };
  } catch (e) {
    return { ok: false, live: true, error: e instanceof Error ? e.message : 'unknown' };
  }
}

export interface CreateCycleCountResult {
  ok: boolean;
  live: boolean;
  id?: string;
  error?: string;
}

/**
 * Create a new draft cycle count for a location.
 */
export async function createCycleCount(
  locationId: string,
  note?: string,
): Promise<CreateCycleCountResult> {
  const sb = await getServerClient();
  if (!sb) return { ok: false, live: false, error: 'no backend' };

  try {
    const { data, error } = await sb
      .from('cycle_counts')
      .insert({ location_id: locationId, note: note ?? null, status: 'draft' })
      .select('id')
      .single();
    if (error) return { ok: false, live: true, error: error.message };
    return { ok: true, live: true, id: (data as { id: string }).id };
  } catch (e) {
    return { ok: false, live: true, error: e instanceof Error ? e.message : 'unknown' };
  }
}

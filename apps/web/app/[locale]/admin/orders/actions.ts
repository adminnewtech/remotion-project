'use server';

/**
 * Orders server actions (OSALPHA gold).
 *
 * `setOrderStatus` mutates `orders.status` through the request-scoped,
 * RLS-gated Supabase client. `@elite/core` has no orders write in its contract
 * surface yet, so we write the column directly here. When the backend is absent
 * (sample mode) it is a documented no-op returning `{ live: false }` — the
 * client keeps its optimistic value and shows the success toast either way.
 */
import type { OrderStatus } from '@elite/types';
import { getServerClient } from '@/lib/supabase/server';

export interface SetOrderStatusResult {
  ok: boolean;
  /** Whether the write actually hit the backend. */
  live: boolean;
  error?: string;
}

export async function setOrderStatus(
  id: string,
  status: OrderStatus,
): Promise<SetOrderStatusResult> {
  const client = await getServerClient();
  if (!client) {
    // Sample mode: no backend to persist to. Optimistic UI stands.
    return { ok: true, live: false };
  }
  try {
    const { error } = await client.from('orders').update({ status }).eq('id', id);
    if (error) return { ok: false, live: true, error: error.message };
    return { ok: true, live: true };
  } catch (e) {
    return { ok: false, live: true, error: e instanceof Error ? e.message : 'unknown' };
  }
}

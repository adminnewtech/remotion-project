'use server';

/**
 * Landed costs server actions.
 * addPoCost  — inserts a cost line into po_costs (KWD numeric(12,3)).
 * allocateLandedCosts — calls the allocate_landed_costs(uuid) RPC which writes
 *   landed_unit_cost back to all purchase_order_items for the given PO.
 */
import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/supabase/server';
import { round3 } from '@/lib/pure/money';
import type { CostKind, CostAllocation } from '@/lib/admin-landed-costs';

export interface CostActionResult {
  ok: boolean;
  live: boolean;
  error?: string;
}

function done(live: boolean, error?: string): CostActionResult {
  if (!error) revalidatePath('/[locale]/admin/purchasing/costs', 'page');
  return { ok: !error, live, error };
}

export async function addPoCost(
  poId: string,
  kind: CostKind,
  amount: number,
  allocation: CostAllocation,
  note: string | null,
): Promise<CostActionResult> {
  if (!poId) return { ok: false, live: false, error: 'missing_po' };
  const validKinds: CostKind[] = ['freight', 'customs', 'clearance', 'other'];
  if (!validKinds.includes(kind)) return { ok: false, live: false, error: 'invalid_kind' };
  const rounded = round3(amount);
  if (rounded < 0) return { ok: false, live: false, error: 'negative_amount' };

  const client = await getServerClient();
  if (!client) return done(false);

  const { error } = await client.from('po_costs').insert({
    po_id: poId,
    kind,
    amount: rounded,
    allocation,
    note: note?.trim() || null,
  } as never);

  return done(true, error?.message);
}

export async function allocateLandedCosts(poId: string): Promise<CostActionResult> {
  if (!poId) return { ok: false, live: false, error: 'missing_po' };

  const client = await getServerClient();
  if (!client) return done(false);

  const { error } = await client.rpc('allocate_landed_costs', { p_po: poId });
  return done(true, error?.message);
}

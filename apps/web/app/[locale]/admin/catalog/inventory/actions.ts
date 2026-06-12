'use server';

/**
 * Inventory suite server actions — every on-hand change goes through the
 * ATOMIC SQL functions from migration 0019 (apply_stock_move / transfer_stock)
 * so the immutable ledger and stock never drift. Ops-gated by RLS + definer
 * checks. Sample mode → documented no-ops.
 */
import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/supabase/server';

export interface InvActionResult {
  ok: boolean;
  live: boolean;
  error?: string;
}

function done(live: boolean, error?: string): InvActionResult {
  if (!error) revalidatePath('/[locale]/admin/catalog/inventory', 'page');
  return { ok: !error, live, error };
}

/** Signed adjustment with a required reason (shrinkage/count/damage/…). */
export async function adjustStock(
  variantId: string,
  locationId: string,
  qty: number,
  reason: string,
): Promise<InvActionResult> {
  if (!Number.isInteger(qty) || qty === 0) return { ok: false, live: false, error: 'qty' };
  if (!reason.trim()) return { ok: false, live: false, error: 'reason' };
  const client = await getServerClient();
  if (!client) return done(false);
  const { error } = await client.rpc('apply_stock_move', {
    p_variant: variantId,
    p_location: locationId,
    p_qty: qty,
    p_kind: 'adjustment',
    p_ref: null,
    p_batch: null,
    p_note: reason.trim(),
  });
  return done(true, error?.message);
}

/** Atomic transfer between locations (two ledger rows, one tx). */
export async function transferStock(
  variantId: string,
  fromId: string,
  toId: string,
  qty: number,
): Promise<InvActionResult> {
  if (!Number.isInteger(qty) || qty <= 0) return { ok: false, live: false, error: 'qty' };
  if (fromId === toId) return { ok: false, live: false, error: 'same' };
  const client = await getServerClient();
  if (!client) return done(false);
  const { error } = await client.rpc('transfer_stock', {
    p_variant: variantId,
    p_from: fromId,
    p_to: toId,
    p_qty: qty,
    p_note: null,
  });
  return done(true, error?.message);
}

/** Add a stock location (store/warehouse/van). */
export async function addLocation(name: string, area: string | null): Promise<InvActionResult> {
  if (!name.trim()) return { ok: false, live: false, error: 'name' };
  const client = await getServerClient();
  if (!client) return done(false);
  const { error } = await client.from('locations').insert({ name: name.trim(), area });
  return done(true, error?.message);
}

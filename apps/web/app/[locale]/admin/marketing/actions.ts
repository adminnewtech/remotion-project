'use server';

/**
 * Marketing server actions — native discount-code CRUD over the existing
 * `discounts` table (checkout already honors codes; this adds ops management).
 * Admin-gated by RLS. Sample mode → documented no-ops.
 */
import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/supabase/server';

export interface DiscountActionResult {
  ok: boolean;
  live: boolean;
  error?: string;
}

function done(live: boolean, error?: string): DiscountActionResult {
  if (!error) revalidatePath('/[locale]/admin/marketing', 'page');
  return { ok: !error, live, error };
}

export async function createDiscount(
  code: string,
  kind: 'percent' | 'fixed',
  value: number,
  minSubtotal: number,
  usageLimit: number | null,
): Promise<DiscountActionResult> {
  const clean = code.trim().toUpperCase();
  if (!clean || !Number.isFinite(value) || value <= 0) return { ok: false, live: false, error: 'input' };
  const client = await getServerClient();
  if (!client) return done(false);
  const { error } = await client.from('discounts').insert({
    code: clean,
    kind,
    value,
    min_subtotal: Math.max(0, minSubtotal || 0),
    usage_limit: usageLimit && usageLimit > 0 ? usageLimit : null,
    is_active: true,
  });
  return done(true, error?.message);
}

export async function setDiscountActive(id: string, active: boolean): Promise<DiscountActionResult> {
  const client = await getServerClient();
  if (!client) return done(false);
  const { error } = await client.from('discounts').update({ is_active: active }).eq('id', id);
  return done(true, error?.message);
}

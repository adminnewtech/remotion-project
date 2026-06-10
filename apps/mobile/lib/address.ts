/**
 * Address helpers for checkout.
 *
 * The `checkout` Edge Function needs a real `addresses.id`, so before invoking
 * it we persist the Kuwait address the customer entered and pass back the new
 * row id. (@elite/core has no address surface yet, and this is a simple,
 * RLS-scoped insert, so we hit Supabase directly here.)
 */
import type { Address } from '@elite/types';
import { getSupabase } from './supabase';

export interface KuwaitAddressInput {
  governorate?: string;
  area: string;
  block?: string;
  street?: string;
  building?: string;
  floor?: string;
  apartment?: string;
  extraDirections?: string;
  label?: string;
}

/**
 * Insert a Kuwait address for the signed-in user and return its id.
 * Used by checkout to obtain a valid `address_id` for the order.
 */
export async function createAddress(userId: string, input: KuwaitAddressInput): Promise<string> {
  const client = getSupabase();
  if (!client) throw new Error('createAddress: backend unavailable.');

  const { data, error } = await client
    .from('addresses')
    .insert({
      user_id: userId,
      label: input.label ?? null,
      governorate: input.governorate ?? null,
      area: input.area,
      block: input.block ?? null,
      street: input.street ?? null,
      building: input.building ?? null,
      floor: input.floor ?? null,
      apartment: input.apartment ?? null,
      extra_directions: input.extraDirections ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as Pick<Address, 'id'>).id;
}

/**
 * Convert a slot label like "14:00 – 16:00" into ISO start/end timestamps for
 * the chosen day (defaults to today). Falls back to a 2-hour window from now
 * when the label can't be parsed.
 */
export function slotToWindow(
  label: string,
  day: Date = new Date(),
): { start: string; end: string } {
  const match = label.match(/(\d{1,2}):(\d{2}).*?(\d{1,2}):(\d{2})/);
  const base = new Date(day);
  if (!match) {
    const start = new Date(base);
    const end = new Date(base.getTime() + 2 * 60 * 60 * 1000);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  const [, sh, sm, eh, em] = match;
  const start = new Date(base);
  start.setHours(Number(sh), Number(sm), 0, 0);
  const end = new Date(base);
  end.setHours(Number(eh), Number(em), 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

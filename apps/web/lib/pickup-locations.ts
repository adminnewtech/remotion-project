/**
 * Storefront read helper: showroom locations that offer in-store pickup
 * (`locations.allows_pickup = true`, migration 0030). Used by the checkout
 * pickup picker. Runs against the caller's (anon/customer) Supabase client, so
 * it depends on an RLS read policy that exposes pickup-enabled locations to the
 * storefront — see the SQL noted in the PR if the picker comes back empty.
 */
import type { EliteClient } from '@elite/core';

export interface PickupLocation {
  id: string;
  name: string;
  area: string | null;
}

/**
 * Fetch active showroom locations that allow pickup, ordered by name. Returns
 * `[]` on any error so the checkout page always renders (seam rule #3).
 */
export async function listPickupLocations(client: EliteClient): Promise<PickupLocation[]> {
  try {
    const { data, error } = await client
      .from('locations')
      .select('id, name, area')
      .eq('allows_pickup', true)
      .eq('is_active', true)
      .order('name');
    if (error || !data) return [];
    return data as unknown as PickupLocation[];
  } catch {
    return [];
  }
}

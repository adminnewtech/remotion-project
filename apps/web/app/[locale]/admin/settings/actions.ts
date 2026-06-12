'use server';

/**
 * Settings server actions (OSALPHA gold) — admin-only, first-party config.
 *
 * All writes go through the request-scoped, RLS-gated client (admin by policy).
 * Sample mode (no env) → documented no-ops. Routes are revalidated so reads
 * refresh.
 */
import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/supabase/server';
import type { StoreSettings } from '@/lib/admin-settings';

export interface SettingsActionResult {
  ok: boolean;
  live: boolean;
  id?: string;
  error?: string;
}

export async function saveSettings(patch: Partial<StoreSettings>): Promise<SettingsActionResult> {
  const client = await getServerClient();
  if (!client) return { ok: true, live: false };
  try {
    const { error } = await client.from('app_settings').update({ ...patch }).eq('id', 1);
    if (error) return { ok: false, live: true, error: error.message };
    revalidatePath('/[locale]/admin/settings', 'page');
    return { ok: true, live: true };
  } catch (e) {
    return { ok: false, live: true, error: e instanceof Error ? e.message : 'unknown' };
  }
}

export interface ZoneInput {
  id?: string;
  governorate: string;
  area: string | null;
  fee: number;
  eta_hours: number;
  is_active: boolean;
  sort: number;
}

export async function upsertZone(zone: ZoneInput): Promise<SettingsActionResult> {
  const client = await getServerClient();
  if (!client) return { ok: true, live: false, id: zone.id ?? `tmp-${Date.now()}` };
  try {
    const payload = {
      governorate: zone.governorate,
      area: zone.area,
      fee: zone.fee,
      eta_hours: zone.eta_hours,
      is_active: zone.is_active,
      sort: zone.sort,
    };
    if (zone.id && zone.id.length === 36) {
      const { error } = await client.from('delivery_zones').update(payload).eq('id', zone.id);
      if (error) return { ok: false, live: true, error: error.message };
      revalidatePath('/[locale]/admin/settings', 'page');
      return { ok: true, live: true, id: zone.id };
    }
    const { data, error } = await client.from('delivery_zones').insert(payload).select('id').single();
    if (error) return { ok: false, live: true, error: error.message };
    revalidatePath('/[locale]/admin/settings', 'page');
    return { ok: true, live: true, id: (data as { id: string }).id };
  } catch (e) {
    return { ok: false, live: true, error: e instanceof Error ? e.message : 'unknown' };
  }
}

export async function deleteZone(id: string): Promise<SettingsActionResult> {
  const client = await getServerClient();
  if (!client) return { ok: true, live: false };
  try {
    const { error } = await client.from('delivery_zones').delete().eq('id', id);
    if (error) return { ok: false, live: true, error: error.message };
    revalidatePath('/[locale]/admin/settings', 'page');
    return { ok: true, live: true, id };
  } catch (e) {
    return { ok: false, live: true, error: e instanceof Error ? e.message : 'unknown' };
  }
}

'use server';

/**
 * Staff server actions (OSALPHA gold) — native role management.
 *
 * `setStaffRole` updates a profile's `role`; `setStaffActive` toggles activation;
 * `assignRoleByPhone` is the native "invite": it finds an already-registered
 * profile by phone and grants it a staff role (a person signs up via auth, then
 * an admin promotes them — no third-party HR system). All writes go through the
 * request-scoped, RLS-gated client (admin-only by policy). Sample mode → no-op.
 */
import type { UserRole } from '@elite/types';
import { getServerClient } from '@/lib/supabase/server';

export interface StaffActionResult {
  ok: boolean;
  live: boolean;
  /** Resolved profile id (assignRoleByPhone). */
  id?: string;
  error?: string;
}

export async function setStaffRole(id: string, role: UserRole): Promise<StaffActionResult> {
  const client = await getServerClient();
  if (!client) return { ok: true, live: false };
  try {
    const { error } = await client.from('profiles').update({ role }).eq('id', id);
    if (error) return { ok: false, live: true, error: error.message };
    return { ok: true, live: true, id };
  } catch (e) {
    return { ok: false, live: true, error: e instanceof Error ? e.message : 'unknown' };
  }
}

export async function setStaffActive(id: string, isActive: boolean): Promise<StaffActionResult> {
  const client = await getServerClient();
  if (!client) return { ok: true, live: false };
  try {
    const { error } = await client.from('profiles').update({ is_active: isActive }).eq('id', id);
    if (error) return { ok: false, live: true, error: error.message };
    return { ok: true, live: true, id };
  } catch (e) {
    return { ok: false, live: true, error: e instanceof Error ? e.message : 'unknown' };
  }
}

/** Native invite: promote an existing (registered) profile, matched by phone. */
export async function assignRoleByPhone(
  phone: string,
  role: UserRole,
): Promise<StaffActionResult> {
  const client = await getServerClient();
  if (!client) return { ok: true, live: false };
  try {
    const normalized = phone.replace(/\s+/g, '');
    const { data, error } = await client
      .from('profiles')
      .select('id')
      .eq('phone', normalized)
      .maybeSingle();
    if (error) return { ok: false, live: true, error: error.message };
    if (!data) {
      return { ok: false, live: true, error: 'no_profile_for_phone' };
    }
    const id = (data as { id: string }).id;
    const { error: upErr } = await client.from('profiles').update({ role }).eq('id', id);
    if (upErr) return { ok: false, live: true, error: upErr.message };
    return { ok: true, live: true, id };
  } catch (e) {
    return { ok: false, live: true, error: e instanceof Error ? e.message : 'unknown' };
  }
}

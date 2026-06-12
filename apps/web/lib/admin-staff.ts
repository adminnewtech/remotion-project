import 'server-only';

/**
 * Admin staff data seam (OSALPHA gold) — native user/role management.
 *
 * Lists the team from `profiles` (staff roles only) through the request-scoped,
 * RLS-gated client, and derives each field member's utilization from their live
 * count of active fulfillment tasks. Onboarding is native: a person registers
 * (auth) and an admin assigns them a staff role via the `setStaffRole` action —
 * no Zoho/third-party HR. Sample fallback keeps the page rendering with no env.
 */
import type { TaskStatus, UserRole } from '@elite/types';
import { getServerClient } from '@/lib/supabase/server';
import { staff as sampleStaff } from '@/lib/admin-sample';

export interface StaffMember {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  role: UserRole;
  zone: string;
  is_active: boolean;
  /** Active tasks (field staff only). */
  activeTasks: number;
  utilization: number;
}

export interface StaffData {
  live: boolean;
  members: StaffMember[];
}

const STAFF_ROLES: UserRole[] = ['admin', 'employee', 'technician', 'driver'];
const ACTIVE: TaskStatus[] = ['assigned', 'accepted', 'en_route', 'arrived', 'in_progress'];

/** Live team list with real per-member task utilization; sample fallback. */
export async function fetchStaff(): Promise<StaffData> {
  const client = await getServerClient();
  if (client) {
    try {
      const { data: rows } = await client
        .from('profiles')
        .select('id, full_name, phone, email, role, is_active')
        .in('role', STAFF_ROLES)
        .order('role', { ascending: true });

      if (rows && rows.length) {
        const { data: tasks } = await client
          .from('fulfillment_tasks')
          .select('assignee_id, status')
          .not('assignee_id', 'is', null);
        const activeBy = new Map<string, number>();
        for (const tk of (tasks ?? []) as { assignee_id: string | null; status: TaskStatus }[]) {
          if (tk.assignee_id && ACTIVE.includes(tk.status)) {
            activeBy.set(tk.assignee_id, (activeBy.get(tk.assignee_id) ?? 0) + 1);
          }
        }
        const members: StaffMember[] = (rows as ProfileRow[]).map((p) => {
          const active = activeBy.get(p.id) ?? 0;
          return {
            id: p.id,
            full_name: p.full_name ?? '—',
            phone: p.phone,
            email: p.email,
            role: p.role as UserRole,
            zone: '—',
            is_active: p.is_active,
            activeTasks: active,
            utilization: Math.min(100, active * 25),
          };
        });
        return { live: true, members };
      }
    } catch {
      /* fall through */
    }
  }
  return {
    live: false,
    members: sampleStaff.map((s) => ({
      id: s.id,
      full_name: s.full_name ?? '—',
      phone: s.phone,
      email: s.email,
      role: s.role,
      zone: s.zone ?? '—',
      is_active: s.is_active,
      activeTasks: 0,
      utilization: s.utilization ?? 0,
    })),
  };
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: string;
  is_active: boolean;
}

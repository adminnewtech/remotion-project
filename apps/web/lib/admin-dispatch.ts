import 'server-only';

/**
 * Admin dispatch data seam (OSALPHA gold) — native, no third-party logistics.
 *
 * Reads live `fulfillment_tasks` (with the embedded order number + customer)
 * and the field staff (`profiles` where role is driver/technician) through the
 * request-scoped, RLS-gated Supabase client. Staff utilization is a REAL metric
 * derived from each member's count of active (assigned…in_progress) tasks. When
 * the client is absent (no env) or a live read is empty, every section falls
 * back to the clearly-marked sample set so the board always renders.
 *
 * Reassignment is performed by the `reassignTask` server action (see
 * ./[locale]/admin/dispatch/actions.ts), which writes `assignee_id` + `status`
 * directly through the same RLS-gated client.
 */
import type { FulfillmentType, TaskStatus } from '@elite/types';
import { getServerClient } from '@/lib/supabase/server';
import { dispatchTasks, staff as sampleStaff } from '@/lib/admin-sample';

// ── View shapes ─────────────────────────────────────────────

export interface DispatchTask {
  id: string;
  orderNumber: string;
  customer: string;
  area: string | null;
  scheduled_for: string | null;
  type: FulfillmentType;
  status: TaskStatus;
  assignee_id: string | null;
}

export interface DispatchStaff {
  id: string;
  full_name: string;
  role: 'driver' | 'technician';
  zone: string;
  /** Active tasks currently on this member's plate. */
  activeTasks: number;
  /** 0–100 heuristic from active task load. */
  utilization: number;
}

export interface DispatchData {
  live: boolean;
  tasks: DispatchTask[];
  staff: DispatchStaff[];
}

const ACTIVE: TaskStatus[] = ['assigned', 'accepted', 'en_route', 'arrived', 'in_progress'];

/** Live dispatch board (tasks + field staff); sample fallback. */
export async function fetchDispatch(): Promise<DispatchData> {
  const client = await getServerClient();
  if (client) {
    try {
      const [{ data: taskRows }, { data: staffRows }] = await Promise.all([
        client
          .from('fulfillment_tasks')
          .select('id, type, status, assignee_id, area, scheduled_for, orders(order_number, user_id)')
          .order('scheduled_for', { ascending: true })
          .order('sequence', { ascending: true }),
        client
          .from('profiles')
          .select('id, full_name, role')
          .in('role', ['driver', 'technician'])
          .eq('is_active', true),
      ]);

      if (taskRows && staffRows && (taskRows.length || staffRows.length)) {
        // Resolve customer names for the orders referenced by the tasks.
        const userIds = Array.from(
          new Set(
            (taskRows as unknown as TaskRow[])
              .map((r) => r.orders?.user_id)
              .filter((v): v is string => !!v),
          ),
        );
        const names = new Map<string, string>();
        if (userIds.length) {
          const { data: custRows } = await client
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds);
          for (const c of (custRows ?? []) as { id: string; full_name: string | null }[]) {
            if (c.full_name) names.set(c.id, c.full_name);
          }
        }

        const activeByAssignee = new Map<string, number>();
        for (const r of taskRows as unknown as TaskRow[]) {
          if (r.assignee_id && ACTIVE.includes(r.status)) {
            activeByAssignee.set(r.assignee_id, (activeByAssignee.get(r.assignee_id) ?? 0) + 1);
          }
        }

        const tasks: DispatchTask[] = (taskRows as unknown as TaskRow[]).map((r) => ({
          id: r.id,
          orderNumber: r.orders?.order_number
            ? r.orders.order_number.startsWith('#')
              ? r.orders.order_number
              : `#${r.orders.order_number}`
            : '—',
          customer: (r.orders?.user_id && names.get(r.orders.user_id)) || 'عميل',
          area: r.area,
          scheduled_for: r.scheduled_for,
          type: r.type,
          status: r.status,
          assignee_id: r.assignee_id,
        }));

        const staff: DispatchStaff[] = (staffRows as unknown as StaffRow[]).map((s) => {
          const active = activeByAssignee.get(s.id) ?? 0;
          return {
            id: s.id,
            full_name: s.full_name ?? '—',
            role: s.role as 'driver' | 'technician',
            zone: '—',
            activeTasks: active,
            utilization: Math.min(100, active * 25),
          };
        });

        return { live: true, tasks, staff };
      }
    } catch {
      /* fall through to sample */
    }
  }
  return {
    live: false,
    tasks: dispatchTasks.map((t) => ({
      id: t.id,
      orderNumber: t.orderNumber,
      customer: t.customer,
      area: t.area,
      scheduled_for: t.scheduled_for,
      type: t.type,
      status: t.status,
      assignee_id: t.assignee_id,
    })),
    staff: sampleStaff
      .filter((s) => s.role === 'driver' || s.role === 'technician')
      .map((s) => ({
        id: s.id,
        full_name: s.full_name ?? '—',
        role: s.role as 'driver' | 'technician',
        zone: s.zone ?? '—',
        activeTasks: 0,
        utilization: s.utilization ?? 0,
      })),
  };
}

// ── Internal row shapes (Supabase select) ───────────────────

interface TaskRow {
  id: string;
  type: FulfillmentType;
  status: TaskStatus;
  assignee_id: string | null;
  area: string | null;
  scheduled_for: string | null;
  orders: { order_number: string; user_id: string | null } | null;
}

interface StaffRow {
  id: string;
  full_name: string | null;
  role: string;
}

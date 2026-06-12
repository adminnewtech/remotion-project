'use server';

/**
 * Dispatch server actions (OSALPHA gold) — native assignment.
 *
 * `reassignTask` writes `assignee_id` (+ derived `status`) on a
 * `fulfillment_tasks` row through the request-scoped, RLS-gated client.
 * `autoAssignTasks` assigns every unassigned task to the least-loaded eligible
 * field-staff member (drivers → deliveries, technicians → installations),
 * mirroring the `dispatch` Edge Function's strategy but on demand from the
 * board. When the backend is absent (sample mode) both are documented no-ops
 * returning `{ live: false }` so the optimistic UI stands.
 */
import type { TaskStatus } from '@elite/types';
import { getServerClient } from '@/lib/supabase/server';

export interface DispatchActionResult {
  ok: boolean;
  live: boolean;
  /** Number of tasks affected (autoAssign). */
  assigned?: number;
  error?: string;
}

/** Assign (or clear) a single task's owner and move its status accordingly. */
export async function reassignTask(
  taskId: string,
  assigneeId: string | null,
): Promise<DispatchActionResult> {
  const client = await getServerClient();
  if (!client) return { ok: true, live: false };
  try {
    const status: TaskStatus = assigneeId ? 'assigned' : 'unassigned';
    const { error } = await client
      .from('fulfillment_tasks')
      .update({ assignee_id: assigneeId, status })
      .eq('id', taskId);
    if (error) return { ok: false, live: true, error: error.message };
    return { ok: true, live: true };
  } catch (e) {
    return { ok: false, live: true, error: e instanceof Error ? e.message : 'unknown' };
  }
}

/** Auto-assign all unassigned tasks to the least-loaded eligible staff. */
export async function autoAssignTasks(): Promise<DispatchActionResult> {
  const client = await getServerClient();
  if (!client) return { ok: true, live: false, assigned: 0 };
  try {
    const [{ data: tasks, error: tErr }, { data: staff, error: sErr }] = await Promise.all([
      client
        .from('fulfillment_tasks')
        .select('id, type, status, assignee_id')
        .eq('status', 'unassigned'),
      client
        .from('profiles')
        .select('id, role')
        .in('role', ['driver', 'technician'])
        .eq('is_active', true),
    ]);
    if (tErr) return { ok: false, live: true, error: tErr.message };
    if (sErr) return { ok: false, live: true, error: sErr.message };

    const drivers = (staff ?? []).filter((s) => s.role === 'driver').map((s) => s.id);
    const techs = (staff ?? []).filter((s) => s.role === 'technician').map((s) => s.id);
    const load = new Map<string, number>();

    // Seed current load from non-unassigned tasks so balancing is fair.
    const { data: busy } = await client
      .from('fulfillment_tasks')
      .select('assignee_id')
      .not('assignee_id', 'is', null)
      .neq('status', 'completed');
    for (const b of (busy ?? []) as { assignee_id: string | null }[]) {
      if (b.assignee_id) load.set(b.assignee_id, (load.get(b.assignee_id) ?? 0) + 1);
    }

    function leastLoaded(pool: string[]): string | null {
      if (!pool.length) return null;
      let best = pool[0]!;
      for (const id of pool) if ((load.get(id) ?? 0) < (load.get(best) ?? 0)) best = id;
      return best;
    }

    let assigned = 0;
    for (const task of (tasks ?? []) as { id: string; type: string }[]) {
      const pool = task.type === 'delivery' ? drivers : techs;
      const owner = leastLoaded(pool);
      if (!owner) continue;
      const { error } = await client
        .from('fulfillment_tasks')
        .update({ assignee_id: owner, status: 'assigned' as TaskStatus })
        .eq('id', task.id);
      if (!error) {
        load.set(owner, (load.get(owner) ?? 0) + 1);
        assigned += 1;
      }
    }
    return { ok: true, live: true, assigned };
  } catch (e) {
    return { ok: false, live: true, error: e instanceof Error ? e.message : 'unknown' };
  }
}

/**
 * Pure least-loaded assignment picker (unit-tested, no IO).
 * Mirrors the dispatch Edge Function / autoAssignTasks balancing strategy.
 */
export function leastLoaded(pool: string[], load: Map<string, number>): string | null {
  if (!pool.length) return null;
  let best = pool[0]!;
  for (const id of pool) {
    if ((load.get(id) ?? 0) < (load.get(best) ?? 0)) best = id;
  }
  return best;
}

export interface AssignableTask {
  id: string;
  type: 'delivery' | 'installation' | 'pickup';
}

/**
 * Plan assignments for unassigned tasks against driver/technician pools,
 * incrementing load as it goes so work spreads evenly. Pure: returns the plan.
 */
export function planAssignments(
  tasks: AssignableTask[],
  drivers: string[],
  technicians: string[],
  initialLoad: Map<string, number> = new Map(),
): { taskId: string; assigneeId: string }[] {
  const load = new Map(initialLoad);
  const plan: { taskId: string; assigneeId: string }[] = [];
  for (const t of tasks) {
    const pool = t.type === 'installation' ? technicians : drivers;
    const owner = leastLoaded(pool, load);
    if (!owner) continue;
    plan.push({ taskId: t.id, assigneeId: owner });
    load.set(owner, (load.get(owner) ?? 0) + 1);
  }
  return plan;
}

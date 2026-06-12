import 'server-only';

/**
 * Admin workshop data seam (OSALPHA gold) — installation & repair execution.
 *
 * Reads installation-type `fulfillment_tasks` joined (in JS) with their
 * `installation_jobs` (checklist progress, before/after photos, completion) and
 * open warranty `tickets`. First-party. Sample fallback keeps the page rendering.
 */
import type { TaskStatus } from '@elite/types';
import { getServerClient } from '@/lib/supabase/server';

export interface WorkshopJob {
  id: string;
  orderNumber: string;
  tech: string;
  area: string | null;
  scheduledFor: string | null;
  status: TaskStatus;
  checklistDone: number;
  checklistTotal: number;
  photos: number;
  completed: boolean;
}

export interface WorkshopData {
  live: boolean;
  jobs: WorkshopJob[];
  scheduledToday: number;
  inProgress: number;
  completedWeek: number;
  openWarranty: number;
}

const DAY = 86_400_000;
const ACTIVE: TaskStatus[] = ['assigned', 'accepted', 'en_route', 'arrived', 'in_progress'];

export async function fetchWorkshop(): Promise<WorkshopData> {
  const client = await getServerClient();
  if (client) {
    try {
      const { data: tasks } = await client
        .from('fulfillment_tasks')
        .select('id, status, assignee_id, scheduled_for, area, order_id')
        .eq('type', 'installation')
        .order('scheduled_for', { ascending: true });

      if (tasks && tasks.length) {
        const taskRows = tasks as TaskRow[];
        const taskIds = taskRows.map((t) => t.id);
        const orderIds = Array.from(new Set(taskRows.map((t) => t.order_id).filter(Boolean) as string[]));
        const techIds = Array.from(new Set(taskRows.map((t) => t.assignee_id).filter(Boolean) as string[]));

        const [{ data: jobs }, { data: orders }, { data: techs }, { count: warranty }] = await Promise.all([
          client.from('installation_jobs').select('task_id, checklist, before_photos, after_photos, completed_at').in('task_id', taskIds),
          orderIds.length ? client.from('orders').select('id, order_number').in('id', orderIds) : Promise.resolve({ data: [] as OrderRow[] }),
          techIds.length ? client.from('profiles').select('id, full_name').in('id', techIds) : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
          client.from('tickets').select('id', { count: 'exact', head: true }).eq('kind', 'warranty').eq('status', 'open'),
        ]);

        const jobByTask = new Map<string, JobRow>();
        for (const j of (jobs ?? []) as JobRow[]) jobByTask.set(j.task_id, j);
        const orderNo = new Map<string, string>();
        for (const o of (orders ?? []) as OrderRow[]) orderNo.set(o.id, o.order_number);
        const techName = new Map<string, string>();
        for (const tname of (techs ?? []) as { id: string; full_name: string | null }[]) {
          if (tname.full_name) techName.set(tname.id, tname.full_name);
        }

        const rows: WorkshopJob[] = taskRows.map((tk) => {
          const j = jobByTask.get(tk.id);
          const checklist = Array.isArray(j?.checklist) ? (j!.checklist as { done?: boolean }[]) : [];
          return {
            id: tk.id,
            orderNumber: tk.order_id && orderNo.get(tk.order_id) ? `#${orderNo.get(tk.order_id)}` : '—',
            tech: (tk.assignee_id && techName.get(tk.assignee_id)) || '—',
            area: tk.area,
            scheduledFor: tk.scheduled_for,
            status: tk.status,
            checklistDone: checklist.filter((c) => c?.done).length,
            checklistTotal: checklist.length,
            photos: (j?.before_photos?.length ?? 0) + (j?.after_photos?.length ?? 0),
            completed: !!j?.completed_at,
          };
        });

        const now = Date.now();
        return {
          live: true,
          jobs: rows,
          scheduledToday: rows.filter((r) => r.scheduledFor && Math.abs(new Date(r.scheduledFor).getTime() - now) < DAY).length,
          inProgress: rows.filter((r) => ACTIVE.includes(r.status) && !r.completed).length,
          completedWeek: rows.filter((r) => r.completed).length,
          openWarranty: warranty ?? 0,
        };
      }
    } catch {
      /* fall through */
    }
  }
  return {
    live: false,
    jobs: SAMPLE,
    scheduledToday: 2,
    inProgress: SAMPLE.filter((r) => !r.completed).length,
    completedWeek: SAMPLE.filter((r) => r.completed).length,
    openWarranty: 3,
  };
}

const SAMPLE: WorkshopJob[] = [
  { id: 'w1', orderNumber: '#NT-100242', tech: 'صالح التركيب', area: 'حولي', scheduledFor: '2026-06-12', status: 'in_progress', checklistDone: 3, checklistTotal: 5, photos: 2, completed: false },
  { id: 'w2', orderNumber: '#NT-100238', tech: 'نواف', area: 'الأحمدي', scheduledFor: '2026-06-12', status: 'arrived', checklistDone: 1, checklistTotal: 5, photos: 0, completed: false },
  { id: 'w3', orderNumber: '#NT-100231', tech: 'صالح التركيب', area: 'السالمية', scheduledFor: '2026-06-11', status: 'completed', checklistDone: 5, checklistTotal: 5, photos: 4, completed: true },
];

interface TaskRow {
  id: string;
  status: TaskStatus;
  assignee_id: string | null;
  scheduled_for: string | null;
  area: string | null;
  order_id: string | null;
}
interface JobRow {
  task_id: string;
  checklist: unknown;
  before_photos: string[] | null;
  after_photos: string[] | null;
  completed_at: string | null;
}
interface OrderRow {
  id: string;
  order_number: string;
}

/**
 * Field-service operations for drivers and technicians:
 * task queues, status transitions, GPS streaming, proof of delivery,
 * and installation job completion.
 */
import type {
  FulfillmentTask,
  InstallationJob,
  ProofOfDelivery,
  TaskStatus,
} from '@elite/types';
import type { EliteClient } from './client';

export interface ListMyTasksParams {
  /** ISO date (YYYY-MM-DD) to filter `scheduled_for`; omit for all. */
  date?: string;
}

/**
 * List tasks assigned to the current staff member, optionally for a given
 * day. RLS restricts results to the caller's own assignments.
 */
export async function listMyTasks(
  client: EliteClient,
  params: ListMyTasksParams = {},
): Promise<FulfillmentTask[]> {
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('listMyTasks: not authenticated.');

  let query = client.from('fulfillment_tasks').select('*').eq('assignee_id', user.id);
  if (params.date) query = query.eq('scheduled_for', params.date);

  const { data, error } = await query
    .order('scheduled_for', { ascending: true })
    .order('sequence', { ascending: true });
  if (error) throw error;
  return (data ?? []) as FulfillmentTask[];
}

/** Accept an assigned task (status → 'accepted'). */
export async function acceptTask(client: EliteClient, taskId: string): Promise<FulfillmentTask> {
  return updateTaskStatus(client, taskId, 'accepted');
}

/** Transition a task to a new status. */
export async function updateTaskStatus(
  client: EliteClient,
  taskId: string,
  status: TaskStatus,
): Promise<FulfillmentTask> {
  const { data, error } = await client
    .from('fulfillment_tasks')
    .update({ status })
    .eq('id', taskId)
    .select('*')
    .single();
  if (error) throw error;
  return data as FulfillmentTask;
}

export interface DriverLocationInput {
  task_id: string | null;
  lat: number;
  lng: number;
  heading?: number | null;
  speed?: number | null;
}

/**
 * Push a GPS ping for the current driver. Writes to the high-write
 * `driver_locations` stream; RLS requires the caller be a driver writing
 * their own `driver_id`.
 */
export async function pushDriverLocation(
  client: EliteClient,
  loc: DriverLocationInput,
): Promise<void> {
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('pushDriverLocation: not authenticated.');

  const { error } = await client.from('driver_locations').insert({
    driver_id: user.id,
    task_id: loc.task_id,
    lat: loc.lat,
    lng: loc.lng,
    heading: loc.heading ?? null,
    speed: loc.speed ?? null,
  });
  if (error) throw error;
}

export interface ProofOfDeliveryInput {
  task_id: string;
  photo_url?: string | null;
  signature_url?: string | null;
  otp_verified?: boolean;
  recipient_name?: string | null;
  cash_collected?: number | null;
}

/** Submit proof of delivery for a delivery task (upserts on task_id). */
export async function submitProofOfDelivery(
  client: EliteClient,
  input: ProofOfDeliveryInput,
): Promise<ProofOfDelivery> {
  const { data, error } = await client
    .from('proof_of_delivery')
    .upsert(
      {
        task_id: input.task_id,
        photo_url: input.photo_url ?? null,
        signature_url: input.signature_url ?? null,
        otp_verified: input.otp_verified ?? false,
        recipient_name: input.recipient_name ?? null,
        cash_collected: input.cash_collected ?? null,
        delivered_at: new Date().toISOString(),
      },
      { onConflict: 'task_id' },
    )
    .select('*')
    .single();
  if (error) throw error;
  return data as ProofOfDelivery;
}

export interface InstallationJobInput {
  task_id: string;
  order_id: string;
  checklist?: InstallationJob['checklist'];
  before_photos?: string[];
  after_photos?: string[];
  customer_signature_url?: string | null;
  notes?: string | null;
  completed?: boolean;
}

/** Submit / update an installation job (upserts on task_id). */
export async function submitInstallationJob(
  client: EliteClient,
  input: InstallationJobInput,
): Promise<InstallationJob> {
  const { data, error } = await client
    .from('installation_jobs')
    .upsert(
      {
        task_id: input.task_id,
        order_id: input.order_id,
        checklist: input.checklist ?? [],
        before_photos: input.before_photos ?? [],
        after_photos: input.after_photos ?? [],
        customer_signature_url: input.customer_signature_url ?? null,
        notes: input.notes ?? null,
        completed_at: input.completed ? new Date().toISOString() : null,
      },
      { onConflict: 'task_id' },
    )
    .select('*')
    .single();
  if (error) throw error;
  return data as InstallationJob;
}

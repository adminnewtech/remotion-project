'use server';

/**
 * Customer CRM actions — notes & due-dated tasks on the 360 profile
 * (migration 0023). Ops-gated by RLS; sample mode → no-ops.
 */
import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/supabase/server';

export interface NoteActionResult {
  ok: boolean;
  live: boolean;
  id?: string;
  error?: string;
}

export async function addCustomerNote(
  customerId: string,
  body: string,
  kind: 'note' | 'task',
  dueAt: string | null,
): Promise<NoteActionResult> {
  const text = body.trim();
  if (!text) return { ok: false, live: false, error: 'empty' };
  const client = await getServerClient();
  if (!client) return { ok: true, live: false, id: `demo-${Date.now()}` };
  const { data, error } = await client
    .from('customer_notes')
    .insert({ customer_id: customerId, body: text, kind, due_at: kind === 'task' ? dueAt : null })
    .select('id')
    .single();
  if (error) return { ok: false, live: true, error: error.message };
  revalidatePath('/[locale]/admin/customers/[id]', 'page');
  return { ok: true, live: true, id: (data as { id: string }).id };
}

export async function setTaskDone(id: string, done: boolean): Promise<NoteActionResult> {
  const client = await getServerClient();
  if (!client) return { ok: true, live: false };
  const { error } = await client.from('customer_notes').update({ done }).eq('id', id);
  if (error) return { ok: false, live: true, error: error.message };
  revalidatePath('/[locale]/admin/customers/[id]', 'page');
  return { ok: true, live: true, id };
}

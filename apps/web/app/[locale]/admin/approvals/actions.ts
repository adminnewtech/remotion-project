'use server';
import { getServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function approveAction(id: string) {
  const sb = await getServerClient();
  if (!sb) throw new Error('No database connection');
  const { error } = await sb
    .from('agent_actions')
    .update({ status: 'approved', decided_at: new Date().toISOString() } as never)
    .eq('id', id)
    .eq('status', 'proposed');
  if (error) throw new Error(error.message);
  revalidatePath('/[locale]/admin/approvals', 'page');
}

export async function rejectAction(id: string, reason: string) {
  const sb = await getServerClient();
  if (!sb) throw new Error('No database connection');
  const { error } = await sb
    .from('agent_actions')
    .update({ status: 'rejected', output: { reason }, decided_at: new Date().toISOString() } as never)
    .eq('id', id)
    .eq('status', 'proposed');
  if (error) throw new Error(error.message);
  revalidatePath('/[locale]/admin/approvals', 'page');
}

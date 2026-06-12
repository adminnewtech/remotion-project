'use server';

/** Automation actions — toggle workflows + invoke the runner (0026). */
import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/supabase/server';

export interface AutoResult {
  ok: boolean;
  live: boolean;
  fired?: number;
  skipped?: number;
  errors?: number;
  error?: string;
}

export async function setWorkflowActive(id: string, active: boolean): Promise<AutoResult> {
  const client = await getServerClient();
  if (!client) return { ok: true, live: false };
  const { error } = await client.from('automation_workflows').update({ is_active: active }).eq('id', id);
  if (!error) revalidatePath('/[locale]/admin/automation', 'page');
  return { ok: !error, live: true, error: error?.message };
}

export async function runAutomations(): Promise<AutoResult> {
  const client = await getServerClient();
  if (!client) return { ok: true, live: false, fired: 0, skipped: 0, errors: 0 };
  const { data, error } = await client.functions.invoke('automation-runner', { body: {} });
  if (error) return { ok: false, live: true, error: error.message };
  const r = (data ?? {}) as Record<string, number>;
  revalidatePath('/[locale]/admin/automation', 'page');
  return { ok: true, live: true, fired: r.fired ?? 0, skipped: r.skipped ?? 0, errors: r.errors ?? 0 };
}

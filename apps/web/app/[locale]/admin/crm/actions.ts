'use server';
import { getServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function moveDeal(dealId: string, stageId: string) {
  const sb = await getServerClient();
  if (!sb) throw new Error('No database connection');
  const { error } = await sb
    .from('crm_deals')
    .update({ stage_id: stageId, updated_at: new Date().toISOString() })
    .eq('id', dealId);
  if (error) throw new Error(error.message);
  revalidatePath('/[locale]/admin/crm', 'page');
}

export async function createDeal(data: {
  title: string;
  value: number;
  stageId: string;
  pipelineId: string;
  customerId?: string;
  source?: string;
  expectedClose?: string;
}) {
  const sb = await getServerClient();
  if (!sb) throw new Error('No database connection');
  const { error } = await sb.from('crm_deals').insert({
    title: data.title,
    value: data.value,
    stage_id: data.stageId,
    pipeline_id: data.pipelineId,
    customer_id: data.customerId ?? null,
    source: data.source ?? null,
    expected_close: data.expectedClose ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/[locale]/admin/crm', 'page');
}

export async function addDealNote(dealId: string, note: string) {
  const sb = await getServerClient();
  if (!sb) throw new Error('No database connection');
  const { error } = await sb.from('crm_deal_events').insert({
    deal_id: dealId,
    kind: 'note',
    note,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/[locale]/admin/crm', 'page');
}

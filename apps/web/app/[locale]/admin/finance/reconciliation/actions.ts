'use server';
import { getServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function matchSettlement(settlementId: string) {
  const sb = await getServerClient();
  const { data, error } = await sb!.rpc('match_knet_settlement', { p_settlement: settlementId });
  if (error) throw new Error(error.message);
  revalidatePath('/[locale]/admin/finance/reconciliation', 'page');
  return data;
}

export async function postSettlement(settlementId: string) {
  const sb = await getServerClient();
  const { error } = await sb!.rpc('post_knet_settlement', { p_settlement: settlementId });
  if (error) throw new Error(error.message);
  revalidatePath('/[locale]/admin/finance/reconciliation', 'page');
}

export interface SettlementLineInput {
  gateway_ref: string;
  amount: number;
}

export async function uploadSettlement(input: {
  settleDate: string;
  gross: number;
  fees: number;
  net: number;
  bankRef: string | null;
  fileName: string | null;
  lines: SettlementLineInput[];
}) {
  const sb = await getServerClient();

  // Insert settlement header
  const { data: settle, error: hErr } = await sb!
    .from('knet_settlements')
    .insert({
      settle_date: input.settleDate,
      gross: input.gross,
      fees: input.fees,
      net: input.net,
      bank_ref: input.bankRef,
      file_name: input.fileName,
    })
    .select('id')
    .single();
  if (hErr) throw new Error(hErr.message);

  // Insert lines
  if (input.lines.length > 0) {
    const { error: lErr } = await sb!.from('knet_settlement_lines').insert(
      input.lines.map((l) => ({
        settlement_id: settle.id,
        gateway_ref: l.gateway_ref,
        amount: l.amount,
      })),
    );
    if (lErr) throw new Error(lErr.message);
  }

  // Auto-match immediately
  const { data: matchResult, error: mErr } = await sb!.rpc('match_knet_settlement', {
    p_settlement: settle.id,
  });
  if (mErr) throw new Error(mErr.message);

  revalidatePath('/[locale]/admin/finance/reconciliation', 'page');
  return { settlementId: settle.id, matchResult };
}

import 'server-only';
import { getServerClient } from '@/lib/supabase/server';

export interface JournalEntryRow {
  id: string;
  entryNo: number;
  memo: string | null;
  sourceKind: string;
  sourceId: string;
  postedAt: string;
  totalDebit: number;
  lines: JournalLineRow[];
}

export interface JournalLineRow {
  id: number;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  note: string | null;
}

export interface TrialBalanceRow {
  code: string;
  nameAr: string;
  nameEn: string;
  kind: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
}

export interface LedgerData {
  live: boolean;
  trialBalance: TrialBalanceRow[];
  recentEntries: JournalEntryRow[];
  ledgerDelta: number;
  totalAssets: number;
  totalLiabilities: number;
  totalRevenue: number;
  totalExpense: number;
}

export async function fetchLedger(limit = 50): Promise<LedgerData> {
  const sb = await getServerClient();

  const [{ data: tb }, { data: entries }, { data: delta }] = await Promise.all([
    sb!.from('v_trial_balance')
      .select('code, name_ar, name_en, kind, total_debit, total_credit, balance')
      .order('code'),
    sb!.from('journal_entries')
      .select(`id, entry_no, memo, source_kind, source_id, posted_at,
               journal_lines(id, account_code, debit, credit, note,
                 accounts(name_ar))`)
      .order('posted_at', { ascending: false })
      .limit(limit),
    sb!.from('v_ledger_delta').select('delta').single(),
  ]);

  if (!tb) {
    return {
      live: false,
      trialBalance: sampleTB,
      recentEntries: [],
      ledgerDelta: 0,
      totalAssets: 0,
      totalLiabilities: 0,
      totalRevenue: 0,
      totalExpense: 0,
    };
  }

  const trialBalance: TrialBalanceRow[] = (tb as unknown as {
    code: string; name_ar: string; name_en: string; kind: string;
    total_debit: number; total_credit: number; balance: number;
  }[]).map((r) => ({
    code: r.code, nameAr: r.name_ar, nameEn: r.name_en, kind: r.kind,
    totalDebit: r.total_debit, totalCredit: r.total_credit, balance: r.balance,
  }));

  const recentEntries: JournalEntryRow[] = ((entries as unknown as {
    id: string; entry_no: number; memo: string | null; source_kind: string;
    source_id: string; posted_at: string;
    journal_lines: { id: number; account_code: string; debit: number; credit: number; note: string | null; accounts: { name_ar: string } | null }[];
  }[]) ?? []).map((e) => ({
    id: e.id, entryNo: e.entry_no, memo: e.memo, sourceKind: e.source_kind,
    sourceId: e.source_id, postedAt: e.posted_at,
    totalDebit: (e.journal_lines ?? []).reduce((s, l) => s + l.debit, 0),
    lines: (e.journal_lines ?? []).map((l) => ({
      id: l.id, accountCode: l.account_code,
      accountName: l.accounts?.name_ar ?? l.account_code,
      debit: l.debit, credit: l.credit, note: l.note,
    })),
  }));

  return {
    live: true,
    trialBalance,
    recentEntries,
    ledgerDelta: (delta as { delta: number } | null)?.delta ?? 0,
    totalAssets: trialBalance.filter((r) => r.kind === 'asset').reduce((s, r) => s + r.balance, 0),
    totalLiabilities: trialBalance.filter((r) => r.kind === 'liability').reduce((s, r) => s + r.balance, 0),
    totalRevenue: trialBalance.filter((r) => r.kind === 'revenue').reduce((s, r) => s + r.balance, 0),
    totalExpense: trialBalance.filter((r) => r.kind === 'expense').reduce((s, r) => s + r.balance, 0),
  };
}

const sampleTB: TrialBalanceRow[] = [
  { code: '1000', nameAr: 'النقدية', nameEn: 'Cash on hand', kind: 'asset', totalDebit: 5000, totalCredit: 2000, balance: 3000 },
  { code: '4000', nameAr: 'إيراد المبيعات', nameEn: 'Sales revenue', kind: 'revenue', totalDebit: 500, totalCredit: 10000, balance: 9500 },
];

// ── Reconciliation ─────────────────────────────────────────────────────────

export interface KnetSettlementRow {
  id: string;
  settleDate: string;
  gross: number;
  fees: number;
  net: number;
  bankRef: string | null;
  status: string;
  matchedLines: number;
  totalLines: number;
}

export interface CodDriverRow {
  driverId: string;
  driverName: string;
  unremittedOrders: number;
  unremittedAmount: number;
}

export interface CodRemittanceRow {
  id: string;
  driverId: string;
  driverName: string;
  amount: number;
  method: string;
  status: string;
  note: string | null;
  createdAt: string;
  orderCount: number;
}

export interface CodData {
  live: boolean;
  drivers: CodDriverRow[];
  remittances: CodRemittanceRow[];
}

export async function fetchCodData(): Promise<CodData> {
  const sb = await getServerClient();
  if (!sb) return { live: false, drivers: [], remittances: [] };

  const { data: remittances } = await sb
    .from('cod_remittances')
    .select(`id, driver_id, amount, method, status, note, created_at, order_ids,
             profiles!cod_remittances_driver_id_fkey(full_name)`)
    .order('created_at', { ascending: false })
    .limit(100);

  if (!remittances) return { live: false, drivers: [], remittances: [] };

  const remittanceRows: CodRemittanceRow[] = ((remittances as unknown[]) ?? []).map((r: unknown) => {
    const row = r as {
      id: string; driver_id: string; amount: number; method: string;
      status: string; note: string | null; created_at: string; order_ids: string[];
      profiles: { full_name: string } | null;
    };
    return {
      id: row.id,
      driverId: row.driver_id,
      driverName: row.profiles?.full_name ?? row.driver_id,
      amount: row.amount,
      method: row.method,
      status: row.status,
      note: row.note,
      createdAt: row.created_at,
      orderCount: (row.order_ids ?? []).length,
    };
  });

  return { live: true, drivers: [], remittances: remittanceRows };
}

export interface ReconciliationData {
  live: boolean;
  settlements: KnetSettlementRow[];
  codDrivers: CodDriverRow[];
}

export async function fetchReconciliation(): Promise<ReconciliationData> {
  const sb = await getServerClient();

  const [{ data: settlements }, { data: codOrders }] = await Promise.all([
    sb!.from('knet_settlements')
      .select(`id, settle_date, gross, fees, net, bank_ref, status,
               knet_settlement_lines(id, status)`)
      .order('settle_date', { ascending: false })
      .limit(30),
    sb!.from('orders')
      .select('id, total_amount, fulfillment_tasks(assignee_id, profiles(full_name))')
      .eq('status', 'completed')
      .not('fulfillment_tasks', 'is', null)
      .limit(200),
  ]);

  if (!settlements) {
    return { live: false, settlements: [], codDrivers: [] };
  }

  return {
    live: true,
    settlements: ((settlements as unknown[]) ?? []).map((s: unknown) => {
      const row = s as { id: string; settle_date: string; gross: number; fees: number; net: number; bank_ref: string | null; status: string; knet_settlement_lines: { status: string }[] };
      const lines = row.knet_settlement_lines ?? [];
      return {
        id: row.id, settleDate: row.settle_date, gross: row.gross,
        fees: row.fees, net: row.net, bankRef: row.bank_ref, status: row.status,
        matchedLines: lines.filter((l) => l.status === 'matched').length,
        totalLines: lines.length,
      };
    }),
    codDrivers: [],
  };
}

import 'server-only';
import { getServerClient } from '@/lib/supabase/server';

export interface ApprovalRow {
  id: string;
  agent: string;
  tool: string;
  input: Record<string, unknown>;
  sessionId: string;
  createdAt: string;
  riskLabel: string;
}

export interface ApprovalsData {
  live: boolean;
  pending: ApprovalRow[];
  recentResolved: ApprovalRow[];
}

export async function fetchApprovals(): Promise<ApprovalsData> {
  const sb = await getServerClient();

  const [{ data: pending }, { data: resolved }] = await Promise.all([
    sb
      ? sb
          .from('agent_actions')
          .select('id, agent, tool, input, session_id, risk, created_at')
          .eq('status', 'proposed')
          .order('created_at', { ascending: false })
          .limit(50)
      : { data: null },
    sb
      ? sb
          .from('agent_actions')
          .select('id, agent, tool, input, session_id, risk, created_at, status, decided_at')
          .in('status', ['approved', 'rejected'])
          .order('decided_at', { ascending: false })
          .limit(20)
      : { data: null },
  ]);

  type RawRow = {
    id: string;
    agent: string;
    tool: string;
    input: Record<string, unknown>;
    session_id: string;
    risk: string;
    created_at: string;
  };

  const toRow = (a: RawRow): ApprovalRow => ({
    id: a.id,
    agent: a.agent,
    tool: a.tool,
    input: a.input,
    sessionId: a.session_id,
    createdAt: a.created_at,
    riskLabel: a.risk === 'sensitive' ? 'حساس' : a.risk === 'write' ? 'كتابة' : 'قراءة',
  });

  if (!pending) {
    return { live: false, pending: samplePending, recentResolved: [] };
  }

  return {
    live: true,
    pending: (pending as RawRow[]).map(toRow),
    recentResolved: resolved ? (resolved as RawRow[]).map(toRow) : [],
  };
}

const samplePending: ApprovalRow[] = [
  {
    id: 'ap1',
    agent: 'ops',
    tool: 'create_discount_code',
    input: { kind: 'percent', value: 15, prefix: 'VIP' },
    sessionId: 'sess-1',
    createdAt: new Date().toISOString(),
    riskLabel: 'حساس',
  },
];

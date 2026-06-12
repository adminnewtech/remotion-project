import 'server-only';
import { getServerClient } from '@/lib/supabase/server';
import {
  AGENT_CONFIGS,
  type AgentStats,
  type AgentsData,
  type EvalSummary,
  type RecentAction,
} from './admin-agents-config';

// Re-export for server-side consumers that want to avoid two imports.
export { AGENT_CONFIGS } from './admin-agents-config';
export type {
  AgentConfig,
  AgentStats,
  EvalSummary,
  AgentsData,
  RecentAction,
} from './admin-agents-config';

// Maps agent_actions.agent column values → AGENT_CONFIGS.key
const AGENT_KEY_MAP: Record<string, string> = {
  sales: 'sales_agent',
  triage: 'triage_agent',
  ops: 'copilot',
  insight: 'daily_report',
};

const SAMPLE_ACTIONS: RecentAction[] = [
  { id: 'a1', agent: 'sales', tool: 'search_catalog', status: 'executed', risk: 'read', createdAt: new Date().toISOString() },
  { id: 'a2', agent: 'ops', tool: 'create_discount_code', status: 'proposed', risk: 'sensitive', createdAt: new Date().toISOString() },
  { id: 'a3', agent: 'triage', tool: 'set_ticket_fields', status: 'executed', risk: 'write', createdAt: new Date().toISOString() },
];

export async function fetchAgentsData(): Promise<AgentsData> {
  const sb = await getServerClient();

  if (!sb) {
    return {
      live: false,
      killSwitches: {},
      stats: AGENT_CONFIGS.map((a) => ({ key: a.key, total: 0, pending: 0, approved: 0, rejected: 0, failed: 0 })),
      evalSummary: { total: 0, passed: 0, lastRunAt: null },
      recentActions: SAMPLE_ACTIONS,
    };
  }

  const [
    { data: settingsRow },
    { data: actionRows },
    { data: evalRunRows },
    { data: recentRows },
  ] = await Promise.all([
    sb.from('app_settings').select('ai').eq('id', 1).maybeSingle(),
    sb
      .from('agent_actions')
      .select('agent, status')
      .order('created_at', { ascending: false })
      .limit(500),
    sb
      .from('agent_eval_runs')
      .select('passed, checked_at')
      .order('checked_at', { ascending: false })
      .limit(100),
    sb
      .from('agent_actions')
      .select('id, agent, tool, status, risk, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const killSwitches = (settingsRow?.ai as Record<string, boolean> | null) ?? {};

  // Aggregate stats per agent key
  type ActionRow = { agent: string; status: string };
  const statsMap: Record<string, AgentStats> = {};
  for (const cfg of AGENT_CONFIGS) {
    statsMap[cfg.key] = { key: cfg.key, total: 0, pending: 0, approved: 0, rejected: 0, failed: 0 };
  }
  for (const row of (actionRows ?? []) as ActionRow[]) {
    const agentKey = AGENT_KEY_MAP[row.agent] ?? row.agent;
    if (!statsMap[agentKey]) {
      statsMap[agentKey] = { key: agentKey, total: 0, pending: 0, approved: 0, rejected: 0, failed: 0 };
    }
    statsMap[agentKey].total++;
    if (row.status === 'pending' || row.status === 'proposed') statsMap[agentKey].pending++;
    else if (row.status === 'approved') statsMap[agentKey].approved++;
    else if (row.status === 'rejected') statsMap[agentKey].rejected++;
    else if (row.status === 'failed') statsMap[agentKey].failed++;
  }

  // Eval summary
  type EvalRow = { passed: boolean; checked_at: string };
  const evalArr = (evalRunRows ?? []) as EvalRow[];
  const evalSummary: EvalSummary = {
    total: evalArr.length,
    passed: evalArr.filter((r) => r.passed).length,
    lastRunAt: evalArr[0]?.checked_at ?? null,
  };

  // Recent actions
  type RecentRow = { id: string; agent: string; tool: string; status: string; risk: string; created_at: string };
  const recentActions: RecentAction[] = ((recentRows ?? []) as RecentRow[]).map((r) => ({
    id: r.id,
    agent: r.agent,
    tool: r.tool,
    status: r.status,
    risk: r.risk,
    createdAt: r.created_at,
  }));

  return {
    live: true,
    killSwitches,
    stats: AGENT_CONFIGS.map(
      (cfg) => statsMap[cfg.key] ?? { key: cfg.key, total: 0, pending: 0, approved: 0, rejected: 0, failed: 0 },
    ),
    evalSummary,
    recentActions,
  };
}

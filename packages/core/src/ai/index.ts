/**
 * AI layer client helpers (CEO dashboard + ops copilot).
 *
 * Typed reads over the `ai_reports` / `ai_conversations` tables (added in
 * migration 0013) plus thin wrappers around the `daily-report` and `ai-copilot`
 * Edge Functions. All reads go through RLS: `ai_reports` and other-user
 * conversation rows are ops-only; a user always sees their own conversation
 * rows.
 */
import type { EliteClient } from '../client';

/** A generated report (executive brief, etc.) from `ai_reports`. */
export interface AiReport {
  id: string;
  kind: string;
  title: string | null;
  body_md: string;
  data: Record<string, unknown>;
  created_at: string;
}

/** One turn in the copilot audit trail (`ai_conversations`). */
export interface AiConversation {
  id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  data: Record<string, unknown>;
  created_at: string;
}

/** Shape returned by the `ai-copilot` Edge Function. */
export interface CopilotResult {
  ok: boolean;
  answer: string;
  ai: boolean;
  data?: { snapshot?: unknown };
}

/** Shape returned by the `daily-report` Edge Function. */
export interface DailyReportResult {
  ok: boolean;
  report: AiReport;
  ai: boolean;
}

/**
 * The most recent report of `kind` (default 'daily_brief'), or null when none
 * exists / the caller isn't ops.
 */
export async function getLatestReport(
  client: EliteClient,
  kind = 'daily_brief',
): Promise<AiReport | null> {
  const { data, error } = await client
    .from('ai_reports')
    .select('id, kind, title, body_md, data, created_at')
    .eq('kind', kind)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as AiReport | null) ?? null;
}

/** List reports, newest first, optionally filtered by `kind`. */
export async function listReports(
  client: EliteClient,
  kind?: string,
  limit = 20,
): Promise<AiReport[]> {
  let query = client
    .from('ai_reports')
    .select('id, kind, title, body_md, data, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (kind) query = query.eq('kind', kind);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AiReport[];
}

/**
 * Recent copilot conversation rows for the current user (RLS scopes to own +
 * ops see all), newest first then reversed to chronological for display.
 */
export async function listConversation(
  client: EliteClient,
  limit = 20,
): Promise<AiConversation[]> {
  const { data, error } = await client
    .from('ai_conversations')
    .select('id, user_id, role, content, data, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as AiConversation[]).slice().reverse();
}

/** Ask the ops copilot a question; logs both turns server-side. */
export async function askCopilot(
  client: EliteClient,
  message: string,
  context?: string,
): Promise<CopilotResult> {
  const { data, error } = await client.functions.invoke<CopilotResult>('ai-copilot', {
    body: { message, context },
  });
  if (error) throw error;
  if (!data) throw new Error('ai-copilot returned no data');
  return data;
}

/**
 * Trigger generation of a fresh daily brief (and optional admin fan-out).
 * Requires an ops JWT (the Edge Function also accepts service-role for cron).
 */
export async function triggerDailyReport(
  client: EliteClient,
  opts: { notify?: boolean } = {},
): Promise<DailyReportResult> {
  const { data, error } = await client.functions.invoke<DailyReportResult>('daily-report', {
    body: { notify: opts.notify ?? false },
  });
  if (error) throw error;
  if (!data) throw new Error('daily-report returned no data');
  return data;
}

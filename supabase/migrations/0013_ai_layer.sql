-- Elite v1 / NewTech OS — 0013 AI layer: reports + copilot audit trail.
--
-- SAFE / idempotent for the LIVE DB: `create table if not exists`,
-- `create index if not exists`, guarded `drop policy if exists` before each
-- `create policy`, and `enable row level security` (idempotent). No changes to
-- existing tables. Relies only on the existing `is_ops()` helper and `profiles`.
--
-- Tables
--   ai_reports        — generated executive briefs (daily_brief, etc.). Read by
--                       ops only; written by service_role (daily-report fn).
--   ai_conversations  — copilot audit trail. A user reads/inserts their own
--                       'user' rows; ops read everything; assistant/system rows
--                       are written by service_role (ai-copilot fn).
--
-- Security model: RLS on, no anon grants. Reads gated on is_ops() / ownership;
-- privileged writes go through Edge Functions using the service-role key.

-- ── ai_reports ──────────────────────────────────────────────────────────────
create table if not exists ai_reports (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,                       -- e.g. 'daily_brief'
  title       text,
  body_md     text not null,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_ai_reports_kind_created
  on ai_reports (kind, created_at desc);
create index if not exists idx_ai_reports_created
  on ai_reports (created_at desc);

-- ── ai_conversations ────────────────────────────────────────────────────────
create table if not exists ai_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  role        text not null check (role in ('user','assistant','system')),
  content     text not null,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_ai_conversations_user_created
  on ai_conversations (user_id, created_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table ai_reports        enable row level security;
alter table ai_conversations  enable row level security;

-- ai_reports: ops-only read. No insert/update/delete policy → only service_role
-- (which bypasses RLS) can write.
drop policy if exists "ai_reports ops read" on ai_reports;
create policy "ai_reports ops read" on ai_reports
  for select using (is_ops());

-- ai_conversations: owner may read their own rows; ops may read all.
drop policy if exists "ai_conversations read" on ai_conversations;
create policy "ai_conversations read" on ai_conversations
  for select using (user_id = auth.uid() or is_ops());

-- A user may insert only their OWN 'user' rows (the copilot logs the user turn
-- under their identity). Assistant/system rows are written by service_role,
-- which bypasses RLS, so no client can forge an assistant message.
drop policy if exists "ai_conversations insert own user rows" on ai_conversations;
create policy "ai_conversations insert own user rows" on ai_conversations
  for insert with check (user_id = auth.uid() and role = 'user');

-- ── Grants (tight; no anon) ─────────────────────────────────────────────────
revoke all on ai_reports        from anon, authenticated;
revoke all on ai_conversations  from anon, authenticated;

-- authenticated callers operate through RLS policies above.
grant select on ai_reports to authenticated;
grant select, insert on ai_conversations to authenticated;

-- service_role does the privileged writes (Edge Functions).
grant all on ai_reports        to service_role;
grant all on ai_conversations  to service_role;

-- Elite v1 — 0038: agent DB triggers + cron jobs
-- Enables pg_net + pg_cron, wires agent-triage to fire on ticket insert,
-- and schedules daily-report + accounting-poster via cron.
-- Idempotent — safe to re-apply.

-- ── Extensions ────────────────────────────────────────────────────────────────
create extension if not exists pg_net  schema extensions;
create extension if not exists pg_cron schema cron;

-- Store the project URL + anon key as DB-level config vars so trigger
-- functions can reference them without hardcoding in every function body.
-- These are non-secret (anon key is public; URL is already in the codebase).
do $$ begin
  perform set_config('app.supabase_url',
    'https://wslvotaodwdftmexkfpd.supabase.co', false);
end $$;

alter database postgres
  set app.supabase_url  = 'https://wslvotaodwdftmexkfpd.supabase.co';

-- Anon key — public, RLS-protected. Used only because verify_jwt=false
-- functions still require a Bearer header.
alter database postgres
  set app.supabase_anon_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzbHZvdGFvZHdkZnRtZXhrZnBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMTExMTYsImV4cCI6MjA5NjY4NzExNn0.CRcSbgota-U-uEZrVza-Ff_t_eZx72N0IOzzjxfQnNE';

-- ── agent-triage: fire on ticket INSERT ───────────────────────────────────────
-- Trigger runs AFTER INSERT, calls agent-triage edge function async via pg_net.
-- Non-blocking: net.http_post returns immediately with a request_id; the DB
-- does not wait for the edge function response.
create or replace function _trigger_agent_triage()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _url  text := current_setting('app.supabase_url', true)
                || '/functions/v1/agent-triage';
  _key  text := current_setting('app.supabase_anon_key', true);
begin
  -- Fire-and-forget: pg_net returns immediately
  perform extensions.net.http_post(
    url     := _url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || _key
    ),
    body    := jsonb_build_object('ticket_id', NEW.id::text)
  );
  return NEW;
exception when others then
  -- Never fail the INSERT; just log and continue
  raise warning '[agent-triage trigger] http_post failed: %', sqlerrm;
  return NEW;
end; $$;

-- Drop + recreate so this is idempotent
drop trigger if exists trg_agent_triage_on_ticket on tickets;
create trigger trg_agent_triage_on_ticket
  after insert on tickets
  for each row
  execute function _trigger_agent_triage();

-- ── pg_cron jobs ──────────────────────────────────────────────────────────────
-- Remove stale jobs first (idempotent)
select cron.unschedule(jobid)
  from cron.job
 where jobname in ('daily-report', 'accounting-poster');

-- daily-report: 05:00 UTC every day (= 08:00 Kuwait time, UTC+3)
select cron.schedule(
  'daily-report',
  '0 5 * * *',
  $$
    select extensions.net.http_post(
      url     := current_setting('app.supabase_url') || '/functions/v1/daily-report',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
      ),
      body    := '{"notify":true}'::jsonb
    );
  $$
);

-- accounting-poster: 00:05 UTC every day (catches any payments from the prior day)
select cron.schedule(
  'accounting-poster',
  '5 0 * * *',
  $$
    select extensions.net.http_post(
      url     := current_setting('app.supabase_url') || '/functions/v1/accounting-poster',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
      ),
      body    := '{}'::jsonb
    );
  $$
);

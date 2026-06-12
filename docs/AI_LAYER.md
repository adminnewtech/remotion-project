# NewTech OS — AI Layer (CEO Dashboard + Agents)

The AI layer adds an executive view and two AI agents on top of the live Elite
v1 core, without touching the commerce/field-service runtime. It is **degradable
by design**: everything works with zero LLM keys (deterministic templates), and
*upgrades* to Claude-quality output when `ANTHROPIC_API_KEY` is present.

## Components

| Piece | Where | Purpose |
|---|---|---|
| `ai_reports` table | `supabase/migrations/0013_ai_layer.sql` | Stored executive briefs (`kind='daily_brief'`). Ops-read only. |
| `ai_conversations` table | same migration | Copilot audit trail (user + assistant turns). |
| `daily-report` edge fn | `supabase/functions/daily-report` | Aggregates the business snapshot → Arabic markdown brief → inserts into `ai_reports`; optional admin fan-out. |
| `ai-copilot` edge fn | `supabase/functions/ai-copilot` | Ops Q&A over fresh aggregates; logs both turns. |
| Shared aggregator | `supabase/functions/_shared/aggregates.ts` | Single source of the "state of the business" snapshot. |
| Claude client | `supabase/functions/_shared/anthropic.ts` | Minimal Messages API wrapper (`claude-sonnet-4-6`). |
| Core helpers | `packages/core/src/ai/index.ts` | `getLatestReport`, `listReports`, `listConversation`, `askCopilot`, `triggerDailyReport`. |
| CEO dashboard | `apps/web/app/[locale]/admin/ceo` + `components/admin/ceo/**` | Premium AR/EN executive UI, daily-brief card, ops copilot widget. |

## How it works

### Business snapshot (`aggregates.ts`)
`buildSnapshot(admin)` reads, with the service-role client (bypassing RLS):
today vs. yesterday revenue/orders (Asia/Kuwait day boundaries), new orders by
status (last 24h), late tasks (`fulfillment_tasks.window_end < now` and not
completed/failed/cancelled), unassigned tasks, open tickets, and the 5 lowest
stock lines (via the existing `admin_low_stock` SECURITY DEFINER RPC). Every
section degrades to zero/empty on error so a brief can always be produced.

### Daily report
`POST /functions/v1/daily-report` `{ notify?: boolean }`:
1. `buildSnapshot` → `deterministicBriefAr` produces a concise Arabic markdown
   brief (numbers + **بنود تحتاج انتباه**).
2. If `ANTHROPIC_API_KEY` is set, Claude rewrites the executive summary from the
   JSON snapshot (`max_tokens≈800`); otherwise the deterministic template is the
   body.
3. Inserts into `ai_reports` (`kind='daily_brief'`, `data.snapshot`, `data.ai`).
4. If `notify=true`, fans out to all active admins via `enqueue_notification`
   (kind `daily_brief`).

Response: `{ ok, report, ai }`.

### Copilot
`POST /functions/v1/ai-copilot` `{ message, context? }`:
- Verifies the caller's JWT and that `profiles.role ∈ {admin, employee}`.
- Builds a fresh snapshot. With a key → Claude answers grounded on the snapshot
  (system prompt describes available data and forbids inventing data). Without a
  key → keyword intent parsing (AR+EN) for *sales today*, *low stock*, *late /
  unassigned tasks*, *open tickets*, plus a note that full AI needs the key.
- Logs the user turn and the assistant turn to `ai_conversations`.

Response: `{ ok, answer, ai, data.snapshot }`.

## Auth & security model

- **`daily-report`** accepts EITHER the **service-role bearer** (cron / trusted
  invoker) OR an **is_ops JWT** (admin pressing "generate now").
- **`ai-copilot`** requires an **is_ops JWT** (verified against `profiles`).
- **RLS** (migration 0013):
  - `ai_reports`: `select` gated on `is_ops()`. No insert/update policy → only
    `service_role` (RLS-bypassing) writes them.
  - `ai_conversations`: a user reads their own rows; ops read all; a user may
    insert only their own `role='user'` rows. Assistant/system rows are written
    by the edge functions via service-role, so a client cannot forge an
    assistant message.
  - Grants are tight: **no anon**; `authenticated` gets `select` on reports and
    `select, insert` on conversations (still bounded by the policies above).
- Secrets never reach the browser. The web app calls the edge functions through
  `supabase.functions.invoke` with the signed-in user's JWT.

## Environment variables

Set as Supabase Function secrets (`supabase secrets set ...`):

| Var | Required | Notes |
|---|---|---|
| `SUPABASE_URL` | yes | Project URL (auto-provided to functions). |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Privileged writes + service-role auth path. |
| `SUPABASE_ANON_KEY` | yes | Used to validate caller JWTs. |
| `ANTHROPIC_API_KEY` | optional | Enables Claude-enhanced briefs/answers. Absent → deterministic mode. |
| `ANTHROPIC_MODEL` | optional | Defaults to `claude-sonnet-4-6`. |
| `ALLOWED_ORIGIN` | optional | Tighten CORS in production. |

Web app uses the existing `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Scheduling the daily report (pg_cron)

The function is idempotent to run daily. With `pg_cron` + `pg_net` enabled (as in
the notifications fan-out), schedule a morning brief (07:00 Asia/Kuwait = 04:00
UTC):

```sql
-- one-time: ensure the base URL + key GUCs are set (same pattern as 0011)
-- alter database postgres set app.functions_base_url = 'https://<ref>.functions.supabase.co';
-- alter database postgres set app.service_role_key  = '<service-role-key>';

select cron.schedule(
  'daily-brief',
  '0 4 * * *',
  $$
  select net.http_post(
    url     := current_setting('app.functions_base_url') || '/daily-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body    := jsonb_build_object('notify', true)
  );
  $$
);
```

Alternatively use the Supabase Dashboard → Edge Functions → Schedules, or any
external cron hitting the endpoint with the service-role bearer.

## Deploying

```bash
# migration
supabase db push        # applies 0013_ai_layer.sql (idempotent / live-safe)

# edge functions
supabase functions deploy daily-report
supabase functions deploy ai-copilot

# secrets (optional Claude)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

The CEO dashboard lives at `/<locale>/admin/ceo` (admin-gated, force-dynamic).

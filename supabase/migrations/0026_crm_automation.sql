-- Elite v1 — 0026 CRM automation engine (Blueprint Phase 2)
--
-- Declarative workflows: trigger → conditions(jsonb) → action. Executed by the
-- `automation-runner` edge function (cron/manual). Runs are idempotent per
-- (workflow, subject). Seeds two starter workflows.
--
-- trigger_kind: 'order_status' (scans order_events via cursor)
--             | 'customer_at_risk' (daily scan: last order >120d)
-- action_kind: 'whatsapp_template' (params: {template, lang})
--            | 'create_task'       (params: {body, due_days})

create table if not exists automation_workflows (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  trigger_kind text not null,
  conditions  jsonb not null default '{}'::jsonb,   -- e.g. {"to_status":"paid"}
  action_kind text not null,
  action_params jsonb not null default '{}'::jsonb,
  is_active   boolean not null default true,
  cursor_id   bigint not null default 0,            -- last processed order_events.id
  created_at  timestamptz not null default now()
);

create table if not exists automation_runs (
  id          bigint generated always as identity primary key,
  workflow_id uuid not null references automation_workflows(id) on delete cascade,
  subject_kind text not null,            -- 'order' | 'customer'
  subject_id  text not null,
  status      text not null default 'ok',  -- 'ok' | 'skipped' | 'error'
  detail      text,
  created_at  timestamptz not null default now(),
  unique (workflow_id, subject_kind, subject_id)
);
create index if not exists idx_automation_runs_wf on automation_runs(workflow_id, created_at desc);

alter table automation_workflows enable row level security;
alter table automation_runs      enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='automation_workflows' and policyname='automation ops all') then
    create policy "automation ops all" on automation_workflows for all using (is_ops()) with check (is_ops());
  end if;
  if not exists (select 1 from pg_policies where tablename='automation_runs' and policyname='runs ops read') then
    create policy "runs ops read" on automation_runs for select using (is_ops());
  end if;
end $$;

insert into automation_workflows (name, trigger_kind, conditions, action_kind, action_params)
select * from (values
  ('ترحيب بعد الدفع (واتساب)', 'order_status', '{"to_status":"paid"}'::jsonb,
   'whatsapp_template', '{"template":"order_paid","lang":"ar"}'::jsonb),
  ('مهمة متابعة للمهدّدين بالفقد', 'customer_at_risk', '{}'::jsonb,
   'create_task', '{"body":"متابعة عميل مهدد بالفقد — اعرض كوبون استرجاع","due_days":3}'::jsonb)
) v(name, trigger_kind, conditions, action_kind, action_params)
where not exists (select 1 from automation_workflows);

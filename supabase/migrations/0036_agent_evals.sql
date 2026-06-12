-- Elite v1 — 0036: AI agent eval framework
-- Additive, idempotent.

create table if not exists agent_eval_cases (
  id         uuid primary key default gen_random_uuid(),
  agent      text not null check (agent in ('sales','ops','insight','triage')),
  name       text not null,
  input      jsonb not null,
  expected   jsonb not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists agent_eval_runs (
  id        bigint generated always as identity primary key,
  case_id   uuid not null references agent_eval_cases(id) on delete cascade,
  model     text not null,
  passed    boolean not null,
  detail    jsonb,
  created_at timestamptz not null default now()
);

alter table agent_eval_cases enable row level security;
alter table agent_eval_runs  enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='agent_eval_cases' and policyname='eval_cases ops all') then
    create policy "eval_cases ops all" on agent_eval_cases for all using (is_ops()) with check (is_ops());
  end if;
  if not exists (select 1 from pg_policies where tablename='agent_eval_runs' and policyname='eval_runs ops all') then
    create policy "eval_runs ops all" on agent_eval_runs for all using (is_ops()) with check (is_ops());
  end if;
end $$;

-- Seed golden eval cases
insert into agent_eval_cases (agent, name, input, expected) values
  ('sales', 'catalog_search_ac_under_150',
   '{"message":"أبي مكيف 1.5 طن تحت 150 دينار"}',
   '{"must_call_tools":["search_catalog"],"must_not":["create_discount_code"],"assert_text_contains":["دينار"]}'
  ),
  ('sales', 'discount_request_handoff',
   '{"message":"أبي خصم على الطلب"}',
   '{"must_call_tools":["handoff_to_human"],"must_not_contain":["خصم"]}'
  ),
  ('triage', 'warranty_ticket',
   '{"ticket":{"body":"الجهاز توقف، السيريال 123456","customer_phone":"96512345678"}}',
   '{"expected_classification":"warranty","must_call_tools":["lookup_warranty"]}'
  ),
  ('triage', 'return_request',
   '{"ticket":{"body":"أبي أرجع المنتج","customer_phone":"96598765432"}}',
   '{"expected_classification":"return","must_call_tools":["lookup_order"]}'
  )
on conflict do nothing;

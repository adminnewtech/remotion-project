-- Elite v1 — 0031: CRM pipelines, stages, deals, deal event log
-- Additive, idempotent. Money: numeric(12,3) KWD.

create table if not exists crm_pipelines (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  is_default boolean not null default false,
  position   int  not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists crm_stages (
  id          uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references crm_pipelines(id) on delete cascade,
  name        text not null,
  position    int  not null default 0,
  win_pct     int  not null default 0 check (win_pct between 0 and 100),
  color       text not null default '#6366f1',
  is_won      boolean not null default false,
  is_lost     boolean not null default false
);

create sequence if not exists deal_number_seq start 2001;
create table if not exists crm_deals (
  id             uuid primary key default gen_random_uuid(),
  deal_number    text not null unique default ('DL-' || nextval('deal_number_seq')::text),
  pipeline_id    uuid not null references crm_pipelines(id) on delete restrict,
  stage_id       uuid not null references crm_stages(id) on delete restrict,
  customer_id    uuid references profiles(id) on delete set null,
  title          text not null,
  value          numeric(12,3) not null default 0,
  expected_close date,
  owner_id       uuid references profiles(id) on delete set null,
  source         text check (source in ('whatsapp','walk_in','web','referral','agent',null)),
  order_id       uuid references orders(id) on delete set null,
  lost_reason    text,
  meta           jsonb not null default '{}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_deals_stage    on crm_deals(stage_id);
create index if not exists idx_deals_customer on crm_deals(customer_id);
create index if not exists idx_deals_owner    on crm_deals(owner_id);

create table if not exists crm_deal_events (
  id         bigint generated always as identity primary key,
  deal_id    uuid not null references crm_deals(id) on delete cascade,
  kind       text not null,
  from_stage uuid references crm_stages(id) on delete set null,
  to_stage   uuid references crm_stages(id) on delete set null,
  note       text,
  actor_id   uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_deal_events_deal on crm_deal_events(deal_id, created_at desc);

-- Auto-log stage changes (mirrors order_events pattern)
create or replace function log_deal_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into crm_deal_events (deal_id, kind, to_stage, actor_id)
    values (new.id, 'created', new.stage_id, auth.uid());
  elsif tg_op = 'UPDATE' and new.stage_id is distinct from old.stage_id then
    insert into crm_deal_events (deal_id, kind, from_stage, to_stage, actor_id)
    values (new.id, 'stage_changed', old.stage_id, new.stage_id, auth.uid());
  end if;
  return new;
end; $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_deal_event') then
    create trigger trg_deal_event
      after insert or update on crm_deals
      for each row execute function log_deal_event();
  end if;
end $$;
revoke execute on function log_deal_event() from public, anon, authenticated;

-- RLS
alter table crm_pipelines  enable row level security;
alter table crm_stages     enable row level security;
alter table crm_deals      enable row level security;
alter table crm_deal_events enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='crm_pipelines' and policyname='crm_pipelines ops all') then
    create policy "crm_pipelines ops all" on crm_pipelines for all using (is_ops()) with check (is_ops());
  end if;
  if not exists (select 1 from pg_policies where tablename='crm_stages' and policyname='crm_stages ops all') then
    create policy "crm_stages ops all" on crm_stages for all using (is_ops()) with check (is_ops());
  end if;
  if not exists (select 1 from pg_policies where tablename='crm_deals' and policyname='crm_deals ops all') then
    create policy "crm_deals ops all" on crm_deals for all using (is_ops()) with check (is_ops());
  end if;
  if not exists (select 1 from pg_policies where tablename='crm_deal_events' and policyname='deal_events ops all') then
    create policy "deal_events ops all" on crm_deal_events for all using (is_ops()) with check (is_ops());
  end if;
end $$;

-- Seed: default pipeline with 6 Arabic stages
do $$ declare v_pipeline uuid; v_s1 uuid; v_s6 uuid;
begin
  if not exists (select 1 from crm_pipelines limit 1) then
    insert into crm_pipelines (name, is_default, position)
    values ('مبيعات الجملة والمشاريع', true, 0)
    returning id into v_pipeline;

    insert into crm_stages (pipeline_id, name, position, win_pct, color) values
      (v_pipeline, 'جديد',       0,   5, '#6366f1'),
      (v_pipeline, 'تواصل',      1,  20, '#3b82f6'),
      (v_pipeline, 'عرض سعر',    2,  40, '#f59e0b'),
      (v_pipeline, 'تفاوض',      3,  70, '#f97316'),
      (v_pipeline, 'فوز',        4, 100, '#10b981'),
      (v_pipeline, 'خسارة',      5,   0, '#ef4444');

    update crm_stages set is_won  = true where pipeline_id = v_pipeline and name = 'فوز';
    update crm_stages set is_lost = true where pipeline_id = v_pipeline and name = 'خسارة';
  end if;
end $$;

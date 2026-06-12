-- Elite v1 — 0018 order events (real activity log) + order tags/notes
--
-- The admin order timeline was derived/synthetic; this makes it REAL. Every
-- status change is recorded automatically by trigger into `order_events`, so
-- the timeline is an immutable audit trail (Shopify-grade). Also adds `tags`
-- + `internal_note` to orders for ops filtering/annotation. Additive only.

alter table orders add column if not exists tags text[] not null default '{}';
alter table orders add column if not exists internal_note text;

create table if not exists order_events (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references orders(id) on delete cascade,
  kind        text not null,             -- 'placed' | 'status_changed' | 'note' | 'payment' | ...
  from_status order_status,
  to_status   order_status,
  note        text,
  actor_id    uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_order_events_order on order_events(order_id, created_at);

-- Auto-log: order placed + every status transition.
create or replace function log_order_event()
returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    insert into order_events(order_id, kind, to_status, actor_id)
    values (new.id, 'placed', new.status, auth.uid());
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into order_events(order_id, kind, from_status, to_status, actor_id)
    values (new.id, 'status_changed', old.status, new.status, auth.uid());
  end if;
  return new;
end; $$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_orders_log_event') then
    create trigger trg_orders_log_event
      after insert or update of status on orders
      for each row execute function log_order_event();
  end if;
end $$;

-- RLS: owner reads own order's events; ops read/insert all (manual notes).
alter table order_events enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'order_events' and policyname = 'order_events read') then
    create policy "order_events read" on order_events for select
      using (is_ops() or exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'order_events' and policyname = 'order_events ops insert') then
    create policy "order_events ops insert" on order_events for insert
      with check (is_ops());
  end if;
end $$;

-- Elite v1 — 0023 CRM notes & tasks on the customer profile
-- Zoho-grade notes/tasks: free-form notes + due-dated, completable tasks tied
-- to a customer, written by ops. Additive only; ops-gated RLS.

create table if not exists customer_notes (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id) on delete cascade,
  kind        text not null default 'note',     -- 'note' | 'task'
  body        text not null,
  due_at      date,
  done        boolean not null default false,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_customer_notes_customer on customer_notes(customer_id, created_at desc);

alter table customer_notes enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='customer_notes' and policyname='customer_notes ops all') then
    create policy "customer_notes ops all" on customer_notes
      for all using (is_ops()) with check (is_ops());
  end if;
end $$;

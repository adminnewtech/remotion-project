-- Elite v1 — 0024 appointments: installation / inspection / store-pickup
-- One native booking table covering تركيب، معاينة، استلام من المحل.
-- kind: 'installation' | 'inspection' | 'pickup'; status: 'booked'|'done'|'cancelled'.

create table if not exists appointments (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null default 'installation',
  customer_name text not null,
  phone         text,
  order_number  text,
  scheduled_at  timestamptz not null,
  status        text not null default 'booked',
  note          text,
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_appointments_when on appointments(scheduled_at);

alter table appointments enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='appointments' and policyname='appointments ops all') then
    create policy "appointments ops all" on appointments
      for all using (is_ops()) with check (is_ops());
  end if;
end $$;

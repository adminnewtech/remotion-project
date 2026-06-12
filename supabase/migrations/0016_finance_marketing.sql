-- Elite v1 — 0016 native finance & marketing
--
-- First-class, in-house tables so Finance and Marketing run on OUR data instead
-- of Zoho Books / Meta-only feeds — a step toward dropping those dependencies.
-- Invoices and revenue are DERIVED from existing orders + payments (no new
-- table); this migration adds the two pieces we don't already store: operating
-- `expenses` and `marketing_campaigns`. Idempotent; relies on the existing
-- is_ops()/is_admin() RLS helpers. No changes to existing tables.

-- ── Expenses ────────────────────────────────────────────────
create table if not exists expenses (
  id          uuid primary key default gen_random_uuid(),
  vendor      text not null,
  category    text not null default 'general',
  amount      numeric(10,3) not null check (amount >= 0),
  currency    text not null default 'KWD',
  incurred_on date not null default current_date,
  notes       text,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_expenses_incurred on expenses(incurred_on desc);
create index if not exists idx_expenses_category on expenses(category);

-- ── Marketing campaigns ─────────────────────────────────────
-- channel: 'meta' | 'google' | 'whatsapp' | 'in_app' | 'other'
-- status:  'active' | 'paused' | 'ended'
create table if not exists marketing_campaigns (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  channel     text not null default 'meta',
  status      text not null default 'active',
  spend       numeric(10,3) not null default 0,
  reach       int not null default 0,
  conversions int not null default 0,
  revenue     numeric(10,3) not null default 0,
  starts_on   date,
  ends_on     date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_campaigns_status on marketing_campaigns(status);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_campaigns_updated'
  ) then
    create trigger trg_campaigns_updated before update on marketing_campaigns
      for each row execute function set_updated_at();
  end if;
end $$;

-- ── RLS: ops read/write, admin full ─────────────────────────
alter table expenses            enable row level security;
alter table marketing_campaigns enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'expenses' and policyname = 'expenses ops all') then
    create policy "expenses ops all" on expenses
      for all using (is_ops()) with check (is_ops());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'marketing_campaigns' and policyname = 'campaigns ops all') then
    create policy "campaigns ops all" on marketing_campaigns
      for all using (is_ops()) with check (is_ops());
  end if;
end $$;

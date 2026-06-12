-- Elite v1 — 0017 store settings & delivery zones
--
-- First-party configuration so operators run the business from our own admin
-- instead of Shopify/Zid settings. Idempotent; additive only. Settings are a
-- singleton row; delivery zones are per governorate/area with a fee + ETA.
-- Relies on existing is_admin()/is_staff() RLS helpers.

create table if not exists app_settings (
  id                       int primary key default 1 check (id = 1),
  store_name_ar            text not null default 'نيوتك',
  store_name_en            text not null default 'Newtech',
  support_phone            text,
  support_email            text,
  whatsapp_number          text,
  currency                 text not null default 'KWD',
  free_delivery_threshold  numeric(10,3) not null default 10,
  default_delivery_fee     numeric(10,3) not null default 2,
  default_installation_fee numeric(10,3) not null default 5,
  payments                 jsonb not null default '{"knet":true,"cod":true,"apple_pay":false,"google_pay":false}'::jsonb,
  notifications            jsonb not null default '{"push":true,"email":true,"whatsapp":true,"sms":false}'::jsonb,
  business_hours           jsonb not null default '{"open":"10:00","close":"22:00","days":["sat","sun","mon","tue","wed","thu"]}'::jsonb,
  updated_at               timestamptz not null default now()
);

-- Seed the singleton row once.
insert into app_settings (id) values (1) on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_app_settings_updated') then
    create trigger trg_app_settings_updated before update on app_settings
      for each row execute function set_updated_at();
  end if;
end $$;

create table if not exists delivery_zones (
  id           uuid primary key default gen_random_uuid(),
  governorate  text not null,
  area         text,
  fee          numeric(10,3) not null default 2,
  eta_hours    int not null default 24,
  is_active    boolean not null default true,
  sort         int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists idx_delivery_zones_active on delivery_zones(is_active);

-- ── RLS: public read (storefront needs fees/threshold), admin write ──
alter table app_settings   enable row level security;
alter table delivery_zones enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'app_settings' and policyname = 'settings public read') then
    create policy "settings public read" on app_settings for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'app_settings' and policyname = 'settings admin write') then
    create policy "settings admin write" on app_settings for all using (is_admin()) with check (is_admin());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'delivery_zones' and policyname = 'zones public read') then
    create policy "zones public read" on delivery_zones for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'delivery_zones' and policyname = 'zones admin write') then
    create policy "zones admin write" on delivery_zones for all using (is_admin()) with check (is_admin());
  end if;
end $$;

-- Seed Kuwait's six governorates as starter zones (once).
insert into delivery_zones (governorate, area, fee, eta_hours, sort)
select g, null, 2, 24, s
from (values
  ('العاصمة', 1), ('حولي', 2), ('الفروانية', 3),
  ('الأحمدي', 4), ('الجهراء', 5), ('مبارك الكبير', 6)
) as t(g, s)
where not exists (select 1 from delivery_zones);

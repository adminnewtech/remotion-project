-- Elite v1 — 0001 init: extensions, enums, helpers, identity
-- Source of truth for the platform schema. Do not edit the DB by hand.

create extension if not exists "pg_trgm";
create extension if not exists "uuid-ossp";

-- ── Enums ────────────────────────────────────────────────
create type user_role as enum ('customer', 'employee', 'technician', 'driver', 'admin');
create type order_status as enum (
  'draft', 'pending_payment', 'paid', 'processing',
  'out_for_delivery', 'delivered', 'installing', 'completed',
  'cancelled', 'refunded'
);
create type payment_status as enum ('pending', 'authorized', 'paid', 'failed', 'refunded');
create type payment_method as enum ('knet', 'apple_pay', 'google_pay', 'card', 'cod');
create type fulfillment_type as enum ('delivery', 'installation', 'pickup');
create type task_status as enum (
  'unassigned', 'assigned', 'accepted', 'en_route',
  'arrived', 'in_progress', 'completed', 'failed', 'cancelled'
);
create type ticket_status as enum ('open', 'pending', 'resolved', 'closed');
create type ticket_kind as enum ('general', 'warranty', 'complaint', 'return');
create type media_kind as enum ('image', 'video');
create type discount_kind as enum ('percent', 'amount', 'free_delivery');

-- ── updated_at helper ────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

-- ── Identity ─────────────────────────────────────────────
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        user_role not null default 'customer',
  full_name   text,
  phone       text unique,
  email       text,
  avatar_url  text,
  locale      text not null default 'ar' check (locale in ('ar','en')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_profiles_updated before update on profiles
  for each row execute function set_updated_at();

-- Role helpers (security definer so RLS policies can call them safely)
create or replace function current_role_is(target user_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = target);
$$;

create or replace function is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('employee','technician','driver','admin')
  );
$$;

create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function is_ops()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('employee','admin'));
$$;

-- Auto-create a profile when a new auth user appears
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.phone, new.email)
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── Locations (warehouses / stores) ─────────────────────
create table locations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  area       text,
  lat        double precision,
  lng        double precision,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── Kuwait addresses ────────────────────────────────────
create table addresses (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references profiles(id) on delete cascade,
  label            text,
  governorate      text,
  area             text,
  block            text,
  street           text,
  building         text,
  floor            text,
  apartment        text,
  extra_directions text,
  lat              double precision,
  lng              double precision,
  is_default       boolean not null default false,
  created_at       timestamptz not null default now()
);
create index idx_addresses_user on addresses(user_id);

-- Staff service zones (driver/technician dispatch)
create table staff_zones (
  id        uuid primary key default gen_random_uuid(),
  staff_id  uuid not null references profiles(id) on delete cascade,
  area      text not null,
  unique (staff_id, area)
);
create index idx_staff_zones_area on staff_zones(area);

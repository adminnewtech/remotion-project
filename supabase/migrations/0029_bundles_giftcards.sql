-- Elite v1 — 0029: product bundles + gift cards
-- Additive, idempotent. Money: numeric(12,3) KWD.

-- product.kind: physical (default), service, gift_card
alter table products
  add column if not exists kind text not null default 'physical'
    check (kind in ('physical','service','gift_card'));

-- Product bundles (AC unit + installation as one sellable item)
create table if not exists product_bundles (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete cascade,
  name        text not null,
  bundle_price numeric(12,3),
  is_active   boolean not null default true,
  unique (product_id)
);

create table if not exists bundle_components (
  id         uuid primary key default gen_random_uuid(),
  bundle_id  uuid not null references product_bundles(id) on delete cascade,
  component  text not null check (component in ('variant','service')),
  variant_id uuid references product_variants(id) on delete restrict,
  service    text check (service in ('installation','inspection',null)),
  qty        int not null default 1 check (qty > 0),
  price_part numeric(12,3) not null default 0,
  check ((component = 'variant') = (variant_id is not null))
);

alter table product_bundles   enable row level security;
alter table bundle_components enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='product_bundles' and policyname='bundles ops all') then
    create policy "bundles ops all" on product_bundles for all using (is_ops()) with check (is_ops());
  end if;
  if not exists (select 1 from pg_policies where tablename='bundle_components' and policyname='bundle_components ops all') then
    create policy "bundle_components ops all" on bundle_components for all using (is_ops()) with check (is_ops());
  end if;
end $$;

-- Gift cards
create table if not exists gift_cards (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,
  initial_value       numeric(12,3) not null check (initial_value > 0),
  balance             numeric(12,3) not null,
  currency            text not null default 'KWD',
  purchaser_order_id  uuid references orders(id) on delete set null,
  recipient_phone     text,
  expires_at          date,
  status              text not null default 'active'
    check (status in ('active','depleted','expired','voided')),
  created_at          timestamptz not null default now()
);

create table if not exists gift_card_transactions (
  id           bigint generated always as identity primary key,
  gift_card_id uuid not null references gift_cards(id) on delete cascade,
  order_id     uuid references orders(id) on delete set null,
  amount       numeric(12,3) not null,
  kind         text not null check (kind in ('issue','redeem','refund','adjust')),
  actor_id     uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

alter table gift_cards             enable row level security;
alter table gift_card_transactions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='gift_cards' and policyname='gift_cards ops all') then
    create policy "gift_cards ops all" on gift_cards for all using (is_ops()) with check (is_ops());
  end if;
  if not exists (select 1 from pg_policies where tablename='gift_card_transactions' and policyname='gc_tx ops all') then
    create policy "gc_tx ops all" on gift_card_transactions for all using (is_ops()) with check (is_ops());
  end if;
end $$;

-- redeem_gift_card: atomic balance deduction, returns amount actually taken
create or replace function redeem_gift_card(p_code text, p_order uuid, p_amount numeric)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_card gift_cards; v_take numeric(12,3);
begin
  select * into v_card
    from gift_cards
   where code = upper(p_code)
     and status = 'active'
     and (expires_at is null or expires_at >= current_date)
   for update;
  if not found then raise exception 'gift card invalid or expired: %', p_code; end if;
  v_take := least(v_card.balance, p_amount);
  update gift_cards
     set balance = round(balance - v_take, 3),
         status  = case when round(balance - v_take, 3) <= 0 then 'depleted' else 'active' end
   where id = v_card.id;
  insert into gift_card_transactions (gift_card_id, order_id, amount, kind)
    values (v_card.id, p_order, -v_take, 'redeem');
  return v_take;
end; $$;
revoke execute on function redeem_gift_card(text, uuid, numeric) from public, anon, authenticated;
grant  execute on function redeem_gift_card(text, uuid, numeric) to authenticated;

-- issue_gift_card: called by payment-webhook on paid gift_card orders
create or replace function issue_gift_card(
  p_order_id uuid, p_amount numeric, p_recipient_phone text default null,
  p_expires_days int default 365
) returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  v_code := 'GC-' || upper(substring(encode(gen_random_bytes(10), 'base64') from 1 for 16));
  v_code := translate(v_code, '+/=', 'ABC');
  insert into gift_cards (code, initial_value, balance, purchaser_order_id, recipient_phone, expires_at)
    values (v_code, p_amount, p_amount, p_order_id, p_recipient_phone,
            current_date + p_expires_days);
  insert into gift_card_transactions (gift_card_id, order_id, amount, kind)
    select id, p_order_id, p_amount, 'issue' from gift_cards where code = v_code;
  return v_code;
end; $$;
revoke execute on function issue_gift_card(uuid, numeric, text, int) from public, anon, authenticated;
grant  execute on function issue_gift_card(uuid, numeric, text, int) to service_role;

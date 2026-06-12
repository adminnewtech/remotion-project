-- Elite v1 — 0030: pickup-at-store, wishlists, reviews moderation
-- Additive, idempotent.

-- Pickup support on orders
alter table orders
  add column if not exists fulfillment        text not null default 'delivery'
    check (fulfillment in ('delivery','pickup')),
  add column if not exists pickup_location_id uuid references locations(id) on delete set null,
  add column if not exists pickup_code        text;

alter table locations
  add column if not exists allows_pickup boolean not null default false;

create sequence if not exists pickup_code_seq start 1;

-- Reviews moderation columns
alter table reviews
  add column if not exists status   text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  add column if not exists verified boolean not null default false,
  add column if not exists reply    text;

-- verified = purchased the product (set in before-insert trigger)
create or replace function set_review_verified() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.verified := exists (
    select 1 from orders o
    join order_items oi on oi.order_id = o.id
    join product_variants pv on pv.id = oi.variant_id
    where o.user_id = new.user_id
      and pv.product_id = new.product_id
      and o.status = 'completed'
  );
  return new;
end; $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_review_verified') then
    create trigger trg_review_verified
      before insert on reviews
      for each row execute function set_review_verified();
  end if;
end $$;
revoke execute on function set_review_verified() from public, anon, authenticated;

-- rating aggregates on products
alter table products
  add column if not exists rating_avg   numeric(3,2) not null default 0,
  add column if not exists rating_count int          not null default 0;

create or replace function refresh_product_rating() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_pid uuid;
begin
  v_pid := coalesce(new.product_id, old.product_id);
  update products
     set rating_avg   = coalesce((
           select round(avg(rating)::numeric, 2) from reviews
            where product_id = v_pid and status = 'approved'), 0),
         rating_count = (
           select count(*) from reviews
            where product_id = v_pid and status = 'approved')
   where id = v_pid;
  return coalesce(new, old);
end; $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_rating_refresh') then
    create trigger trg_rating_refresh
      after insert or update of status or delete on reviews
      for each row execute function refresh_product_rating();
  end if;
end $$;
revoke execute on function refresh_product_rating() from public, anon, authenticated;

-- Wishlists
create table if not exists wishlist_items (
  user_id    uuid not null references profiles(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
alter table wishlist_items enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='wishlist_items' and policyname='wishlist owner all') then
    create policy "wishlist owner all" on wishlist_items
      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='wishlist_items' and policyname='wishlist ops read') then
    create policy "wishlist ops read" on wishlist_items for select using (is_ops());
  end if;
end $$;

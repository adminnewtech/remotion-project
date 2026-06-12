-- Elite v1 — 0021 returns / RMA (native — Shopify needs 3rd-party apps here)
--
-- Structured return: requested → approved → received → refunded | rejected.
-- Receiving restocks via the ATOMIC ledger ('return' move, ref = RMA number);
-- refunding writes a negative captured payment row and flips the order to
-- 'refunded' when fully refunded. Additive only.

create sequence if not exists rma_number_seq start 501;

create table if not exists returns (
  id          uuid primary key default gen_random_uuid(),
  rma_number  text not null unique default ('RMA-' || nextval('rma_number_seq')::text),
  order_id    uuid not null references orders(id) on delete cascade,
  status      text not null default 'requested',  -- requested|approved|received|refunded|rejected
  reason      text not null,
  refund_amount numeric(10,3) not null default 0,
  restock     boolean not null default true,
  location_id uuid references locations(id) on delete set null,
  note        text,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_returns_order on returns(order_id);

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_returns_updated') then
    create trigger trg_returns_updated before update on returns
      for each row execute function set_updated_at();
  end if;
end $$;

create table if not exists return_items (
  id          uuid primary key default gen_random_uuid(),
  return_id   uuid not null references returns(id) on delete cascade,
  order_item_id uuid not null references order_items(id) on delete restrict,
  variant_id  uuid references product_variants(id) on delete set null,
  qty         int not null check (qty > 0),
  unit_price  numeric(10,3) not null default 0
);
create index if not exists idx_return_items_return on return_items(return_id);

-- RLS: customer can read + open a request on their own order; ops manage all.
alter table returns      enable row level security;
alter table return_items enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='returns' and policyname='returns read') then
    create policy "returns read" on returns for select
      using (is_ops() or exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='returns' and policyname='returns customer request') then
    create policy "returns customer request" on returns for insert
      with check (is_ops() or exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='returns' and policyname='returns ops update') then
    create policy "returns ops update" on returns for update using (is_ops()) with check (is_ops());
  end if;
  if not exists (select 1 from pg_policies where tablename='return_items' and policyname='return_items read') then
    create policy "return_items read" on return_items for select
      using (is_ops() or exists (
        select 1 from returns r join orders o on o.id = r.order_id
        where r.id = return_id and o.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='return_items' and policyname='return_items write') then
    create policy "return_items write" on return_items for insert
      with check (is_ops() or exists (
        select 1 from returns r join orders o on o.id = r.order_id
        where r.id = return_id and o.user_id = auth.uid()));
  end if;
end $$;

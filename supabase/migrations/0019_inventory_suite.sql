-- Elite v1 — 0019 inventory suite: movements ledger, suppliers, purchasing,
-- serials & batches. Multi-location is first-class (locations table already
-- exists; inventory is per variant×location).
--
-- Core idea: `stock_moves` is the immutable LEDGER (Zoho/Cin7-grade); on-hand
-- is updated atomically with each move via apply_stock_move(). Transfers are
-- two moves in one transaction. Purchase receiving writes 'purchase' moves and
-- captures serials/batches for electronics warranty lookup. Additive only.

-- ── Suppliers ───────────────────────────────────────────────
create table if not exists suppliers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text,
  email      text,
  notes      text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── Stock movements ledger (immutable) ──────────────────────
-- kind: purchase | sale | adjustment | transfer_in | transfer_out | return
create table if not exists stock_moves (
  id          bigint generated always as identity primary key,
  variant_id  uuid not null references product_variants(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  qty         int not null check (qty <> 0),      -- signed: +in / -out
  kind        text not null,
  ref         text,                               -- PO number / order number / transfer id
  batch_no    text,
  note        text,
  actor_id    uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_stock_moves_variant on stock_moves(variant_id, created_at desc);
create index if not exists idx_stock_moves_location on stock_moves(location_id, created_at desc);

-- ── Purchasing ──────────────────────────────────────────────
create sequence if not exists po_number_seq start 1001;
create table if not exists purchase_orders (
  id          uuid primary key default gen_random_uuid(),
  po_number   text not null unique default ('PO-' || nextval('po_number_seq')::text),
  supplier_id uuid references suppliers(id) on delete set null,
  location_id uuid not null references locations(id) on delete restrict,
  status      text not null default 'draft',      -- draft | ordered | partial | received | cancelled
  expected_at date,
  note        text,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_po_updated') then
    create trigger trg_po_updated before update on purchase_orders
      for each row execute function set_updated_at();
  end if;
end $$;

create table if not exists purchase_order_items (
  id           uuid primary key default gen_random_uuid(),
  po_id        uuid not null references purchase_orders(id) on delete cascade,
  variant_id   uuid not null references product_variants(id) on delete restrict,
  qty_ordered  int not null check (qty_ordered > 0),
  qty_received int not null default 0 check (qty_received >= 0),
  unit_cost    numeric(10,3) not null default 0
);
create index if not exists idx_po_items_po on purchase_order_items(po_id);

-- ── Serial numbers (electronics warranty) ───────────────────
-- status: in_stock | sold | returned | defective
create table if not exists product_serials (
  id          uuid primary key default gen_random_uuid(),
  variant_id  uuid not null references product_variants(id) on delete cascade,
  serial      text not null unique,
  status      text not null default 'in_stock',
  location_id uuid references locations(id) on delete set null,
  batch_no    text,
  po_id       uuid references purchase_orders(id) on delete set null,
  order_id    uuid references orders(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_serials_variant on product_serials(variant_id, status);

-- ── Atomic move application ─────────────────────────────────
-- Inserts the ledger row AND updates on-hand in one statement-level tx.
-- Negative resulting stock is rejected except for 'adjustment' (shrinkage).
create or replace function apply_stock_move(
  p_variant uuid, p_location uuid, p_qty int, p_kind text,
  p_ref text default null, p_batch text default null, p_note text default null
) returns bigint language plpgsql security definer as $$
declare
  v_move_id bigint;
  v_new_on_hand int;
begin
  insert into inventory (variant_id, location_id, on_hand)
  values (p_variant, p_location, 0)
  on conflict (variant_id, location_id) do nothing;

  update inventory
    set on_hand = on_hand + p_qty
    where variant_id = p_variant and location_id = p_location
    returning on_hand into v_new_on_hand;

  if v_new_on_hand < 0 and p_kind <> 'adjustment' then
    raise exception 'insufficient stock (would be %)', v_new_on_hand;
  end if;
  if v_new_on_hand < 0 then
    -- clamp adjustments at zero but keep the audited intent in the ledger
    update inventory set on_hand = 0
      where variant_id = p_variant and location_id = p_location;
  end if;

  insert into stock_moves (variant_id, location_id, qty, kind, ref, batch_no, note, actor_id)
  values (p_variant, p_location, p_qty, p_kind, p_ref, p_batch, p_note, auth.uid())
  returning id into v_move_id;

  return v_move_id;
end; $$;

-- Transfer = out@from + in@to atomically.
create or replace function transfer_stock(
  p_variant uuid, p_from uuid, p_to uuid, p_qty int, p_note text default null
) returns void language plpgsql security definer as $$
declare v_ref text := 'TR-' || to_char(now(), 'YYYYMMDDHH24MISS');
begin
  if p_qty <= 0 then raise exception 'qty must be positive'; end if;
  if p_from = p_to then raise exception 'same location'; end if;
  perform apply_stock_move(p_variant, p_from, -p_qty, 'transfer_out', v_ref, null, p_note);
  perform apply_stock_move(p_variant, p_to,    p_qty, 'transfer_in',  v_ref, null, p_note);
end; $$;

-- ── RLS: ops everything ─────────────────────────────────────
alter table suppliers            enable row level security;
alter table stock_moves          enable row level security;
alter table purchase_orders      enable row level security;
alter table purchase_order_items enable row level security;
alter table product_serials      enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='suppliers' and policyname='suppliers ops all') then
    create policy "suppliers ops all" on suppliers for all using (is_ops()) with check (is_ops());
  end if;
  if not exists (select 1 from pg_policies where tablename='stock_moves' and policyname='stock_moves ops read') then
    create policy "stock_moves ops read" on stock_moves for select using (is_ops());
  end if;
  if not exists (select 1 from pg_policies where tablename='purchase_orders' and policyname='po ops all') then
    create policy "po ops all" on purchase_orders for all using (is_ops()) with check (is_ops());
  end if;
  if not exists (select 1 from pg_policies where tablename='purchase_order_items' and policyname='po items ops all') then
    create policy "po items ops all" on purchase_order_items for all using (is_ops()) with check (is_ops());
  end if;
  if not exists (select 1 from pg_policies where tablename='product_serials' and policyname='serials ops all') then
    create policy "serials ops all" on product_serials for all using (is_ops()) with check (is_ops());
  end if;
end $$;

grant execute on function apply_stock_move(uuid,uuid,int,text,text,text,text) to authenticated;
grant execute on function transfer_stock(uuid,uuid,uuid,int,text) to authenticated;

-- Seed a second location so multi-location is real out of the box.
insert into locations (name, area)
select 'مخزن الشويخ', 'الشويخ الصناعية'
where not exists (select 1 from locations where name = 'مخزن الشويخ');

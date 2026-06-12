-- Elite v1 — 0028: landed costs, avg_cost, sell_serial, warranties
-- Additive, idempotent. Money: numeric(12,3) KWD.

-- avg_cost cache on variants (feeds COGS + margin)
alter table product_variants
  add column if not exists avg_cost numeric(12,3) not null default 0;

-- warranty_months on products
alter table products
  add column if not exists warranty_months int not null default 12;

-- po_costs: extra costs (freight, customs) to allocate onto PO receipts
create table if not exists po_costs (
  id         uuid primary key default gen_random_uuid(),
  po_id      uuid not null references purchase_orders(id) on delete cascade,
  kind       text not null check (kind in ('freight','customs','clearance','other')),
  amount     numeric(12,3) not null check (amount >= 0),
  allocation text not null default 'by_value' check (allocation in ('by_value','by_qty')),
  note       text,
  created_at timestamptz not null default now()
);
alter table purchase_order_items
  add column if not exists landed_unit_cost numeric(12,3);

alter table po_costs enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='po_costs' and policyname='po_costs ops all') then
    create policy "po_costs ops all" on po_costs for all using (is_ops()) with check (is_ops());
  end if;
end $$;

-- allocate_landed_costs: compute landed_unit_cost per PO item
create or replace function allocate_landed_costs(p_po uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_total_value numeric(12,3);
  v_total_qty   int;
begin
  select coalesce(sum(qty_ordered * unit_cost), 0),
         coalesce(sum(qty_ordered), 0)
    into v_total_value, v_total_qty
    from purchase_order_items
   where po_id = p_po;

  update purchase_order_items i
     set landed_unit_cost = i.unit_cost + coalesce((
       select sum(
         case when c.allocation = 'by_qty'
              then c.amount / nullif(v_total_qty, 0)
              else c.amount * (i.unit_cost / nullif(v_total_value, 0))
         end
       )
       from po_costs c where c.po_id = p_po
     ), 0)
   where i.po_id = p_po;
end; $$;
revoke execute on function allocate_landed_costs(uuid) from public, anon, authenticated;
grant  execute on function allocate_landed_costs(uuid) to authenticated;

-- sell_serial: mark a serial as sold for an order line (validates in_stock)
create or replace function sell_serial(p_serial text, p_order_id uuid, p_variant_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_ops() then raise exception 'forbidden'; end if;
  select id into v_id from product_serials
   where serial = p_serial
     and variant_id = p_variant_id
     and status = 'in_stock'
   for update;
  if not found then raise exception 'serial % not in stock for this variant', p_serial; end if;
  update product_serials set status = 'sold', order_id = p_order_id where id = v_id;
  return v_id;
end; $$;
revoke execute on function sell_serial(text, uuid, uuid) from public, anon, authenticated;
grant  execute on function sell_serial(text, uuid, uuid) to authenticated;

-- Warranties table
create table if not exists warranties (
  id          uuid primary key default gen_random_uuid(),
  serial_id   uuid not null references product_serials(id) on delete cascade,
  order_id    uuid references orders(id) on delete set null,
  customer_id uuid references profiles(id) on delete set null,
  starts_at   date not null,
  expires_at  date not null,
  status      text not null default 'active'
    check (status in ('active','expired','voided','claimed')),
  unique (serial_id)
);
create index if not exists idx_warranties_expiry on warranties(expires_at) where status = 'active';
create index if not exists idx_warranties_customer on warranties(customer_id);

alter table warranties enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='warranties' and policyname='warranties ops all') then
    create policy "warranties ops all" on warranties for all using (is_ops()) with check (is_ops());
  end if;
end $$;

-- activate_warranties: fires when order status → completed
create or replace function activate_warranties() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and (old.status is distinct from 'completed') then
    insert into warranties (serial_id, order_id, customer_id, starts_at, expires_at)
    select ps.id, new.id, new.user_id, current_date,
           current_date + make_interval(months => coalesce(p.warranty_months, 12))
      from product_serials ps
      join product_variants pv on pv.id = ps.variant_id
      join products p on p.id = pv.product_id
     where ps.order_id = new.id
       and ps.status = 'sold'
    on conflict (serial_id) do nothing;
  end if;
  return new;
end; $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_activate_warranties') then
    create trigger trg_activate_warranties
      after update of status on orders
      for each row execute function activate_warranties();
  end if;
end $$;
revoke execute on function activate_warranties() from public, anon, authenticated;

-- Elite v1 — 0027: ERP cycle counts + reorder policies + van-stock locations
-- Additive, idempotent (if not exists guards throughout). Money: numeric(12,3) KWD.

-- Van/truck support on locations
alter table locations
  add column if not exists kind      text not null default 'store'
    check (kind in ('store','warehouse','van')),
  add column if not exists owner_id  uuid references profiles(id) on delete set null;

-- Cycle counts
create sequence if not exists count_number_seq start 101;
create table if not exists cycle_counts (
  id           uuid primary key default gen_random_uuid(),
  count_number text not null unique default ('CC-' || nextval('count_number_seq')::text),
  location_id  uuid not null references locations(id) on delete restrict,
  status       text not null default 'draft'
    check (status in ('draft','counting','review','posted','cancelled')),
  scope        jsonb not null default '{}',
  note         text,
  created_by   uuid references profiles(id) on delete set null,
  posted_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists cycle_count_items (
  id          uuid primary key default gen_random_uuid(),
  count_id    uuid not null references cycle_counts(id) on delete cascade,
  variant_id  uuid not null references product_variants(id) on delete restrict,
  expected    int not null default 0,
  counted     int,
  counted_by  uuid references profiles(id) on delete set null,
  counted_at  timestamptz,
  unique (count_id, variant_id)
);

-- RLS
alter table cycle_counts      enable row level security;
alter table cycle_count_items enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='cycle_counts' and policyname='cycle_counts ops all') then
    create policy "cycle_counts ops all" on cycle_counts for all using (is_ops()) with check (is_ops());
  end if;
  if not exists (select 1 from pg_policies where tablename='cycle_count_items' and policyname='cycle_count_items ops all') then
    create policy "cycle_count_items ops all" on cycle_count_items for all using (is_ops()) with check (is_ops());
  end if;
end $$;

-- post_cycle_count: apply variances as adjustment stock moves
create or replace function post_cycle_count(p_count uuid) returns int
language plpgsql security definer set search_path = public as $$
declare r record; v_moves int := 0;
begin
  if not is_ops() then raise exception 'forbidden'; end if;
  perform 1 from cycle_counts where id = p_count and status = 'review' for update;
  if not found then raise exception 'count not in review status'; end if;
  for r in
    select i.variant_id, (i.counted - i.expected) as diff,
           c.location_id, c.count_number
      from cycle_count_items i
      join cycle_counts c on c.id = i.count_id
     where i.count_id = p_count
       and i.counted is not null
       and i.counted <> i.expected
  loop
    perform apply_stock_move(
      r.variant_id, r.location_id, r.diff,
      'adjustment', r.count_number, null, 'cycle count variance'
    );
    v_moves := v_moves + 1;
  end loop;
  update cycle_counts set status = 'posted', posted_at = now(), updated_at = now()
   where id = p_count;
  return v_moves;
end; $$;
revoke execute on function post_cycle_count(uuid) from public, anon, authenticated;
grant  execute on function post_cycle_count(uuid) to authenticated;

-- Reorder policies
create table if not exists reorder_policies (
  variant_id   uuid not null references product_variants(id) on delete cascade,
  location_id  uuid not null references locations(id) on delete cascade,
  min_qty      int not null default 0 check (min_qty >= 0),
  max_qty      int not null default 0 check (max_qty >= min_qty),
  supplier_id  uuid references suppliers(id) on delete set null,
  is_active    boolean not null default true,
  updated_at   timestamptz not null default now(),
  primary key (variant_id, location_id)
);
alter table reorder_policies enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='reorder_policies' and policyname='reorder_policies ops all') then
    create policy "reorder_policies ops all" on reorder_policies for all using (is_ops()) with check (is_ops());
  end if;
end $$;

-- generate_reorder_pos: create draft POs for every item at/below min_qty
create or replace function generate_reorder_pos(p_location uuid) returns setof uuid
language plpgsql security definer set search_path = public as $$
declare v_supplier uuid; v_po uuid;
begin
  if not is_ops() then raise exception 'forbidden'; end if;
  for v_supplier in
    select distinct rp.supplier_id
      from reorder_policies rp
      join inventory i on i.variant_id = rp.variant_id
                      and i.location_id = rp.location_id
     where rp.location_id = p_location
       and rp.is_active
       and rp.supplier_id is not null
       and i.on_hand <= rp.min_qty
       and not exists (
         select 1 from purchase_order_items pi
         join purchase_orders po on po.id = pi.po_id
         where pi.variant_id = rp.variant_id
           and po.location_id = rp.location_id
           and po.status in ('draft','ordered','partial')
       )
  loop
    insert into purchase_orders
      (supplier_id, location_id, status, note, created_by)
    values
      (v_supplier, p_location, 'draft', 'auto-reorder', auth.uid())
    returning id into v_po;

    insert into purchase_order_items (po_id, variant_id, qty_ordered, unit_cost)
    select v_po, rp.variant_id, rp.max_qty - i.on_hand,
           coalesce(pv.avg_cost, pv.price, 0)
      from reorder_policies rp
      join inventory i on i.variant_id = rp.variant_id
                      and i.location_id = rp.location_id
      join product_variants pv on pv.id = rp.variant_id
     where rp.location_id = p_location
       and rp.supplier_id = v_supplier
       and rp.is_active
       and i.on_hand <= rp.min_qty;
    return next v_po;
  end loop;
end; $$;
revoke execute on function generate_reorder_pos(uuid) from public, anon, authenticated;
grant  execute on function generate_reorder_pos(uuid) to authenticated;

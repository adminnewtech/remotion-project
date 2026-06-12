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
-- Elite v1 — 0031: CRM pipelines, stages, deals, deal event log
-- Additive, idempotent. Money: numeric(12,3) KWD.

create table if not exists crm_pipelines (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  is_default boolean not null default false,
  position   int  not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists crm_stages (
  id          uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references crm_pipelines(id) on delete cascade,
  name        text not null,
  position    int  not null default 0,
  win_pct     int  not null default 0 check (win_pct between 0 and 100),
  color       text not null default '#6366f1',
  is_won      boolean not null default false,
  is_lost     boolean not null default false
);

create sequence if not exists deal_number_seq start 2001;
create table if not exists crm_deals (
  id             uuid primary key default gen_random_uuid(),
  deal_number    text not null unique default ('DL-' || nextval('deal_number_seq')::text),
  pipeline_id    uuid not null references crm_pipelines(id) on delete restrict,
  stage_id       uuid not null references crm_stages(id) on delete restrict,
  customer_id    uuid references profiles(id) on delete set null,
  title          text not null,
  value          numeric(12,3) not null default 0,
  expected_close date,
  owner_id       uuid references profiles(id) on delete set null,
  source         text check (source in ('whatsapp','walk_in','web','referral','agent',null)),
  order_id       uuid references orders(id) on delete set null,
  lost_reason    text,
  meta           jsonb not null default '{}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_deals_stage    on crm_deals(stage_id);
create index if not exists idx_deals_customer on crm_deals(customer_id);
create index if not exists idx_deals_owner    on crm_deals(owner_id);

create table if not exists crm_deal_events (
  id         bigint generated always as identity primary key,
  deal_id    uuid not null references crm_deals(id) on delete cascade,
  kind       text not null,
  from_stage uuid references crm_stages(id) on delete set null,
  to_stage   uuid references crm_stages(id) on delete set null,
  note       text,
  actor_id   uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_deal_events_deal on crm_deal_events(deal_id, created_at desc);

-- Auto-log stage changes (mirrors order_events pattern)
create or replace function log_deal_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into crm_deal_events (deal_id, kind, to_stage, actor_id)
    values (new.id, 'created', new.stage_id, auth.uid());
  elsif tg_op = 'UPDATE' and new.stage_id is distinct from old.stage_id then
    insert into crm_deal_events (deal_id, kind, from_stage, to_stage, actor_id)
    values (new.id, 'stage_changed', old.stage_id, new.stage_id, auth.uid());
  end if;
  return new;
end; $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_deal_event') then
    create trigger trg_deal_event
      after insert or update on crm_deals
      for each row execute function log_deal_event();
  end if;
end $$;
revoke execute on function log_deal_event() from public, anon, authenticated;

-- RLS
alter table crm_pipelines  enable row level security;
alter table crm_stages     enable row level security;
alter table crm_deals      enable row level security;
alter table crm_deal_events enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='crm_pipelines' and policyname='crm_pipelines ops all') then
    create policy "crm_pipelines ops all" on crm_pipelines for all using (is_ops()) with check (is_ops());
  end if;
  if not exists (select 1 from pg_policies where tablename='crm_stages' and policyname='crm_stages ops all') then
    create policy "crm_stages ops all" on crm_stages for all using (is_ops()) with check (is_ops());
  end if;
  if not exists (select 1 from pg_policies where tablename='crm_deals' and policyname='crm_deals ops all') then
    create policy "crm_deals ops all" on crm_deals for all using (is_ops()) with check (is_ops());
  end if;
  if not exists (select 1 from pg_policies where tablename='crm_deal_events' and policyname='deal_events ops all') then
    create policy "deal_events ops all" on crm_deal_events for all using (is_ops()) with check (is_ops());
  end if;
end $$;

-- Seed: default pipeline with 6 Arabic stages
do $$ declare v_pipeline uuid; v_s1 uuid; v_s6 uuid;
begin
  if not exists (select 1 from crm_pipelines limit 1) then
    insert into crm_pipelines (name, is_default, position)
    values ('مبيعات الجملة والمشاريع', true, 0)
    returning id into v_pipeline;

    insert into crm_stages (pipeline_id, name, position, win_pct, color) values
      (v_pipeline, 'جديد',       0,   5, '#6366f1'),
      (v_pipeline, 'تواصل',      1,  20, '#3b82f6'),
      (v_pipeline, 'عرض سعر',    2,  40, '#f59e0b'),
      (v_pipeline, 'تفاوض',      3,  70, '#f97316'),
      (v_pipeline, 'فوز',        4, 100, '#10b981'),
      (v_pipeline, 'خسارة',      5,   0, '#ef4444');

    update crm_stages set is_won  = true where pipeline_id = v_pipeline and name = 'فوز';
    update crm_stages set is_lost = true where pipeline_id = v_pipeline and name = 'خسارة';
  end if;
end $$;
-- Elite v1 — 0032: WhatsApp message store + templates + is_draft on ticket_messages
-- Additive, idempotent.

-- WhatsApp message log (inbound + outbound, delivery status)
create table if not exists wa_messages (
  id          uuid primary key default gen_random_uuid(),
  wa_id       text unique,
  ticket_id   uuid references tickets(id) on delete set null,
  customer_id uuid references profiles(id) on delete set null,
  phone       text not null,
  direction   text not null check (direction in ('in','out')),
  kind        text not null default 'text'
    check (kind in ('text','template','image','document','interactive')),
  body        text,
  template    text,
  media_url   text,
  status      text not null default 'sent'
    check (status in ('received','sent','delivered','read','failed')),
  sent_by     uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_wa_phone on wa_messages(phone, created_at desc);
create index if not exists idx_wa_ticket on wa_messages(ticket_id, created_at desc);

-- WhatsApp template registry
create table if not exists wa_templates (
  name       text primary key,
  language   text not null default 'ar',
  category   text not null default 'utility'
    check (category in ('utility','marketing','authentication')),
  body       text not null,
  params     int  not null default 0,
  is_active  boolean not null default true
);

-- 24h customer-service window
create or replace function wa_window_open(p_phone text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from wa_messages
     where phone = p_phone
       and direction = 'in'
       and created_at > now() - interval '24 hours'
  );
$$;
revoke execute on function wa_window_open(text) from public, anon, authenticated;
grant  execute on function wa_window_open(text) to service_role, authenticated;

-- is_draft on ticket_messages (for triage agent drafts — not visible to customers)
alter table ticket_messages
  add column if not exists is_draft boolean not null default false;

-- RLS
alter table wa_messages  enable row level security;
alter table wa_templates enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='wa_messages' and policyname='wa_messages ops all') then
    create policy "wa_messages ops all" on wa_messages for all using (is_ops()) with check (is_ops());
  end if;
  if not exists (select 1 from pg_policies where tablename='wa_templates' and policyname='wa_templates ops all') then
    create policy "wa_templates ops all" on wa_templates for all using (is_ops()) with check (is_ops());
  end if;
end $$;

-- Seed default WhatsApp templates
insert into wa_templates (name, language, category, body, params) values
  ('order_paid',       'ar', 'utility',    'أهلاً {{1}}، تم تأكيد طلبك رقم {{2}} بنجاح. سيصلك قريباً.', 2),
  ('order_shipped',    'ar', 'utility',    'طلبك رقم {{1}} في الطريق إليك. المندوب سيتصل بك قريباً.', 1),
  ('order_delivered',  'ar', 'utility',    'تم تسليم طلبك رقم {{1}} بنجاح. شكراً لثقتك بنيوتك!', 1),
  ('install_scheduled','ar', 'utility',    'تم تحديد موعد تركيب طلبك {{1}} يوم {{2}}. فريقنا سيكون معك.', 2),
  ('pickup_ready',     'ar', 'utility',    'طلبك جاهز للاستلام. رمز الاستلام: {{1}}. تفضل لأقرب فرع.', 1),
  ('welcome_vip',      'ar', 'marketing',  'مبروك {{1}}! انضممت لبرنامج نيوتك VIP. استمتع بمزايا حصرية.', 1),
  ('winback_30',       'ar', 'marketing',  'اشتقنالك {{1}}! 😊 تصفح أحدث عروضنا وعد إلينا.', 1)
on conflict (name) do nothing;
-- Elite v1 — 0033: Accounting completion
-- Adds: new accounts, supplier payments, deferred revenue, COGS posting,
--       order completion posting, posting_rules catalog.
-- Additive only. Money: numeric(12,3) KWD.

-- Additional accounts needed for full double-entry
insert into accounts (code, name_ar, name_en, kind) values
  ('2200', 'إيراد مؤجل (مدفوعة غير مكتملة)',  'Deferred revenue',         'liability'),
  ('2110', 'التزام نقاط الولاء',               'Loyalty points liability', 'liability'),
  ('4900', 'خصومات المبيعات (مقابل)',           'Sales discounts (contra)', 'revenue'),
  ('6500', 'عمولة بوابة الدفع',                'Payment gateway fees',     'expense'),
  ('1030', 'ذمم مندوبي التوصيل — COD تفصيلي', 'COD driver clearing',      'asset')
on conflict (code) do nothing;

-- Supplier payments table (maps AP to bank/cash)
create table if not exists supplier_payments (
  id          uuid primary key default gen_random_uuid(),
  po_id       uuid not null references purchase_orders(id) on delete restrict,
  amount      numeric(12,3) not null check (amount > 0),
  method      text not null default 'bank_transfer'
    check (method in ('cash','bank_transfer','cheque')),
  paid_at     date not null default current_date,
  note        text,
  posted_at   timestamptz,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table supplier_payments enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='supplier_payments' and policyname='supplier_payments ops all') then
    create policy "supplier_payments ops all" on supplier_payments for all
      using (is_ops()) with check (is_ops());
  end if;
end $$;

-- Auto-post supplier payment (R10: DR AP / CR Bank)
create or replace function post_supplier_payment_journal() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform post_journal(
      'supplier_payment', new.id::text,
      'دفع مورد — ' || coalesce((select number from purchase_orders where id = new.po_id), ''),
      jsonb_build_array(
        jsonb_build_object('account', '2000', 'debit', new.amount, 'credit', 0),
        jsonb_build_object('account', '1010', 'debit', 0, 'credit', new.amount)
      )
    );
    update supplier_payments set posted_at = now() where id = new.id;
  exception when others then
    raise warning 'journal post skipped for supplier_payment %: %', new.id, sqlerrm;
  end;
  return new;
end; $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_supplier_payment_journal') then
    create trigger trg_supplier_payment_journal
      after insert on supplier_payments
      for each row execute function post_supplier_payment_journal();
  end if;
end $$;
revoke execute on function post_supplier_payment_journal() from public, anon, authenticated;

-- Order completion: R4 revenue recognition (deferred → actual revenue split)
-- Re-posts the payment as deferred revenue on capture, then recognizes on completion.
-- Note: existing trg_payments_journal posts payment→4000 directly.
-- We add COGS posting on order completion (R5): DR COGS / CR Inventory.
create or replace function post_order_completion_journal() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_cogs     numeric(12,3) := 0;
  v_discount numeric(12,3) := 0;
begin
  if new.status = 'completed' and (old.status is distinct from 'completed') then
    -- COGS: sum of qty * avg_cost per line
    select coalesce(sum(oi.qty * coalesce(pv.avg_cost, 0)), 0)
      into v_cogs
      from order_items oi
      join product_variants pv on pv.id = oi.variant_id
     where oi.order_id = new.id;

    v_discount := coalesce(new.discount_total, 0);

    -- R5 COGS entry
    if v_cogs > 0 then
      begin
        perform post_journal(
          'order_cogs', new.id::text,
          'تكلفة مبيعات — ' || coalesce(new.order_number, new.id::text),
          jsonb_build_array(
            jsonb_build_object('account', '5000', 'debit', v_cogs, 'credit', 0),
            jsonb_build_object('account', '1100', 'debit', 0, 'credit', v_cogs)
          )
        );
      exception when others then
        raise warning 'COGS post skipped for order %: %', new.id, sqlerrm;
      end;
    end if;

    -- R4 discount recognition (if any)
    if v_discount > 0 then
      begin
        perform post_journal(
          'order_discount', new.id::text,
          'خصم طلب — ' || coalesce(new.order_number, new.id::text),
          jsonb_build_array(
            jsonb_build_object('account', '4900', 'debit', v_discount, 'credit', 0),
            jsonb_build_object('account', '4000', 'debit', 0, 'credit', v_discount)
          )
        );
      exception when others then
        raise warning 'Discount post skipped for order %: %', new.id, sqlerrm;
      end;
    end if;
  end if;
  return new;
end; $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_order_completion_journal') then
    create trigger trg_order_completion_journal
      after update of status on orders
      for each row execute function post_order_completion_journal();
  end if;
end $$;
revoke execute on function post_order_completion_journal() from public, anon, authenticated;

-- Inventory adjustment posting (R12: cycle count adjustment)
create or replace function post_stock_adjustment_journal() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_cost numeric(12,3); v_val numeric(12,3);
begin
  if new.kind <> 'adjustment' then return new; end if;
  -- get avg_cost for the variant
  select coalesce(avg_cost, 0) into v_cost
    from product_variants where id = new.variant_id;
  v_val := round(abs(new.qty) * v_cost, 3);
  if v_val <= 0 then return new; end if;
  begin
    if new.qty < 0 then
      -- loss: DR shrinkage, CR inventory
      perform post_journal(
        'stock_adjust', new.id::text,
        'تسوية مخزون — ' || coalesce(new.ref, ''),
        jsonb_build_array(
          jsonb_build_object('account', '5200', 'debit', v_val, 'credit', 0),
          jsonb_build_object('account', '1100', 'debit', 0, 'credit', v_val)
        )
      );
    else
      -- gain: DR inventory, CR shrinkage (contra)
      perform post_journal(
        'stock_adjust', new.id::text,
        'تسوية مخزون (زيادة) — ' || coalesce(new.ref, ''),
        jsonb_build_array(
          jsonb_build_object('account', '1100', 'debit', v_val, 'credit', 0),
          jsonb_build_object('account', '5200', 'debit', 0, 'credit', v_val)
        )
      );
    end if;
  exception when others then
    raise warning 'Stock adjust journal skipped for move %: %', new.id, sqlerrm;
  end;
  return new;
end; $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_stock_adjust_journal') then
    create trigger trg_stock_adjust_journal
      after insert on stock_moves
      for each row execute function post_stock_adjustment_journal();
  end if;
end $$;
revoke execute on function post_stock_adjustment_journal() from public, anon, authenticated;

-- posting_rules: human-readable catalog of all rules (informational + configurable)
create table if not exists posting_rules (
  id          text primary key,
  event       text not null,
  description text not null,
  debit_code  text not null,
  credit_code text not null,
  amount_expr text not null,
  is_active   boolean not null default true
);
alter table posting_rules enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='posting_rules' and policyname='posting_rules ops read') then
    create policy "posting_rules ops read" on posting_rules for select using (is_ops());
    create policy "posting_rules admin all" on posting_rules for all using (is_admin()) with check (is_admin());
  end if;
end $$;

insert into posting_rules values
  ('R1',  'payment.paid (knet/card)',   'دفع إلكتروني', '1010', '4000', 'payment.amount'),
  ('R2',  'payment.paid (cod)',         'دفع COD',       '1020', '4000', 'payment.amount'),
  ('R3',  'payment.paid (cash/pos)',    'دفع نقدي',      '1000', '4000', 'payment.amount'),
  ('R4',  'order.completed discount',  'خصم طلب',       '4900', '4000', 'order.discount_total'),
  ('R5',  'order.completed cogs',      'تكلفة مبيعات',  '5000', '1100', 'Σqty×avg_cost'),
  ('R6',  'payment.refunded',          'استرداد',        '4000', '1010', 'abs(payment.amount)'),
  ('R7',  'expense.inserted',          'مصروف تشغيلي',   '5100', '1000', 'expense.amount'),
  ('R8',  'po_receipt.qty_received++', 'استلام مشتريات', '1100', '2000', 'qty×unit_cost'),
  ('R9',  'supplier_payment.inserted', 'دفع مورد',       '2000', '1010', 'supplier_payment.amount'),
  ('R10', 'stock_moves.adjustment',    'تسوية مخزون',    '5200', '1100', 'abs(qty)×avg_cost'),
  ('R11', 'knet_settlement.matched',   'تسوية كي-نت',    '1010', '1010', 'net+fee=gross'),
  ('R12', 'cod_remittance.received',   'تسليم COD',      '1000', '1020', 'remittance.amount')
on conflict (id) do nothing;
-- Elite v1 — 0034: KNET reconciliation + COD remittances
-- Additive, idempotent.

create table if not exists knet_settlements (
  id          uuid primary key default gen_random_uuid(),
  settle_date date not null,
  gross       numeric(12,3) not null check (gross >= 0),
  fees        numeric(12,3) not null default 0 check (fees >= 0),
  net         numeric(12,3) not null,
  bank_ref    text,
  file_name   text,
  status      text not null default 'open'
    check (status in ('open','matched','posted')),
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists knet_settlement_lines (
  id            bigint generated always as identity primary key,
  settlement_id uuid not null references knet_settlements(id) on delete cascade,
  gateway_ref   text not null,
  amount        numeric(12,3) not null,
  payment_id    uuid references payments(id) on delete set null,
  status        text not null default 'unmatched'
    check (status in ('matched','unmatched','amount_mismatch','duplicate'))
);
create index if not exists idx_knet_lines_gref on knet_settlement_lines(gateway_ref);

create table if not exists cod_remittances (
  id          uuid primary key default gen_random_uuid(),
  driver_id   uuid not null references profiles(id) on delete restrict,
  amount      numeric(12,3) not null check (amount > 0),
  order_ids   uuid[] not null default '{}',
  received_by uuid references profiles(id) on delete set null,
  method      text not null default 'cash'
    check (method in ('cash','bank_transfer')),
  status      text not null default 'received'
    check (status in ('received','posted')),
  note        text,
  created_at  timestamptz not null default now()
);

alter table knet_settlements     enable row level security;
alter table knet_settlement_lines enable row level security;
alter table cod_remittances      enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='knet_settlements' and policyname='knet_settlements ops all') then
    create policy "knet_settlements ops all" on knet_settlements for all using (is_ops()) with check (is_ops());
  end if;
  if not exists (select 1 from pg_policies where tablename='knet_settlement_lines' and policyname='knet_lines ops all') then
    create policy "knet_lines ops all" on knet_settlement_lines for all using (is_ops()) with check (is_ops());
  end if;
  if not exists (select 1 from pg_policies where tablename='cod_remittances' and policyname='cod_remittances ops all') then
    create policy "cod_remittances ops all" on cod_remittances for all using (is_ops()) with check (is_ops());
  end if;
end $$;

-- match_knet_settlement: match lines to payments by gateway_ref
create or replace function match_knet_settlement(p_settlement uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_matched   int := 0;
  v_mismatch  int := 0;
  v_unknown   int := 0;
  r record;
begin
  if not is_ops() then raise exception 'forbidden'; end if;
  for r in
    select l.id, l.gateway_ref, l.amount
      from knet_settlement_lines l
     where l.settlement_id = p_settlement
       and l.status = 'unmatched'
  loop
    declare v_pay payments%rowtype;
    begin
      select * into v_pay
        from payments
       where gateway_ref = r.gateway_ref
         and method in ('knet','card','apple_pay','google_pay')
         and status = 'paid'
       limit 1;

      if not found then
        update knet_settlement_lines set status = 'unmatched' where id = r.id;
        v_unknown := v_unknown + 1;
      elsif abs(v_pay.amount - r.amount) > 0.001 then
        update knet_settlement_lines
           set payment_id = v_pay.id, status = 'amount_mismatch'
         where id = r.id;
        v_mismatch := v_mismatch + 1;
      else
        update knet_settlement_lines
           set payment_id = v_pay.id, status = 'matched'
         where id = r.id;
        v_matched := v_matched + 1;
      end if;
    end;
  end loop;

  -- Update settlement status
  if v_mismatch = 0 and v_unknown = 0 then
    update knet_settlements set status = 'matched' where id = p_settlement;
  end if;

  return jsonb_build_object(
    'matched', v_matched,
    'amount_mismatch', v_mismatch,
    'unmatched', v_unknown
  );
end; $$;
revoke execute on function match_knet_settlement(uuid) from public, anon, authenticated;
grant  execute on function match_knet_settlement(uuid) to authenticated;

-- post_knet_settlement: R11 journal entry after matching
create or replace function post_knet_settlement(p_settlement uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_s knet_settlements;
  v_je uuid;
begin
  if not is_ops() then raise exception 'forbidden'; end if;
  select * into v_s from knet_settlements where id = p_settlement;
  if not found then raise exception 'settlement not found'; end if;
  if v_s.status <> 'matched' then raise exception 'settlement not fully matched'; end if;

  v_je := post_journal(
    'knet_settlement', p_settlement::text,
    'تسوية كي-نت ' || v_s.settle_date::text,
    jsonb_build_array(
      jsonb_build_object('account', '1010', 'debit', v_s.net,  'credit', 0, 'note', 'صافي التسوية'),
      jsonb_build_object('account', '6500', 'debit', v_s.fees, 'credit', 0, 'note', 'عمولة البوابة'),
      jsonb_build_object('account', '1010', 'debit', 0, 'credit', v_s.gross, 'note', 'إجمالي كي-نت clearing')
    )
  );
  update knet_settlements set status = 'posted' where id = p_settlement;
  return v_je;
end; $$;
revoke execute on function post_knet_settlement(uuid) from public, anon, authenticated;
grant  execute on function post_knet_settlement(uuid) to authenticated;

-- post_cod_remittance: R12 journal entry
create or replace function post_cod_remittance(p_remittance uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_r cod_remittances; v_je uuid;
begin
  if not is_ops() then raise exception 'forbidden'; end if;
  select * into v_r from cod_remittances where id = p_remittance;
  if not found then raise exception 'remittance not found'; end if;
  if v_r.status = 'posted' then raise exception 'already posted'; end if;

  v_je := post_journal(
    'cod_remittance', p_remittance::text,
    'تسليم COD مندوب: ' || (select full_name from profiles where id = v_r.driver_id),
    jsonb_build_array(
      jsonb_build_object('account', '1000', 'debit', v_r.amount, 'credit', 0),
      jsonb_build_object('account', '1020', 'debit', 0, 'credit', v_r.amount)
    )
  );
  update cod_remittances set status = 'posted' where id = p_remittance;
  return v_je;
end; $$;
revoke execute on function post_cod_remittance(uuid) from public, anon, authenticated;
grant  execute on function post_cod_remittance(uuid) to authenticated;

-- Ledger-vs-operational cross-check: returns 0.000 when books are clean
create or replace view v_ledger_delta as
  select
    (select coalesce(sum(amount), 0) from payments where status = 'paid') as op_revenue,
    (select coalesce(sum(jl.credit - jl.debit), 0)
       from journal_lines jl
       join accounts a on a.code = jl.account_code
      where a.kind = 'revenue' and a.code = '4000') as ledger_revenue,
    round((select coalesce(sum(amount), 0) from payments where status = 'paid') -
          (select coalesce(sum(jl.credit - jl.debit), 0)
             from journal_lines jl
             join accounts a on a.code = jl.account_code
            where a.kind = 'revenue' and a.code = '4000'), 3) as delta;
-- Elite v1 — 0035: AI agent actions log + HITL approvals + cart claim tokens
-- Additive, idempotent.

create table if not exists agent_actions (
  id          uuid primary key default gen_random_uuid(),
  agent       text not null check (agent in ('sales','ops','insight','triage')),
  session_id  uuid not null,
  tool        text not null,
  input       jsonb not null default '{}',
  output      jsonb,
  status      text not null default 'executed'
    check (status in ('executed','proposed','approved','rejected','failed')),
  risk        text not null default 'read'
    check (risk in ('read','write','sensitive')),
  proposed_to uuid references profiles(id) on delete set null,
  decided_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);
create index if not exists idx_agent_actions_pending on agent_actions(status) where status = 'proposed';
create index if not exists idx_agent_actions_session on agent_actions(session_id, created_at);

-- Cart claim tokens (for sales agent cart links)
do $$ begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'carts') then
    alter table carts
      add column if not exists claim_token text unique,
      add column if not exists claimed_by  uuid references profiles(id) on delete set null,
      add column if not exists claimed_at  timestamptz;
  end if;
end $$;

-- Public function to claim a cart by token (called from storefront)
create or replace function claim_cart_by_token(p_token text, p_user_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_cart_id uuid;
begin
  select id into v_cart_id from carts
   where claim_token = p_token
     and claimed_by is null
   for update;
  if not found then raise exception 'cart token invalid or already claimed'; end if;
  update carts set claimed_by = p_user_id, claimed_at = now()
   where id = v_cart_id;
  return v_cart_id;
end; $$;
revoke execute on function claim_cart_by_token(text, uuid) from public, anon;
grant  execute on function claim_cart_by_token(text, uuid) to authenticated;

alter table agent_actions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='agent_actions' and policyname='agent_actions ops all') then
    create policy "agent_actions ops all" on agent_actions for all using (is_ops()) with check (is_ops());
  end if;
end $$;
-- Elite v1 — 0036: AI agent eval framework
-- Additive, idempotent.

create table if not exists agent_eval_cases (
  id         uuid primary key default gen_random_uuid(),
  agent      text not null check (agent in ('sales','ops','insight','triage')),
  name       text not null,
  input      jsonb not null,
  expected   jsonb not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists agent_eval_runs (
  id        bigint generated always as identity primary key,
  case_id   uuid not null references agent_eval_cases(id) on delete cascade,
  model     text not null,
  passed    boolean not null,
  detail    jsonb,
  created_at timestamptz not null default now()
);

alter table agent_eval_cases enable row level security;
alter table agent_eval_runs  enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='agent_eval_cases' and policyname='eval_cases ops all') then
    create policy "eval_cases ops all" on agent_eval_cases for all using (is_ops()) with check (is_ops());
  end if;
  if not exists (select 1 from pg_policies where tablename='agent_eval_runs' and policyname='eval_runs ops all') then
    create policy "eval_runs ops all" on agent_eval_runs for all using (is_ops()) with check (is_ops());
  end if;
end $$;

-- Seed golden eval cases
insert into agent_eval_cases (agent, name, input, expected) values
  ('sales', 'catalog_search_ac_under_150',
   '{"message":"أبي مكيف 1.5 طن تحت 150 دينار"}',
   '{"must_call_tools":["search_catalog"],"must_not":["create_discount_code"],"assert_text_contains":["دينار"]}'
  ),
  ('sales', 'discount_request_handoff',
   '{"message":"أبي خصم على الطلب"}',
   '{"must_call_tools":["handoff_to_human"],"must_not_contain":["خصم"]}'
  ),
  ('triage', 'warranty_ticket',
   '{"ticket":{"body":"الجهاز توقف، السيريال 123456","customer_phone":"96512345678"}}',
   '{"expected_classification":"warranty","must_call_tools":["lookup_warranty"]}'
  ),
  ('triage', 'return_request',
   '{"ticket":{"body":"أبي أرجع المنتج","customer_phone":"96598765432"}}',
   '{"expected_classification":"return","must_call_tools":["lookup_order"]}'
  )
on conflict do nothing;

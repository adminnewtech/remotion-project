-- Elite v1 — 0003 orders: orders, items, payments, discounts

create sequence if not exists order_number_seq start 10001;

create table orders (
  id               uuid primary key default gen_random_uuid(),
  order_number     text not null unique default ('NT-' || nextval('order_number_seq')::text),
  user_id          uuid not null references profiles(id) on delete restrict,
  status           order_status not null default 'draft',
  subtotal         numeric(10,3) not null default 0,
  delivery_fee     numeric(10,3) not null default 0,
  installation_fee numeric(10,3) not null default 0,
  discount_total   numeric(10,3) not null default 0,
  total            numeric(10,3) not null default 0,
  currency         text not null default 'KWD',
  address_id       uuid references addresses(id) on delete set null,
  delivery_slot    tstzrange,
  notes            text,
  placed_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger trg_orders_updated before update on orders
  for each row execute function set_updated_at();
create index idx_orders_user on orders(user_id);
create index idx_orders_status on orders(status);

create table order_items (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references orders(id) on delete cascade,
  variant_id         uuid references product_variants(id) on delete set null,
  name_snapshot      text not null,
  sku_snapshot       text,
  unit_price         numeric(10,3) not null,
  qty                int not null check (qty > 0),
  line_total         numeric(10,3) not null,
  with_installation  boolean not null default false,
  warranty_expires_at timestamptz
);
create index idx_order_items_order on order_items(order_id);

create table payments (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  method      payment_method not null,
  status      payment_status not null default 'pending',
  amount      numeric(10,3) not null,
  gateway_ref text,
  raw         jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_payments_updated before update on payments
  for each row execute function set_updated_at();
create index idx_payments_order on payments(order_id);

create table discounts (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  kind         discount_kind not null,
  value        numeric(10,3) not null default 0,
  min_subtotal numeric(10,3) not null default 0,
  starts_at    timestamptz,
  ends_at      timestamptz,
  usage_limit  int,
  used_count   int not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

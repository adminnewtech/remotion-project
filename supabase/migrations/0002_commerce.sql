-- Elite v1 — 0002 commerce: catalog, variants, media, inventory, cart

create table categories (
  id         uuid primary key default gen_random_uuid(),
  parent_id  uuid references categories(id) on delete set null,
  name_ar    text not null,
  name_en    text not null,
  slug       text not null unique,
  image_url  text,
  sort       int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_categories_parent on categories(parent_id);

create table products (
  id                    uuid primary key default gen_random_uuid(),
  category_id           uuid references categories(id) on delete set null,
  name_ar               text not null,
  name_en               text not null,
  description_ar        text,
  description_en        text,
  brand                 text,
  slug                  text not null unique,
  requires_installation boolean not null default false,
  installation_fee      numeric(10,3) not null default 0,
  warranty_months       int not null default 12,
  is_active             boolean not null default true,
  search_tsv            tsvector,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create trigger trg_products_updated before update on products
  for each row execute function set_updated_at();

-- Full-text search index (Arabic + English names/brand/description)
create or replace function products_tsv_update()
returns trigger language plpgsql as $$
begin
  new.search_tsv :=
    setweight(to_tsvector('simple', coalesce(new.name_ar,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.name_en,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.brand,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.description_ar,'')), 'C') ||
    setweight(to_tsvector('simple', coalesce(new.description_en,'')), 'C');
  return new;
end; $$;
create trigger trg_products_tsv before insert or update on products
  for each row execute function products_tsv_update();
create index idx_products_tsv on products using gin(search_tsv);
create index idx_products_name_trgm on products using gin (name_en gin_trgm_ops, name_ar gin_trgm_ops);
create index idx_products_category on products(category_id);

create table product_variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete cascade,
  sku         text unique,
  attributes  jsonb not null default '{}'::jsonb,  -- {color, model, ...}
  price       numeric(10,3) not null,
  sale_price  numeric(10,3),
  barcode     text,
  weight_g    int,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index idx_variants_product on product_variants(product_id);

create table product_media (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete cascade,
  variant_id  uuid references product_variants(id) on delete cascade,
  url         text not null,
  kind        media_kind not null default 'image',
  sort        int not null default 0
);
create index idx_media_product on product_media(product_id);

create table inventory (
  id          uuid primary key default gen_random_uuid(),
  variant_id  uuid not null references product_variants(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  on_hand     int not null default 0 check (on_hand >= 0),
  reserved    int not null default 0 check (reserved >= 0),
  updated_at  timestamptz not null default now(),
  unique (variant_id, location_id)
);
create trigger trg_inventory_updated before update on inventory
  for each row execute function set_updated_at();

-- ── Cart ─────────────────────────────────────────────────
create table carts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  status     text not null default 'active' check (status in ('active','converted','abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_carts_updated before update on carts
  for each row execute function set_updated_at();
create index idx_carts_user on carts(user_id);

create table cart_items (
  id               uuid primary key default gen_random_uuid(),
  cart_id          uuid not null references carts(id) on delete cascade,
  variant_id       uuid not null references product_variants(id) on delete cascade,
  qty              int not null default 1 check (qty > 0),
  with_installation boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (cart_id, variant_id, with_installation)
);
create index idx_cart_items_cart on cart_items(cart_id);

-- Elite v1 — 0009 search: ranked product search RPC + supporting indexes.
--
-- SAFE to apply to the live DB: only `create ... if not exists` /
-- `create or replace`. Adds a SECURITY DEFINER function `search_products`
-- that combines the existing `products.search_tsv` full-text column with
-- `pg_trgm` similarity on name/brand, returning ranked products together with
-- their primary image and a price (min active variant price). Read-only, so it
-- is safe to expose to anon/authenticated; RLS still applies because the
-- function re-checks `is_active` and the underlying tables are RLS-guarded for
-- direct access — but since this is SECURITY DEFINER we filter to active rows
-- explicitly so it never leaks unpublished catalog.

-- ── Supporting indexes (idempotent) ─────────────────────────────────────────
-- Trigram index on brand to speed fuzzy brand matching (name already indexed
-- in 0002 via idx_products_name_trgm).
create index if not exists idx_products_brand_trgm
  on products using gin (brand gin_trgm_ops);

-- Help the primary-image / price lookups inside the function.
create index if not exists idx_media_product_sort
  on product_media(product_id, sort);
create index if not exists idx_variants_product_active
  on product_variants(product_id, is_active);

-- ── Result type ─────────────────────────────────────────────────────────────
-- Returned as a SETOF composite so callers get typed columns.
create or replace function search_products(
  p_q           text,
  p_category_id uuid    default null,
  p_brand       text    default null,
  p_min_price   numeric default null,
  p_max_price   numeric default null,
  p_limit       int     default 30,
  p_offset      int     default 0
)
returns table (
  id                    uuid,
  category_id           uuid,
  name_ar               text,
  name_en               text,
  brand                 text,
  slug                  text,
  requires_installation boolean,
  installation_fee      numeric,
  warranty_months       int,
  price                 numeric,
  sale_price            numeric,
  primary_image         text,
  rank                  real
)
language sql
stable
security definer
set search_path = public
as $$
  with q as (
    select nullif(btrim(coalesce(p_q, '')), '') as term
  ),
  -- Lowest-price active variant per product (price honors sale_price).
  variant_price as (
    select
      pv.product_id,
      min(coalesce(pv.sale_price, pv.price)) as eff_price,
      min(pv.price)                          as list_price,
      min(pv.sale_price)                     as sale_price
    from product_variants pv
    where pv.is_active = true
    group by pv.product_id
  ),
  -- Primary image = the image-kind media row with the lowest sort.
  primary_media as (
    select distinct on (pm.product_id) pm.product_id, pm.url
    from product_media pm
    where pm.kind = 'image'
    order by pm.product_id, pm.sort asc, pm.id
  )
  select
    p.id,
    p.category_id,
    p.name_ar,
    p.name_en,
    p.brand,
    p.slug,
    p.requires_installation,
    p.installation_fee,
    p.warranty_months,
    vp.eff_price                                   as price,
    vp.sale_price                                  as sale_price,
    pmedia.url                                     as primary_image,
    -- Rank: full-text ts_rank when there's a query, blended with trigram
    -- similarity on name/brand so fuzzy / typo matches still surface.
    case
      when (select term from q) is null then 0::real
      else
        coalesce(
          ts_rank(p.search_tsv, websearch_to_tsquery('simple', (select term from q))),
          0
        )
        + greatest(
            similarity(coalesce(p.name_en, ''), (select term from q)),
            similarity(coalesce(p.name_ar, ''), (select term from q)),
            similarity(coalesce(p.brand, ''),   (select term from q))
          )
    end as rank
  from products p
  left join variant_price vp on vp.product_id = p.id
  left join primary_media pmedia on pmedia.product_id = p.id
  where p.is_active = true
    and (p_category_id is null or p.category_id = p_category_id)
    and (p_brand is null or p.brand = p_brand)
    and (p_min_price is null or vp.eff_price >= p_min_price)
    and (p_max_price is null or vp.eff_price <= p_max_price)
    and (
      (select term from q) is null
      or p.search_tsv @@ websearch_to_tsquery('simple', (select term from q))
      or coalesce(p.name_en, '') % (select term from q)
      or coalesce(p.name_ar, '') % (select term from q)
      or coalesce(p.brand, '')   % (select term from q)
    )
  order by rank desc, p.name_en asc
  limit greatest(1, least(coalesce(p_limit, 30), 100))
  offset greatest(0, coalesce(p_offset, 0));
$$;

-- Read-only search is safe for clients (it self-filters to active rows).
grant execute on function search_products(text, uuid, text, numeric, numeric, int, int)
  to anon, authenticated, service_role;

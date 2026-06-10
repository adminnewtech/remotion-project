-- Elite v1 — 0010 analytics: admin-dashboard views + SECURITY DEFINER readers.
--
-- SAFE to apply to the live DB: `create or replace view`,
-- `create materialized view if not exists`, `create index if not exists`,
-- `create or replace function`.
--
-- Design:
--   * Plain views compute the aggregates. Views run with the *invoker's*
--     permissions, so RLS on the base tables would otherwise hide rows from a
--     non-admin caller. We therefore DO NOT grant the views to anon/authenticated
--     and instead expose the dashboard through SECURITY DEFINER functions that
--     gate on `is_ops()` and run with `search_path = public`. Those functions
--     are the supported read path for `packages/core/src/analytics.ts`.
--   * One materialized view (`mv_product_sales`) caches the heavier top-products
--     roll-up; refresh it from a cron / admin action via `refresh_analytics()`.

-- ── Revenue by day (paid+ orders) ───────────────────────────────────────────
create or replace view analytics_revenue_by_day as
select
  date_trunc('day', coalesce(o.placed_at, o.created_at))::date as day,
  count(*)                              as orders,
  sum(o.total)                          as revenue,
  sum(o.subtotal)                       as subtotal,
  sum(o.delivery_fee)                   as delivery_fees,
  sum(o.installation_fee)               as installation_fees,
  sum(o.discount_total)                 as discounts
from orders o
where o.status in ('paid','processing','out_for_delivery','delivered','installing','completed')
group by 1;

-- ── Orders by status ────────────────────────────────────────────────────────
create or replace view analytics_orders_by_status as
select
  o.status,
  count(*)              as orders,
  sum(o.total)          as total_value
from orders o
group by o.status;

-- ── Sales by Kuwait area (from the order's delivery address) ────────────────
create or replace view analytics_sales_by_area as
select
  coalesce(a.area, 'unknown')           as area,
  count(distinct o.id)                  as orders,
  sum(o.total)                          as revenue
from orders o
left join addresses a on a.id = o.address_id
where o.status in ('paid','processing','out_for_delivery','delivered','installing','completed')
group by 1;

-- ── Top products (units + revenue from order_items of paid+ orders) ─────────
-- Materialized because it joins order_items → orders and is the heaviest read.
create materialized view if not exists mv_product_sales as
select
  p.id                                  as product_id,
  p.name_en,
  p.name_ar,
  p.brand,
  sum(oi.qty)                           as units_sold,
  sum(oi.line_total)                    as revenue,
  count(distinct oi.order_id)           as orders
from order_items oi
join orders o on o.id = oi.order_id
  and o.status in ('paid','processing','out_for_delivery','delivered','installing','completed')
left join product_variants pv on pv.id = oi.variant_id
left join products p on p.id = pv.product_id
where p.id is not null
group by p.id, p.name_en, p.name_ar, p.brand
with no data;

create unique index if not exists idx_mv_product_sales_pk on mv_product_sales(product_id);

-- ── Low stock (available = on_hand - reserved, rolled up per variant) ───────
create or replace view analytics_low_stock as
select
  pv.id                                 as variant_id,
  pv.sku,
  p.id                                  as product_id,
  p.name_en,
  p.name_ar,
  coalesce(sum(i.on_hand), 0)           as on_hand,
  coalesce(sum(i.reserved), 0)          as reserved,
  coalesce(sum(i.on_hand - i.reserved), 0) as available
from product_variants pv
join products p on p.id = pv.product_id
left join inventory i on i.variant_id = pv.id
where pv.is_active = true
group by pv.id, pv.sku, p.id, p.name_en, p.name_ar;

-- ── Driver / technician utilization (open vs completed tasks) ───────────────
create or replace view analytics_staff_utilization as
select
  pr.id                                 as staff_id,
  pr.full_name,
  pr.role,
  count(*) filter (where t.status not in ('completed','failed','cancelled')) as open_tasks,
  count(*) filter (where t.status = 'completed')                            as completed_tasks,
  count(*) filter (where t.status = 'failed')                               as failed_tasks,
  count(*)                                                                   as total_tasks
from profiles pr
left join fulfillment_tasks t on t.assignee_id = pr.id
where pr.role in ('driver','technician')
group by pr.id, pr.full_name, pr.role;

-- ── SLA: fulfillment cycle time + on-time delivery ──────────────────────────
-- "Cycle time" = task creation → completion. On-time = completed at/before
-- window_end (when a window was set).
create or replace view analytics_sla as
select
  t.type,
  count(*) filter (where t.status = 'completed')                            as completed,
  avg(extract(epoch from (t.updated_at - t.created_at)) / 3600.0)
    filter (where t.status = 'completed')                                   as avg_cycle_hours,
  count(*) filter (
    where t.status = 'completed' and t.window_end is not null and t.updated_at <= t.window_end
  )                                                                         as on_time,
  count(*) filter (
    where t.status = 'completed' and t.window_end is not null
  )                                                                         as windowed_completed
from fulfillment_tasks t
group by t.type;

-- ── Refresh helper for the materialized roll-up ─────────────────────────────
create or replace function refresh_analytics()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- CONCURRENTLY needs a unique index (created above) and an existing populated
  -- view; fall back to a plain refresh on first run.
  begin
    refresh materialized view concurrently mv_product_sales;
  exception when others then
    refresh materialized view mv_product_sales;
  end;
end;
$$;

-- ── SECURITY DEFINER dashboard readers (ops/admin only) ─────────────────────
-- Each gates on is_ops() so the function can safely read past RLS.

create or replace function admin_revenue_by_day(p_from date default null, p_to date default null)
returns setof analytics_revenue_by_day
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_ops() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select * from analytics_revenue_by_day v
    where (p_from is null or v.day >= p_from)
      and (p_to is null or v.day <= p_to)
    order by v.day;
end; $$;

create or replace function admin_orders_by_status()
returns setof analytics_orders_by_status
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_ops() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query select * from analytics_orders_by_status;
end; $$;

create or replace function admin_sales_by_area()
returns setof analytics_sales_by_area
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_ops() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query select * from analytics_sales_by_area order by revenue desc nulls last;
end; $$;

create or replace function admin_top_products(p_limit int default 20)
returns setof mv_product_sales
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_ops() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select * from mv_product_sales
    order by units_sold desc nulls last
    limit greatest(1, least(coalesce(p_limit, 20), 200));
end; $$;

create or replace function admin_low_stock(p_threshold int default 5)
returns setof analytics_low_stock
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_ops() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select * from analytics_low_stock v
    where v.available <= coalesce(p_threshold, 5)
    order by v.available asc;
end; $$;

create or replace function admin_staff_utilization()
returns setof analytics_staff_utilization
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_ops() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query select * from analytics_staff_utilization order by open_tasks desc;
end; $$;

create or replace function admin_sla()
returns setof analytics_sla
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_ops() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query select * from analytics_sla;
end; $$;

-- ── Grants: lock readers to authenticated callers (function self-gates on
-- is_ops); revoke the raw refresh from clients (admin tooling / cron only). ──
revoke execute on function refresh_analytics() from anon, authenticated;
grant execute on function refresh_analytics() to service_role;

grant execute on function admin_revenue_by_day(date, date) to authenticated, service_role;
grant execute on function admin_orders_by_status()        to authenticated, service_role;
grant execute on function admin_sales_by_area()           to authenticated, service_role;
grant execute on function admin_top_products(int)         to authenticated, service_role;
grant execute on function admin_low_stock(int)            to authenticated, service_role;
grant execute on function admin_staff_utilization()       to authenticated, service_role;
grant execute on function admin_sla()                     to authenticated, service_role;

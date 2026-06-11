-- Elite v1 — 0012 security hardening #2 (applied live).
-- Resolves Supabase advisor findings after the 0009-0011 analytics/search/triggers.

-- Analytics views must respect the caller's RLS (fixes SECURITY DEFINER VIEW errors).
alter view analytics_revenue_by_day    set (security_invoker = on);
alter view analytics_orders_by_status  set (security_invoker = on);
alter view analytics_sales_by_area     set (security_invoker = on);
alter view analytics_low_stock         set (security_invoker = on);
alter view analytics_staff_utilization set (security_invoker = on);
alter view analytics_sla               set (security_invoker = on);

-- Analytics reached only via the is_ops()-gated admin_* functions.
revoke select on analytics_revenue_by_day    from anon, authenticated;
revoke select on analytics_orders_by_status  from anon, authenticated;
revoke select on analytics_sales_by_area     from anon, authenticated;
revoke select on analytics_low_stock         from anon, authenticated;
revoke select on analytics_staff_utilization from anon, authenticated;
revoke select on analytics_sla               from anon, authenticated;
revoke select on mv_product_sales            from anon, authenticated;

revoke execute on function admin_revenue_by_day(date, date) from anon;
revoke execute on function admin_orders_by_status()        from anon;
revoke execute on function admin_sales_by_area()           from anon;
revoke execute on function admin_top_products(int)         from anon;
revoke execute on function admin_low_stock(int)            from anon;
revoke execute on function admin_staff_utilization()       from anon;
revoke execute on function admin_sla()                     from anon;

-- Trigger fns + internal notification helper: never callable via RPC.
revoke execute on function trg_order_status_notify() from anon, authenticated, public;
revoke execute on function trg_task_status_notify() from anon, authenticated, public;
revoke execute on function enqueue_notification(uuid, text, text, text, text, text, jsonb) from anon, authenticated, public;

-- Close PUBLIC default grant on state-changing RPCs.
revoke execute on function reserve_variant_stock(uuid, int) from public;
revoke execute on function release_variant_stock(uuid, int) from public;
revoke execute on function increment_discount_usage(uuid)   from public;

-- NewTech OS — 0015 security hardening #3 (applied live).
-- Close default PUBLIC execute on ops-only and internal SECURITY DEFINER fns.
-- NOTE: is_ops/is_admin/is_staff/current_role_is stay broadly executable —
-- they are evaluated inside RLS policies as the querying user.

revoke execute on function admin_revenue_by_day(date, date) from public, anon;
revoke execute on function admin_orders_by_status()        from public, anon;
revoke execute on function admin_sales_by_area()           from public, anon;
revoke execute on function admin_top_products(int)         from public, anon;
revoke execute on function admin_low_stock(int)            from public, anon;
revoke execute on function admin_staff_utilization()       from public, anon;
revoke execute on function admin_sla()                     from public, anon;
grant  execute on function admin_revenue_by_day(date, date) to authenticated, service_role;
grant  execute on function admin_orders_by_status()        to authenticated, service_role;
grant  execute on function admin_sales_by_area()           to authenticated, service_role;
grant  execute on function admin_top_products(int)         to authenticated, service_role;
grant  execute on function admin_low_stock(int)            to authenticated, service_role;
grant  execute on function admin_staff_utilization()       to authenticated, service_role;
grant  execute on function admin_sla()                     to authenticated, service_role;

revoke execute on function refresh_analytics() from public;
revoke execute on function handle_new_user() from public;
revoke execute on function guard_profile_privileged_cols() from public, anon, authenticated;

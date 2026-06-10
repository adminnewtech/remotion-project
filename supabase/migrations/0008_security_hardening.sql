-- Elite v1 — 0008 security hardening (applied to live project).
-- Addresses Supabase security advisor warnings.

-- Pin search_path on trigger functions (advisor: function_search_path_mutable)
alter function public.set_updated_at() set search_path = public;
alter function public.products_tsv_update() set search_path = public;

-- Lock state-changing / internal SECURITY DEFINER functions to the service role.
-- These must NEVER be callable directly by clients via PostgREST RPC.
revoke execute on function public.reserve_variant_stock(uuid, int) from anon, authenticated;
revoke execute on function public.release_variant_stock(uuid, int) from anon, authenticated;
revoke execute on function public.increment_discount_usage(uuid) from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;

grant execute on function public.reserve_variant_stock(uuid, int) to service_role;
grant execute on function public.release_variant_stock(uuid, int) to service_role;
grant execute on function public.increment_discount_usage(uuid) to service_role;

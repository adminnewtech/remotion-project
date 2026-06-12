-- Elite v1 — 0040: public read for pickup locations
-- The storefront store-pickup picker (checkout) needs anon/customers to read the
-- showrooms that accept pickup. Existing `locations read` policy is is_staff()
-- only. This adds a narrow, additive SELECT policy exposing ONLY active pickup
-- locations to the public. Idempotent.

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'locations' and policyname = 'locations pickup public read'
  ) then
    create policy "locations pickup public read" on locations
      for select to anon, authenticated
      using (allows_pickup = true and is_active = true);
  end if;
end $$;

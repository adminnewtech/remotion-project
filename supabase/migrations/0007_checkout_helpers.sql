-- Elite v1 — 0007 checkout helpers: atomic stock reservation + discount usage.
-- SECURITY DEFINER RPCs called by the checkout / payment-webhook Edge Functions.

-- ───────────────────────────────────────────────────────────────────────────
-- reserve_variant_stock(variant_id, qty)
--
-- Atomically reserves `qty` units of a variant by incrementing `reserved`
-- on inventory rows, but ONLY if (on_hand - reserved) >= qty across the
-- variant's locations. Reserves greedily from the location with the most
-- availability first. Returns true on success, false if insufficient stock.
--
-- Runs as SECURITY DEFINER so the Edge Function (service role) can call it;
-- the row-locking (FOR UPDATE) prevents oversell under concurrent checkouts.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function reserve_variant_stock(p_variant_id uuid, p_qty int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_available int;
  v_remaining int := p_qty;
  r record;
begin
  if p_qty <= 0 then
    return true;
  end if;

  -- Lock the variant's inventory rows so concurrent checkouts serialize.
  select coalesce(sum(on_hand - reserved), 0)
    into v_available
  from inventory
  where variant_id = p_variant_id
  for update;

  if v_available < p_qty then
    return false;
  end if;

  -- Greedily reserve from the most-available locations first.
  for r in
    select id, (on_hand - reserved) as avail
    from inventory
    where variant_id = p_variant_id and (on_hand - reserved) > 0
    order by (on_hand - reserved) desc
  loop
    exit when v_remaining <= 0;
    if r.avail >= v_remaining then
      update inventory set reserved = reserved + v_remaining where id = r.id;
      v_remaining := 0;
    else
      update inventory set reserved = reserved + r.avail where id = r.id;
      v_remaining := v_remaining - r.avail;
    end if;
  end loop;

  return v_remaining = 0;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- release_variant_stock(variant_id, qty)
--
-- Inverse of reserve_variant_stock — decrements `reserved` (e.g. on payment
-- failure or order cancellation). Never drops reserved below zero.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function release_variant_stock(p_variant_id uuid, p_qty int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining int := p_qty;
  r record;
begin
  if p_qty <= 0 then
    return;
  end if;
  for r in
    select id, reserved
    from inventory
    where variant_id = p_variant_id and reserved > 0
    order by reserved desc
    for update
  loop
    exit when v_remaining <= 0;
    if r.reserved >= v_remaining then
      update inventory set reserved = reserved - v_remaining where id = r.id;
      v_remaining := 0;
    else
      update inventory set reserved = reserved - r.reserved where id = r.id;
      v_remaining := v_remaining - r.reserved;
    end if;
  end loop;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- increment_discount_usage(discount_id)
--
-- Atomically bumps a discount's used_count. The checkout function falls back
-- to a read-modify-write update if this RPC is absent, but the atomic form
-- avoids races when a code nears its usage_limit.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function increment_discount_usage(p_discount_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update discounts set used_count = used_count + 1 where id = p_discount_id;
$$;

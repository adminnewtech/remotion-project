-- Elite v1 — 0020 security hardening #4 (inventory functions)
--
-- Advisor findings on the 0019 functions:
--  • anon/authenticated could EXECUTE apply_stock_move/transfer_stock — as
--    SECURITY DEFINER they bypass RLS, so ANY signed-in customer could mutate
--    stock. Fix: revoke PUBLIC/anon, keep authenticated, and enforce is_ops()
--    INSIDE the definer (defense in depth).
--  • Mutable search_path on the new functions. Fix: pin to public.
--  • log_order_event is trigger-only — revoke direct EXECUTE entirely.

-- Pin search_path + enforce ops inside the definers.
create or replace function apply_stock_move(
  p_variant uuid, p_location uuid, p_qty int, p_kind text,
  p_ref text default null, p_batch text default null, p_note text default null
) returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_move_id bigint;
  v_new_on_hand int;
begin
  if not is_ops() then
    raise exception 'forbidden — ops only';
  end if;

  insert into inventory (variant_id, location_id, on_hand)
  values (p_variant, p_location, 0)
  on conflict (variant_id, location_id) do nothing;

  update inventory
    set on_hand = on_hand + p_qty
    where variant_id = p_variant and location_id = p_location
    returning on_hand into v_new_on_hand;

  if v_new_on_hand < 0 and p_kind <> 'adjustment' then
    raise exception 'insufficient stock (would be %)', v_new_on_hand;
  end if;
  if v_new_on_hand < 0 then
    update inventory set on_hand = 0
      where variant_id = p_variant and location_id = p_location;
  end if;

  insert into stock_moves (variant_id, location_id, qty, kind, ref, batch_no, note, actor_id)
  values (p_variant, p_location, p_qty, p_kind, p_ref, p_batch, p_note, auth.uid())
  returning id into v_move_id;

  return v_move_id;
end; $$;

create or replace function transfer_stock(
  p_variant uuid, p_from uuid, p_to uuid, p_qty int, p_note text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_ref text := 'TR-' || to_char(now(), 'YYYYMMDDHH24MISS');
begin
  if not is_ops() then
    raise exception 'forbidden — ops only';
  end if;
  if p_qty <= 0 then raise exception 'qty must be positive'; end if;
  if p_from = p_to then raise exception 'same location'; end if;
  perform apply_stock_move(p_variant, p_from, -p_qty, 'transfer_out', v_ref, null, p_note);
  perform apply_stock_move(p_variant, p_to,    p_qty, 'transfer_in',  v_ref, null, p_note);
end; $$;

create or replace function log_order_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into order_events(order_id, kind, to_status, actor_id)
    values (new.id, 'placed', new.status, auth.uid());
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into order_events(order_id, kind, from_status, to_status, actor_id)
    values (new.id, 'status_changed', old.status, new.status, auth.uid());
  end if;
  return new;
end; $$;

-- Tighten grants: nothing for PUBLIC/anon; ops-checked authenticated only.
revoke execute on function apply_stock_move(uuid,uuid,int,text,text,text,text) from public, anon;
revoke execute on function transfer_stock(uuid,uuid,uuid,int,text) from public, anon;
grant  execute on function apply_stock_move(uuid,uuid,int,text,text,text,text) to authenticated;
grant  execute on function transfer_stock(uuid,uuid,uuid,int,text) to authenticated;
revoke execute on function log_order_event() from public, anon, authenticated;

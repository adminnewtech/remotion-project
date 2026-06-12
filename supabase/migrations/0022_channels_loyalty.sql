-- Elite v1 — 0022 real order channels + native loyalty points
--
-- 1) orders.channel: the orders list/analytics previously DERIVED a fake
--    channel from a hash. Now it's a real column — checkout defaults 'online',
--    the POS writes 'pos' — so multi-channel analytics are truthful.
-- 2) Loyalty: profiles.loyalty_points + an automatic award trigger — 1 point
--    per whole KWD when an order first reaches 'completed' (idempotent via the
--    status transition guard). Native loyalty GHL lacks. Additive only.

alter table orders   add column if not exists channel text not null default 'online';
alter table profiles add column if not exists loyalty_points int not null default 0;
create index if not exists idx_orders_channel on orders(channel);

create or replace function award_loyalty_points()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed'
     and new.user_id is not null then
    update profiles
      set loyalty_points = loyalty_points + floor(coalesce(new.total, 0))::int
      where id = new.user_id;
  end if;
  return new;
end; $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_orders_loyalty') then
    create trigger trg_orders_loyalty
      after update of status on orders
      for each row execute function award_loyalty_points();
  end if;
end $$;

revoke execute on function award_loyalty_points() from public, anon, authenticated;

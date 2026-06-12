-- Elite v1 — 0039: POS shift management + cash drawer
-- Adds register/shift lifecycle so the cashier can open a till, take cash with
-- a reconciled drawer, record pay-in/pay-out, and close with a Z-report.
-- Additive + idempotent. Money is KWD numeric(10,3). RLS: ops only.

-- ── orders.pos_shift_id ───────────────────────────────────────────────────────
alter table orders add column if not exists pos_shift_id uuid;

-- ── pos_shifts ────────────────────────────────────────────────────────────────
create table if not exists pos_shifts (
  id            uuid primary key default gen_random_uuid(),
  cashier_id    uuid not null references profiles(id) on delete restrict,
  location_id   uuid,                                  -- nullable: single-store default
  status        text not null default 'open' check (status in ('open','closed')),
  opening_float numeric(10,3) not null default 0,
  -- Filled at close:
  counted_cash  numeric(10,3),
  expected_cash numeric(10,3),
  cash_variance numeric(10,3),
  total_sales   numeric(10,3) not null default 0,      -- gross sales rung on this shift
  cash_sales    numeric(10,3) not null default 0,
  knet_sales    numeric(10,3) not null default 0,
  order_count   int not null default 0,
  opened_at     timestamptz not null default now(),
  closed_at     timestamptz,
  notes         text
);
create index if not exists idx_pos_shifts_cashier on pos_shifts(cashier_id, status);
create index if not exists idx_pos_shifts_open on pos_shifts(status) where status = 'open';

-- One open shift per cashier at a time.
create unique index if not exists uq_pos_shift_one_open
  on pos_shifts(cashier_id) where status = 'open';

-- ── pos_cash_moves ────────────────────────────────────────────────────────────
create table if not exists pos_cash_moves (
  id         uuid primary key default gen_random_uuid(),
  shift_id   uuid not null references pos_shifts(id) on delete cascade,
  kind       text not null check (kind in ('pay_in','pay_out','drop')),
  amount     numeric(10,3) not null check (amount > 0),
  reason     text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_pos_cash_moves_shift on pos_cash_moves(shift_id, created_at);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table pos_shifts     enable row level security;
alter table pos_cash_moves enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='pos_shifts' and policyname='pos_shifts ops all') then
    create policy "pos_shifts ops all" on pos_shifts for all using (is_ops()) with check (is_ops());
  end if;
  if not exists (select 1 from pg_policies where tablename='pos_cash_moves' and policyname='pos_cash_moves ops all') then
    create policy "pos_cash_moves ops all" on pos_cash_moves for all using (is_ops()) with check (is_ops());
  end if;
end $$;

-- ── open_pos_shift ────────────────────────────────────────────────────────────
create or replace function open_pos_shift(p_opening_float numeric default 0, p_location_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_ops() then raise exception 'not authorized'; end if;
  insert into pos_shifts (cashier_id, location_id, opening_float)
    values (auth.uid(), p_location_id, coalesce(p_opening_float, 0))
    returning id into v_id;
  return v_id;
exception when unique_violation then
  -- Already has an open shift → return it instead of erroring.
  select id into v_id from pos_shifts where cashier_id = auth.uid() and status = 'open' limit 1;
  return v_id;
end; $$;
revoke execute on function open_pos_shift(numeric, uuid) from public, anon;
grant  execute on function open_pos_shift(numeric, uuid) to authenticated;

-- ── record_cash_move ──────────────────────────────────────────────────────────
create or replace function record_cash_move(p_shift_id uuid, p_kind text, p_amount numeric, p_reason text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_ops() then raise exception 'not authorized'; end if;
  if p_kind not in ('pay_in','pay_out','drop') then raise exception 'bad kind'; end if;
  insert into pos_cash_moves (shift_id, kind, amount, reason, created_by)
    values (p_shift_id, p_kind, p_amount, p_reason, auth.uid())
    returning id into v_id;
  return v_id;
end; $$;
revoke execute on function record_cash_move(uuid, text, numeric, text) from public, anon;
grant  execute on function record_cash_move(uuid, text, numeric, text) to authenticated;

-- ── pos_shift_summary (Z-report payload) ──────────────────────────────────────
create or replace function pos_shift_summary(p_shift_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_shift   pos_shifts;
  v_cash    numeric(10,3) := 0;
  v_knet    numeric(10,3) := 0;
  v_count   int := 0;
  v_pay_in  numeric(10,3) := 0;
  v_pay_out numeric(10,3) := 0;
  v_drop    numeric(10,3) := 0;
  v_expected numeric(10,3);
begin
  if not is_ops() then raise exception 'not authorized'; end if;
  select * into v_shift from pos_shifts where id = p_shift_id;
  if not found then raise exception 'shift not found'; end if;

  -- Sales rung on this shift, split by tender.
  select
    coalesce(sum(case when pay.method = 'cod'  then pay.amount else 0 end), 0),
    coalesce(sum(case when pay.method = 'knet' then pay.amount else 0 end), 0),
    count(distinct o.id)
  into v_cash, v_knet, v_count
  from orders o
  join payments pay on pay.order_id = o.id
  where o.pos_shift_id = p_shift_id and o.status = 'completed';

  -- Cash drawer movements.
  select
    coalesce(sum(case when kind='pay_in'  then amount else 0 end),0),
    coalesce(sum(case when kind='pay_out' then amount else 0 end),0),
    coalesce(sum(case when kind='drop'    then amount else 0 end),0)
  into v_pay_in, v_pay_out, v_drop
  from pos_cash_moves where shift_id = p_shift_id;

  v_expected := v_shift.opening_float + v_cash + v_pay_in - v_pay_out - v_drop;

  return jsonb_build_object(
    'shift_id',      v_shift.id,
    'status',        v_shift.status,
    'opened_at',     v_shift.opened_at,
    'closed_at',     v_shift.closed_at,
    'opening_float', v_shift.opening_float,
    'cash_sales',    v_cash,
    'knet_sales',    v_knet,
    'total_sales',   v_cash + v_knet,
    'order_count',   v_count,
    'pay_in',        v_pay_in,
    'pay_out',       v_pay_out,
    'drop',          v_drop,
    'expected_cash', v_expected,
    'counted_cash',  v_shift.counted_cash,
    'cash_variance', v_shift.cash_variance
  );
end; $$;
revoke execute on function pos_shift_summary(uuid) from public, anon;
grant  execute on function pos_shift_summary(uuid) to authenticated;

-- ── close_pos_shift ───────────────────────────────────────────────────────────
create or replace function close_pos_shift(p_shift_id uuid, p_counted_cash numeric, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_sum     jsonb;
  v_expected numeric(10,3);
  v_cash    numeric(10,3);
  v_knet    numeric(10,3);
  v_count   int;
begin
  if not is_ops() then raise exception 'not authorized'; end if;

  v_sum := pos_shift_summary(p_shift_id);
  v_expected := (v_sum->>'expected_cash')::numeric;
  v_cash     := (v_sum->>'cash_sales')::numeric;
  v_knet     := (v_sum->>'knet_sales')::numeric;
  v_count    := (v_sum->>'order_count')::int;

  update pos_shifts set
    status        = 'closed',
    counted_cash  = p_counted_cash,
    expected_cash = v_expected,
    cash_variance = round(p_counted_cash - v_expected, 3),
    cash_sales    = v_cash,
    knet_sales    = v_knet,
    total_sales   = v_cash + v_knet,
    order_count   = v_count,
    closed_at     = now(),
    notes         = p_notes
  where id = p_shift_id and status = 'open';

  -- Return the final Z-report (re-read so counted/variance are populated).
  return pos_shift_summary(p_shift_id);
end; $$;
revoke execute on function close_pos_shift(uuid, numeric, text) from public, anon;
grant  execute on function close_pos_shift(uuid, numeric, text) to authenticated;

-- ── redeem_loyalty_points (atomic point burn for POS) ─────────────────────────
-- Decrements a customer's loyalty_points; raises if insufficient. Returns the
-- new balance. 100 points = 1.000 KWD is enforced in the app layer (pure logic);
-- this function only moves points so the ledger stays atomic.
create or replace function redeem_loyalty_points(p_user_id uuid, p_points int)
returns int language plpgsql security definer set search_path = public as $$
declare v_new int;
begin
  if not is_ops() then raise exception 'not authorized'; end if;
  if p_points <= 0 then raise exception 'points must be positive'; end if;
  update profiles set loyalty_points = loyalty_points - p_points
   where id = p_user_id and loyalty_points >= p_points
   returning loyalty_points into v_new;
  if not found then raise exception 'insufficient loyalty points'; end if;
  return v_new;
end; $$;
revoke execute on function redeem_loyalty_points(uuid, int) from public, anon;
grant  execute on function redeem_loyalty_points(uuid, int) to authenticated;

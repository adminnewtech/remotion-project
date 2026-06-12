-- Elite v1 — 0034: KNET reconciliation + COD remittances
-- Additive, idempotent.

create table if not exists knet_settlements (
  id          uuid primary key default gen_random_uuid(),
  settle_date date not null,
  gross       numeric(12,3) not null check (gross >= 0),
  fees        numeric(12,3) not null default 0 check (fees >= 0),
  net         numeric(12,3) not null,
  bank_ref    text,
  file_name   text,
  status      text not null default 'open'
    check (status in ('open','matched','posted')),
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists knet_settlement_lines (
  id            bigint generated always as identity primary key,
  settlement_id uuid not null references knet_settlements(id) on delete cascade,
  gateway_ref   text not null,
  amount        numeric(12,3) not null,
  payment_id    uuid references payments(id) on delete set null,
  status        text not null default 'unmatched'
    check (status in ('matched','unmatched','amount_mismatch','duplicate'))
);
create index if not exists idx_knet_lines_gref on knet_settlement_lines(gateway_ref);

create table if not exists cod_remittances (
  id          uuid primary key default gen_random_uuid(),
  driver_id   uuid not null references profiles(id) on delete restrict,
  amount      numeric(12,3) not null check (amount > 0),
  order_ids   uuid[] not null default '{}',
  received_by uuid references profiles(id) on delete set null,
  method      text not null default 'cash'
    check (method in ('cash','bank_transfer')),
  status      text not null default 'received'
    check (status in ('received','posted')),
  note        text,
  created_at  timestamptz not null default now()
);

alter table knet_settlements     enable row level security;
alter table knet_settlement_lines enable row level security;
alter table cod_remittances      enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='knet_settlements' and policyname='knet_settlements ops all') then
    create policy "knet_settlements ops all" on knet_settlements for all using (is_ops()) with check (is_ops());
  end if;
  if not exists (select 1 from pg_policies where tablename='knet_settlement_lines' and policyname='knet_lines ops all') then
    create policy "knet_lines ops all" on knet_settlement_lines for all using (is_ops()) with check (is_ops());
  end if;
  if not exists (select 1 from pg_policies where tablename='cod_remittances' and policyname='cod_remittances ops all') then
    create policy "cod_remittances ops all" on cod_remittances for all using (is_ops()) with check (is_ops());
  end if;
end $$;

-- match_knet_settlement: match lines to payments by gateway_ref
create or replace function match_knet_settlement(p_settlement uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_matched   int := 0;
  v_mismatch  int := 0;
  v_unknown   int := 0;
  r record;
begin
  if not is_ops() then raise exception 'forbidden'; end if;
  for r in
    select l.id, l.gateway_ref, l.amount
      from knet_settlement_lines l
     where l.settlement_id = p_settlement
       and l.status = 'unmatched'
  loop
    declare v_pay payments%rowtype;
    begin
      select * into v_pay
        from payments
       where gateway_ref = r.gateway_ref
         and method in ('knet','card','apple_pay','google_pay')
         and status = 'paid'
       limit 1;

      if not found then
        update knet_settlement_lines set status = 'unmatched' where id = r.id;
        v_unknown := v_unknown + 1;
      elsif abs(v_pay.amount - r.amount) > 0.001 then
        update knet_settlement_lines
           set payment_id = v_pay.id, status = 'amount_mismatch'
         where id = r.id;
        v_mismatch := v_mismatch + 1;
      else
        update knet_settlement_lines
           set payment_id = v_pay.id, status = 'matched'
         where id = r.id;
        v_matched := v_matched + 1;
      end if;
    end;
  end loop;

  -- Update settlement status
  if v_mismatch = 0 and v_unknown = 0 then
    update knet_settlements set status = 'matched' where id = p_settlement;
  end if;

  return jsonb_build_object(
    'matched', v_matched,
    'amount_mismatch', v_mismatch,
    'unmatched', v_unknown
  );
end; $$;
revoke execute on function match_knet_settlement(uuid) from public, anon, authenticated;
grant  execute on function match_knet_settlement(uuid) to authenticated;

-- post_knet_settlement: R11 journal entry after matching
create or replace function post_knet_settlement(p_settlement uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_s knet_settlements;
  v_je uuid;
begin
  if not is_ops() then raise exception 'forbidden'; end if;
  select * into v_s from knet_settlements where id = p_settlement;
  if not found then raise exception 'settlement not found'; end if;
  if v_s.status <> 'matched' then raise exception 'settlement not fully matched'; end if;

  v_je := post_journal(
    'knet_settlement', p_settlement::text,
    'تسوية كي-نت ' || v_s.settle_date::text,
    jsonb_build_array(
      jsonb_build_object('account', '1010', 'debit', v_s.net,  'credit', 0, 'note', 'صافي التسوية'),
      jsonb_build_object('account', '6500', 'debit', v_s.fees, 'credit', 0, 'note', 'عمولة البوابة'),
      jsonb_build_object('account', '1010', 'debit', 0, 'credit', v_s.gross, 'note', 'إجمالي كي-نت clearing')
    )
  );
  update knet_settlements set status = 'posted' where id = p_settlement;
  return v_je;
end; $$;
revoke execute on function post_knet_settlement(uuid) from public, anon, authenticated;
grant  execute on function post_knet_settlement(uuid) to authenticated;

-- post_cod_remittance: R12 journal entry
create or replace function post_cod_remittance(p_remittance uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_r cod_remittances; v_je uuid;
begin
  if not is_ops() then raise exception 'forbidden'; end if;
  select * into v_r from cod_remittances where id = p_remittance;
  if not found then raise exception 'remittance not found'; end if;
  if v_r.status = 'posted' then raise exception 'already posted'; end if;

  v_je := post_journal(
    'cod_remittance', p_remittance::text,
    'تسليم COD مندوب: ' || (select full_name from profiles where id = v_r.driver_id),
    jsonb_build_array(
      jsonb_build_object('account', '1000', 'debit', v_r.amount, 'credit', 0),
      jsonb_build_object('account', '1020', 'debit', 0, 'credit', v_r.amount)
    )
  );
  update cod_remittances set status = 'posted' where id = p_remittance;
  return v_je;
end; $$;
revoke execute on function post_cod_remittance(uuid) from public, anon, authenticated;
grant  execute on function post_cod_remittance(uuid) to authenticated;

-- Ledger-vs-operational cross-check: returns 0.000 when books are clean
create or replace view v_ledger_delta as
  select
    (select coalesce(sum(amount), 0) from payments where status = 'paid') as op_revenue,
    (select coalesce(sum(jl.credit - jl.debit), 0)
       from journal_lines jl
       join accounts a on a.code = jl.account_code
      where a.kind = 'revenue' and a.code = '4000') as ledger_revenue,
    round((select coalesce(sum(amount), 0) from payments where status = 'paid') -
          (select coalesce(sum(jl.credit - jl.debit), 0)
             from journal_lines jl
             join accounts a on a.code = jl.account_code
            where a.kind = 'revenue' and a.code = '4000'), 3) as delta;

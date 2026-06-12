-- Elite v1 — 0025 accounting core (Blueprint Phase 1)
--
-- Double-entry spine: Kuwait chart of accounts, journal_entries/lines with a
-- DEFERRED balanced-entry constraint, idempotent post_journal(), and
-- auto-posting triggers wiring the EXISTING transaction streams into the
-- ledger: captured payments (R1), refunds (R2), expenses (R3), PO receipts
-- (R4). Views: trial balance, P&L, balance sheet. Additive only.

-- ── Chart of accounts ───────────────────────────────────────
create table if not exists accounts (
  code       text primary key,
  name_ar    text not null,
  name_en    text not null,
  kind       text not null check (kind in ('asset','liability','equity','revenue','expense')),
  is_active  boolean not null default true
);

insert into accounts (code, name_ar, name_en, kind) values
  ('1000','النقدية','Cash on hand','asset'),
  ('1010','تسوية كي-نت','KNET clearing','asset'),
  ('1020','تحصيلات المندوبين (COD)','COD courier clearing','asset'),
  ('1100','المخزون','Inventory','asset'),
  ('1200','ذمم مدينة','Accounts receivable','asset'),
  ('2000','ذمم دائنة (موردون)','Accounts payable','liability'),
  ('2100','التزام بطاقات الهدايا','Gift card liability','liability'),
  ('3000','حقوق الملكية','Owner equity','equity'),
  ('4000','إيراد المبيعات','Sales revenue','revenue'),
  ('4010','إيراد التوصيل','Delivery income','revenue'),
  ('4020','إيراد التركيب','Installation income','revenue'),
  ('5000','تكلفة البضاعة المباعة','COGS','expense'),
  ('5100','مصاريف تشغيلية','Operating expenses','expense'),
  ('5200','فقد/هدر المخزون','Inventory shrinkage','expense')
on conflict (code) do nothing;

-- ── Journal ─────────────────────────────────────────────────
create sequence if not exists journal_entry_seq start 10001;
create table if not exists journal_entries (
  id          uuid primary key default gen_random_uuid(),
  entry_no    bigint not null default nextval('journal_entry_seq'),
  memo        text,
  source_kind text not null,           -- 'payment'|'refund'|'expense'|'po_receipt'|'manual'|...
  source_id   text not null,           -- idempotency key within source_kind
  posted_at   timestamptz not null default now(),
  created_by  uuid references profiles(id) on delete set null,
  unique (source_kind, source_id)
);

create table if not exists journal_lines (
  id         bigint generated always as identity primary key,
  entry_id   uuid not null references journal_entries(id) on delete cascade,
  account_code text not null references accounts(code),
  debit      numeric(12,3) not null default 0 check (debit  >= 0),
  credit     numeric(12,3) not null default 0 check (credit >= 0),
  note       text,
  check (not (debit > 0 and credit > 0))
);
create index if not exists idx_journal_lines_entry   on journal_lines(entry_id);
create index if not exists idx_journal_lines_account on journal_lines(account_code);

-- Balanced-entry guard: at COMMIT every entry must have Σdebit = Σcredit.
create or replace function assert_entry_balanced()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_d numeric(14,3); v_c numeric(14,3); v_entry uuid;
begin
  v_entry := coalesce(new.entry_id, old.entry_id);
  select coalesce(sum(debit),0), coalesce(sum(credit),0) into v_d, v_c
    from journal_lines where entry_id = v_entry;
  if v_d <> v_c then
    raise exception 'unbalanced journal entry % (debit % <> credit %)', v_entry, v_d, v_c;
  end if;
  return null;
end; $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_journal_balanced') then
    create constraint trigger trg_journal_balanced
      after insert or update or delete on journal_lines
      deferrable initially deferred
      for each row execute function assert_entry_balanced();
  end if;
end $$;

-- ── Idempotent poster ───────────────────────────────────────
-- p_lines: jsonb array of {account, debit, credit, note?}. Returns entry id
-- (existing one when the (source_kind, source_id) was already posted).
create or replace function post_journal(
  p_source_kind text, p_source_id text, p_memo text, p_lines jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_line jsonb;
begin
  select id into v_id from journal_entries
    where source_kind = p_source_kind and source_id = p_source_id;
  if v_id is not null then return v_id; end if;

  insert into journal_entries (memo, source_kind, source_id, created_by)
    values (p_memo, p_source_kind, p_source_id, auth.uid())
    returning id into v_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    insert into journal_lines (entry_id, account_code, debit, credit, note)
    values (
      v_id,
      v_line->>'account',
      coalesce((v_line->>'debit')::numeric, 0),
      coalesce((v_line->>'credit')::numeric, 0),
      v_line->>'note'
    );
  end loop;
  return v_id;
end; $$;

-- ── Auto-posting rules ──────────────────────────────────────
-- R1 payment captured  → DR clearing/cash, CR sales revenue
-- R2 refund (negative) → DR sales revenue, CR clearing/cash
create or replace function post_payment_journal()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_cash text; v_amt numeric(12,3);
begin
  if new.status not in ('paid','refunded') then return new; end if;
  if tg_op = 'UPDATE' and old.status = new.status then return new; end if;
  v_cash := case when new.method = 'knet' then '1010'
                 when new.method = 'cod'  then '1020'
                 else '1000' end;
  v_amt := abs(coalesce(new.amount, 0));
  if v_amt = 0 then return new; end if;

  begin
    if coalesce(new.amount,0) >= 0 and new.status = 'paid' then
      perform post_journal('payment', new.id::text,
        'تحصيل دفعة طلب', jsonb_build_array(
          jsonb_build_object('account', v_cash, 'debit', v_amt, 'credit', 0),
          jsonb_build_object('account', '4000', 'debit', 0, 'credit', v_amt)));
    else
      perform post_journal('refund', new.id::text,
        'استرداد/مرتجع', jsonb_build_array(
          jsonb_build_object('account', '4000', 'debit', v_amt, 'credit', 0),
          jsonb_build_object('account', v_cash, 'debit', 0, 'credit', v_amt)));
    end if;
  exception when others then
    -- Accounting must NEVER block commerce; skip + warn, reconcile later.
    raise warning 'journal post skipped for payment %: %', new.id, sqlerrm;
  end;
  return new;
end; $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_payments_journal') then
    create trigger trg_payments_journal
      after insert or update of status on payments
      for each row execute function post_payment_journal();
  end if;
end $$;

-- R3 operating expense → DR opex, CR cash
create or replace function post_expense_journal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.amount,0) <= 0 then return new; end if;
  begin
    perform post_journal('expense', new.id::text,
      'مصروف: ' || coalesce(new.vendor,''), jsonb_build_array(
        jsonb_build_object('account','5100','debit',new.amount,'credit',0,'note',new.category),
        jsonb_build_object('account','1000','debit',0,'credit',new.amount)));
  exception when others then
    raise warning 'journal post skipped for expense %: %', new.id, sqlerrm;
  end;
  return new;
end; $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_expenses_journal') then
    create trigger trg_expenses_journal
      after insert on expenses
      for each row execute function post_expense_journal();
  end if;
end $$;

-- R4 PO receipt → DR inventory (Δreceived × unit_cost), CR accounts payable
create or replace function post_po_receipt_journal()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_delta int; v_val numeric(12,3);
begin
  v_delta := coalesce(new.qty_received,0) - coalesce(old.qty_received,0);
  if v_delta <= 0 or coalesce(new.unit_cost,0) <= 0 then return new; end if;
  v_val := round(v_delta * new.unit_cost, 3);
  begin
    perform post_journal('po_receipt', new.id::text || ':' || new.qty_received::text,
      'استلام مشتريات', jsonb_build_array(
        jsonb_build_object('account','1100','debit',v_val,'credit',0),
        jsonb_build_object('account','2000','debit',0,'credit',v_val)));
  exception when others then
    raise warning 'journal post skipped for po item %: %', new.id, sqlerrm;
  end;
  return new;
end; $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_po_receipt_journal') then
    create trigger trg_po_receipt_journal
      after update of qty_received on purchase_order_items
      for each row execute function post_po_receipt_journal();
  end if;
end $$;

-- ── Reporting views ─────────────────────────────────────────
create or replace view v_trial_balance as
  select a.code, a.name_ar, a.name_en, a.kind,
         coalesce(sum(l.debit),0)::numeric(14,3)  as total_debit,
         coalesce(sum(l.credit),0)::numeric(14,3) as total_credit,
         (coalesce(sum(l.debit),0) - coalesce(sum(l.credit),0))::numeric(14,3) as balance
  from accounts a
  left join journal_lines l on l.account_code = a.code
  group by a.code, a.name_ar, a.name_en, a.kind;

create or replace view v_profit_loss as
  select kind, code, name_ar, name_en,
         case when kind = 'revenue' then (total_credit - total_debit)
              else (total_debit - total_credit) end as amount
  from v_trial_balance
  where kind in ('revenue','expense');

create or replace view v_balance_sheet as
  select kind, code, name_ar, name_en,
         case when kind = 'asset' then balance else -balance end as amount
  from v_trial_balance
  where kind in ('asset','liability','equity');

-- ── Security ────────────────────────────────────────────────
alter table accounts        enable row level security;
alter table journal_entries enable row level security;
alter table journal_lines   enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='accounts' and policyname='accounts ops read') then
    create policy "accounts ops read" on accounts for select using (is_ops());
  end if;
  if not exists (select 1 from pg_policies where tablename='journal_entries' and policyname='journal ops read') then
    create policy "journal ops read" on journal_entries for select using (is_ops());
  end if;
  if not exists (select 1 from pg_policies where tablename='journal_lines' and policyname='journal lines ops read') then
    create policy "journal lines ops read" on journal_lines for select using (is_ops());
  end if;
end $$;

-- post_journal is invoked by triggers (definer) and admins for manual entries.
-- Trigger functions run as owner; no role needs direct EXECUTE.
revoke execute on function post_journal(text,text,text,jsonb) from public, anon, authenticated;
revoke execute on function post_payment_journal()    from public, anon, authenticated;
revoke execute on function post_expense_journal()    from public, anon, authenticated;
revoke execute on function post_po_receipt_journal() from public, anon, authenticated;
revoke execute on function assert_entry_balanced()   from public, anon, authenticated;

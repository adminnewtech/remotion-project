-- Elite v1 — 0033: Accounting completion
-- Adds: new accounts, supplier payments, deferred revenue, COGS posting,
--       order completion posting, posting_rules catalog.
-- Additive only. Money: numeric(12,3) KWD.

-- Additional accounts needed for full double-entry
insert into accounts (code, name_ar, name_en, kind) values
  ('2200', 'إيراد مؤجل (مدفوعة غير مكتملة)',  'Deferred revenue',         'liability'),
  ('2110', 'التزام نقاط الولاء',               'Loyalty points liability', 'liability'),
  ('4900', 'خصومات المبيعات (مقابل)',           'Sales discounts (contra)', 'revenue'),
  ('6500', 'عمولة بوابة الدفع',                'Payment gateway fees',     'expense'),
  ('1030', 'ذمم مندوبي التوصيل — COD تفصيلي', 'COD driver clearing',      'asset')
on conflict (code) do nothing;

-- Supplier payments table (maps AP to bank/cash)
create table if not exists supplier_payments (
  id          uuid primary key default gen_random_uuid(),
  po_id       uuid not null references purchase_orders(id) on delete restrict,
  amount      numeric(12,3) not null check (amount > 0),
  method      text not null default 'bank_transfer'
    check (method in ('cash','bank_transfer','cheque')),
  paid_at     date not null default current_date,
  note        text,
  posted_at   timestamptz,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table supplier_payments enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='supplier_payments' and policyname='supplier_payments ops all') then
    create policy "supplier_payments ops all" on supplier_payments for all
      using (is_ops()) with check (is_ops());
  end if;
end $$;

-- Auto-post supplier payment (R10: DR AP / CR Bank)
create or replace function post_supplier_payment_journal() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform post_journal(
      'supplier_payment', new.id::text,
      'دفع مورد — ' || coalesce((select number from purchase_orders where id = new.po_id), ''),
      jsonb_build_array(
        jsonb_build_object('account', '2000', 'debit', new.amount, 'credit', 0),
        jsonb_build_object('account', '1010', 'debit', 0, 'credit', new.amount)
      )
    );
    update supplier_payments set posted_at = now() where id = new.id;
  exception when others then
    raise warning 'journal post skipped for supplier_payment %: %', new.id, sqlerrm;
  end;
  return new;
end; $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_supplier_payment_journal') then
    create trigger trg_supplier_payment_journal
      after insert on supplier_payments
      for each row execute function post_supplier_payment_journal();
  end if;
end $$;
revoke execute on function post_supplier_payment_journal() from public, anon, authenticated;

-- Order completion: R4 revenue recognition (deferred → actual revenue split)
-- Re-posts the payment as deferred revenue on capture, then recognizes on completion.
-- Note: existing trg_payments_journal posts payment→4000 directly.
-- We add COGS posting on order completion (R5): DR COGS / CR Inventory.
create or replace function post_order_completion_journal() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_cogs     numeric(12,3) := 0;
  v_discount numeric(12,3) := 0;
begin
  if new.status = 'completed' and (old.status is distinct from 'completed') then
    -- COGS: sum of qty * avg_cost per line
    select coalesce(sum(oi.qty * coalesce(pv.avg_cost, 0)), 0)
      into v_cogs
      from order_items oi
      join product_variants pv on pv.id = oi.variant_id
     where oi.order_id = new.id;

    v_discount := coalesce(new.discount_total, 0);

    -- R5 COGS entry
    if v_cogs > 0 then
      begin
        perform post_journal(
          'order_cogs', new.id::text,
          'تكلفة مبيعات — ' || coalesce(new.order_number, new.id::text),
          jsonb_build_array(
            jsonb_build_object('account', '5000', 'debit', v_cogs, 'credit', 0),
            jsonb_build_object('account', '1100', 'debit', 0, 'credit', v_cogs)
          )
        );
      exception when others then
        raise warning 'COGS post skipped for order %: %', new.id, sqlerrm;
      end;
    end if;

    -- R4 discount recognition (if any)
    if v_discount > 0 then
      begin
        perform post_journal(
          'order_discount', new.id::text,
          'خصم طلب — ' || coalesce(new.order_number, new.id::text),
          jsonb_build_array(
            jsonb_build_object('account', '4900', 'debit', v_discount, 'credit', 0),
            jsonb_build_object('account', '4000', 'debit', 0, 'credit', v_discount)
          )
        );
      exception when others then
        raise warning 'Discount post skipped for order %: %', new.id, sqlerrm;
      end;
    end if;
  end if;
  return new;
end; $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_order_completion_journal') then
    create trigger trg_order_completion_journal
      after update of status on orders
      for each row execute function post_order_completion_journal();
  end if;
end $$;
revoke execute on function post_order_completion_journal() from public, anon, authenticated;

-- Inventory adjustment posting (R12: cycle count adjustment)
create or replace function post_stock_adjustment_journal() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_cost numeric(12,3); v_val numeric(12,3);
begin
  if new.kind <> 'adjustment' then return new; end if;
  -- get avg_cost for the variant
  select coalesce(avg_cost, 0) into v_cost
    from product_variants where id = new.variant_id;
  v_val := round(abs(new.qty) * v_cost, 3);
  if v_val <= 0 then return new; end if;
  begin
    if new.qty < 0 then
      -- loss: DR shrinkage, CR inventory
      perform post_journal(
        'stock_adjust', new.id::text,
        'تسوية مخزون — ' || coalesce(new.ref, ''),
        jsonb_build_array(
          jsonb_build_object('account', '5200', 'debit', v_val, 'credit', 0),
          jsonb_build_object('account', '1100', 'debit', 0, 'credit', v_val)
        )
      );
    else
      -- gain: DR inventory, CR shrinkage (contra)
      perform post_journal(
        'stock_adjust', new.id::text,
        'تسوية مخزون (زيادة) — ' || coalesce(new.ref, ''),
        jsonb_build_array(
          jsonb_build_object('account', '1100', 'debit', v_val, 'credit', 0),
          jsonb_build_object('account', '5200', 'debit', 0, 'credit', v_val)
        )
      );
    end if;
  exception when others then
    raise warning 'Stock adjust journal skipped for move %: %', new.id, sqlerrm;
  end;
  return new;
end; $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_stock_adjust_journal') then
    create trigger trg_stock_adjust_journal
      after insert on stock_moves
      for each row execute function post_stock_adjustment_journal();
  end if;
end $$;
revoke execute on function post_stock_adjustment_journal() from public, anon, authenticated;

-- posting_rules: human-readable catalog of all rules (informational + configurable)
create table if not exists posting_rules (
  id          text primary key,
  event       text not null,
  description text not null,
  debit_code  text not null,
  credit_code text not null,
  amount_expr text not null,
  is_active   boolean not null default true
);
alter table posting_rules enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='posting_rules' and policyname='posting_rules ops read') then
    create policy "posting_rules ops read" on posting_rules for select using (is_ops());
    create policy "posting_rules admin all" on posting_rules for all using (is_admin()) with check (is_admin());
  end if;
end $$;

insert into posting_rules values
  ('R1',  'payment.paid (knet/card)',   'دفع إلكتروني', '1010', '4000', 'payment.amount'),
  ('R2',  'payment.paid (cod)',         'دفع COD',       '1020', '4000', 'payment.amount'),
  ('R3',  'payment.paid (cash/pos)',    'دفع نقدي',      '1000', '4000', 'payment.amount'),
  ('R4',  'order.completed discount',  'خصم طلب',       '4900', '4000', 'order.discount_total'),
  ('R5',  'order.completed cogs',      'تكلفة مبيعات',  '5000', '1100', 'Σqty×avg_cost'),
  ('R6',  'payment.refunded',          'استرداد',        '4000', '1010', 'abs(payment.amount)'),
  ('R7',  'expense.inserted',          'مصروف تشغيلي',   '5100', '1000', 'expense.amount'),
  ('R8',  'po_receipt.qty_received++', 'استلام مشتريات', '1100', '2000', 'qty×unit_cost'),
  ('R9',  'supplier_payment.inserted', 'دفع مورد',       '2000', '1010', 'supplier_payment.amount'),
  ('R10', 'stock_moves.adjustment',    'تسوية مخزون',    '5200', '1100', 'abs(qty)×avg_cost'),
  ('R11', 'knet_settlement.matched',   'تسوية كي-نت',    '1010', '1010', 'net+fee=gross'),
  ('R12', 'cod_remittance.received',   'تسليم COD',      '1000', '1020', 'remittance.amount')
on conflict (id) do nothing;

# Newtech OS — المخطط الرئيسي للنظام المتكامل
### Integrated OS Master Blueprint (CRM + ERP + E-commerce + Accounting + AI Agents)

_Last updated: 2026-06-12 · Owner: Architecture · Status: **decision-ready**_

This blueprint extends the live platform (migrations `0001`–`0024`, Next.js web,
Expo mobile, Supabase + Edge Functions) into a full business OS. Every module
below is specified to implementation level: exact tables, columns, RPCs, edge
functions, admin pages, and acceptance tests. All migrations are **additive and
idempotent** (`if not exists` / guarded `do $$`), matching house style. All
money is `numeric(12,3)` KWD (3-decimal fils). All new tables get RLS with the
existing `is_ops()` / `is_admin()` helpers unless stated otherwise.

**Grounding (what exists today and is reused, never duplicated):**

| Asset | Where | Reused by |
|---|---|---|
| `stock_moves` immutable ledger + `apply_stock_move()` / `transfer_stock()` | 0019 | ERP, Accounting (COGS), AI insight agent |
| `purchase_orders` / `purchase_order_items` / `product_serials` | 0019 | Landed costs, warranty engine, auto-PO |
| `order_events` audit trail (trigger-fed) | 0018 | CRM automations, AI insight agent |
| `orders.channel` + loyalty trigger | 0022 | CRM segments, accounting posting |
| `tickets` (+`channel`,`customer_phone`,`external_id`) + `ticket_messages` | 0005/0014 | WhatsApp center, support triage agent |
| `returns` / `return_items` (RMA) | 0021 | Accounting refund postings |
| `customer_notes` (notes/tasks) | 0023 | CRM deals timeline |
| `appointments` (installation/inspection/pickup) | 0024 | Bundles auto-spawn, pickup checkout |
| `fulfillment_tasks` + `installation_jobs` + dispatch auto-assign | 0004 | Bundles, van stock |
| `expenses`, `marketing_campaigns` | 0016 | Accounting postings, CRM campaigns |
| `app_settings` singleton, `delivery_zones` | 0017 | Pickup config, COD zones |
| Edge: `checkout`, `payment-webhook`, `notify`, `whatsapp-webhook`, `ai-copilot`, `daily-report`, `dispatch` | `supabase/functions/` | All modules |
| `_shared/anthropic.ts` (`askClaude`), `_shared/whatsapp.ts` (`sendTemplate`), `_shared/aggregates.ts` | `supabase/functions/_shared/` | All AI agents |

---

## 1. CRM متكامل — Pipelines, Automations, Win-back, WhatsApp Center

### 1.1 Pipelines & Deals (B2B/wholesale + high-ticket retail)

Newtech sells AC units, large appliances, and B2B contracts — deals worth
tracking through stages, not just orders. Deals link to `profiles` (the
customer-360 already aggregates orders/RFM there).

```sql
-- 0029_crm_pipeline.sql
create table if not exists crm_pipelines (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,                      -- 'مبيعات الجملة', 'مشاريع تكييف'
  is_default boolean not null default false,
  position   int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists crm_stages (
  id          uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references crm_pipelines(id) on delete cascade,
  name        text not null,                     -- 'جديد','تواصل','عرض سعر','تفاوض','فوز','خسارة'
  position    int not null default 0,
  win_pct     int not null default 0 check (win_pct between 0 and 100),
  is_won      boolean not null default false,
  is_lost     boolean not null default false
);

create sequence if not exists deal_number_seq start 2001;
create table if not exists crm_deals (
  id            uuid primary key default gen_random_uuid(),
  deal_number   text not null unique default ('DL-' || nextval('deal_number_seq')::text),
  pipeline_id   uuid not null references crm_pipelines(id) on delete restrict,
  stage_id      uuid not null references crm_stages(id) on delete restrict,
  customer_id   uuid references profiles(id) on delete set null,
  title         text not null,
  value         numeric(12,3) not null default 0,        -- KWD
  expected_close date,
  owner_id      uuid references profiles(id) on delete set null,
  source        text,                            -- 'whatsapp'|'walk_in'|'web'|'referral'|'agent'
  order_id      uuid references orders(id) on delete set null,  -- set on win→order conversion
  lost_reason   text,
  meta          jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_deals_stage on crm_deals(stage_id);
create index if not exists idx_deals_customer on crm_deals(customer_id);

-- Immutable deal timeline, mirrors order_events pattern (0018).
create table if not exists crm_deal_events (
  id         bigint generated always as identity primary key,
  deal_id    uuid not null references crm_deals(id) on delete cascade,
  kind       text not null,        -- 'created'|'stage_changed'|'note'|'whatsapp_out'|'call'|'won'|'lost'
  from_stage uuid, to_stage uuid,
  note       text,
  actor_id   uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Trigger: log stage changes automatically (same shape as log_order_event).
create or replace function log_deal_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into crm_deal_events(deal_id, kind, to_stage, actor_id)
    values (new.id, 'created', new.stage_id, auth.uid());
  elsif new.stage_id is distinct from old.stage_id then
    insert into crm_deal_events(deal_id, kind, from_stage, to_stage, actor_id)
    values (new.id, 'stage_changed', old.stage_id, new.stage_id, auth.uid());
  end if;
  return new;
end; $$;
```

RLS: ops-all on every table (house pattern). Seed: one default pipeline with
the 6 Arabic stages above. `customer_notes` (0023) render inside the deal view
filtered by `customer_id` — no new notes table.

### 1.2 Marketing Automation Engine (trigger → condition → action)

A declarative workflow engine over **our own event sources**: `order_events`,
`tickets`, `crm_deal_events`, customer tier transitions, and time-based scans
(win-back). One runner edge function, cron-invoked, fully audited.

```sql
-- 0030_automation_engine.sql
create table if not exists automation_workflows (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  trigger     text not null,    -- see trigger catalog below
  conditions  jsonb not null default '[]',  -- [{field,op,value}] AND-ed
  actions     jsonb not null default '[]',  -- ordered [{type, params}]
  delay_minutes int not null default 0,     -- schedule action after trigger
  is_active   boolean not null default true,
  cooldown_days int not null default 7,     -- per-customer re-fire guard
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists automation_runs (
  id          bigint generated always as identity primary key,
  workflow_id uuid not null references automation_workflows(id) on delete cascade,
  customer_id uuid references profiles(id) on delete set null,
  source_kind text not null,            -- 'order_event'|'ticket'|'deal_event'|'scan'
  source_id   text not null,            -- id in the source table
  status      text not null default 'pending', -- pending|running|done|failed|skipped
  run_at      timestamptz not null default now(),  -- honor delay_minutes
  result      jsonb,
  error       text,
  created_at  timestamptz not null default now(),
  unique (workflow_id, source_kind, source_id)     -- exactly-once per event
);
create index if not exists idx_auto_runs_due on automation_runs(status, run_at);

-- Cursor so the runner only scans new events (no triggers on hot tables).
create table if not exists automation_cursors (
  source text primary key,              -- 'order_events'|'deal_events'|'tickets'
  last_id bigint not null default 0,
  updated_at timestamptz not null default now()
);
```

**Trigger catalog** (the `trigger` column; runner maps each to a query):

| Trigger | Source | Fires when |
|---|---|---|
| `order.placed` | `order_events.kind='placed'` | new order |
| `order.status:<to>` | `order_events.kind='status_changed'` | e.g. `order.status:completed` |
| `order.abandoned` | scan: `orders.status='draft'` older than N min with items | cart recovery |
| `ticket.opened` / `ticket.resolved` | `tickets` insert / status flip | support follow-ups |
| `customer.tier_changed` | RFM recompute (existing customer-360 job) writes `automation_runs` | VIP welcome |
| `customer.inactive:<days>` | scan: last `orders.placed_at` > N days | **win-back** |
| `deal.stage:<stage>` | `crm_deal_events` | quote follow-up |
| `warranty.expiring:<days>` | scan on `warranties` (§2.6) | renewal upsell |

**Condition fields** (evaluated against a hydrated context row): `order.total`,
`order.channel`, `customer.loyalty_points`, `customer.tier`,
`customer.order_count`, `ticket.kind`, `deal.value` — ops:
`eq|neq|gt|gte|lt|lte|in|contains`.

**Action types** (executed in order; each result appended to `runs.result`):

| Action | Params | Implementation |
|---|---|---|
| `whatsapp_template` | `{template, lang, params[]}` | `_shared/whatsapp.ts → sendTemplate` |
| `whatsapp_session` | `{body}` | only if inside 24h window (checks `wa_messages`) |
| `notify` | `{title, body, channels[]}` | existing `notify` edge function |
| `issue_coupon` | `{kind, value, expires_days, prefix}` | insert into `discounts`, code in message |
| `add_tag` | `{tag}` | append to `orders.tags` or `profiles.meta.tags` |
| `create_task` | `{body, due_days, assignee_role}` | insert `customer_notes(kind='task')` |
| `create_deal` | `{pipeline, title}` | insert `crm_deals` |
| `award_points` | `{points}` | update `profiles.loyalty_points` |

**Edge function `automation-runner`** (new, cron every 5 min via
`pg_cron → net.http_post` or Supabase scheduled functions):
1. For each cursor source: fetch rows with `id > last_id` (limit 500), match
   active workflows by trigger, insert `automation_runs` (dedup by unique key,
   respecting `cooldown_days` per customer via a lookback query), advance cursor.
2. Run scans (`order.abandoned`, `customer.inactive`, `warranty.expiring`) at
   most hourly (guard with a `scan:<trigger>:<date-hour>` source_id).
3. Claim due runs (`status='pending' and run_at<=now()` with
   `for update skip locked`), evaluate conditions, execute actions, mark
   `done/failed/skipped`.

**Win-back sequences** = 3 stacked workflows on the same trigger family:
`customer.inactive:30` → WhatsApp "اشتقنالك" template; `customer.inactive:60`
→ `issue_coupon` 10% + WhatsApp; `customer.inactive:90` → create ops task
"اتصال شخصي" for the assigned salesperson. Cooldown 120 days prevents loops.

### 1.3 WhatsApp-native Messaging Center

The `whatsapp-webhook` function already lands inbound messages into
`tickets`/`ticket_messages` (channel `whatsapp`). The center adds first-class
message storage (delivery receipts, templates, media) and a send path:

```sql
-- 0031_whatsapp_center.sql
create table if not exists wa_messages (
  id          uuid primary key default gen_random_uuid(),
  wa_id       text unique,                   -- Meta message id (wamid.*)
  ticket_id   uuid references tickets(id) on delete set null,
  customer_id uuid references profiles(id) on delete set null,
  phone       text not null,                 -- E.164 without '+'
  direction   text not null check (direction in ('in','out')),
  kind        text not null default 'text',  -- text|template|image|document|interactive
  body        text,
  template    text,                          -- template name when kind='template'
  media_url   text,
  status      text not null default 'sent',  -- received|sent|delivered|read|failed
  sent_by     uuid references profiles(id) on delete set null, -- null = automation/agent
  agent_run_id uuid,                         -- links to agent_actions (§5)
  created_at  timestamptz not null default now()
);
create index if not exists idx_wa_phone on wa_messages(phone, created_at desc);

create table if not exists wa_templates (   -- mirror of Meta-approved templates
  name       text primary key,
  language   text not null default 'ar',
  category   text not null default 'utility', -- utility|marketing|authentication
  body       text not null,                 -- with {{1}} placeholders, for preview
  params     int not null default 0,
  is_active  boolean not null default true
);

-- 24h customer-service window check (Cloud API rule).
create or replace function wa_window_open(p_phone text) returns boolean
language sql stable as $$
  select exists (select 1 from wa_messages
    where phone = p_phone and direction = 'in'
      and created_at > now() - interval '24 hours');
$$;
```

**Edge function `whatsapp-send`** (new): `POST {phone, body?|template?,
params?, ticket_id?}` — ops-JWT or service-role (automations/agents). Enforces:
free-text only when `wa_window_open()`; otherwise must be an active
`wa_templates` row. Writes `wa_messages(direction='out')`, mirrors into
`ticket_messages`. **`whatsapp-webhook` change:** also upsert `wa_messages` on
inbound + on `statuses[]` callbacks (delivered/read/failed by `wa_id`).

### 1.4 Admin pages (apps/web)

| Page | Route | Contents |
|---|---|---|
| المبيعات (Pipeline) | `/admin/crm` | Kanban by stage (drag = stage update), deal drawer with timeline + notes + WhatsApp tab |
| الأتمتة | `/admin/marketing/automations` | workflow list, builder (trigger/condition/action selects from the catalogs), run log with per-run result |
| مركز الرسائل | `/admin/inbox` | WhatsApp-first unified inbox: thread list by phone, 24h-window badge, template picker, link-to-customer/order |
| القوالب | `/admin/inbox/templates` | `wa_templates` CRUD (sync names with Meta manually for v1) |

---

## 2. ERP — Cycle Counts, Landed Costs, Reorder, Van Stock, Labels, Warranty

### 2.1 Cycle counts (الجرد الدوري)

```sql
-- 0025_reorder_cycle_counts.sql (part 1)
create sequence if not exists count_number_seq start 101;
create table if not exists cycle_counts (
  id           uuid primary key default gen_random_uuid(),
  count_number text not null unique default ('CC-' || nextval('count_number_seq')::text),
  location_id  uuid not null references locations(id) on delete restrict,
  status       text not null default 'draft',   -- draft|counting|review|posted|cancelled
  scope        jsonb not null default '{}',     -- {category_id?|variant_ids?|all:true}
  note         text,
  created_by   uuid references profiles(id) on delete set null,
  posted_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists cycle_count_items (
  id          uuid primary key default gen_random_uuid(),
  count_id    uuid not null references cycle_counts(id) on delete cascade,
  variant_id  uuid not null references product_variants(id) on delete restrict,
  expected    int not null default 0,           -- snapshot of inventory.on_hand at open
  counted     int,                              -- null until scanned/entered
  counted_by  uuid references profiles(id) on delete set null,
  counted_at  timestamptz,
  unique (count_id, variant_id)
);

-- Post: one 'adjustment' ledger move per nonzero variance. Atomic, idempotent.
create or replace function post_cycle_count(p_count uuid) returns int
language plpgsql security definer set search_path = public as $$
declare r record; v_moves int := 0;
begin
  if not is_ops() then raise exception 'forbidden'; end if;
  perform 1 from cycle_counts where id = p_count and status = 'review' for update;
  if not found then raise exception 'count not in review'; end if;
  for r in select i.variant_id, (i.counted - i.expected) as diff,
                  c.location_id, c.count_number
           from cycle_count_items i join cycle_counts c on c.id = i.count_id
           where i.count_id = p_count and i.counted is not null
             and i.counted <> i.expected
  loop
    perform apply_stock_move(r.variant_id, r.location_id, r.diff,
                             'adjustment', r.count_number, null, 'cycle count');
    v_moves := v_moves + 1;
  end loop;
  update cycle_counts set status='posted', posted_at=now() where id=p_count;
  return v_moves;
end; $$;
```

Flow: open (snapshot expected from `inventory`) → mobile/web scan barcode →
`counted` fills in → review screen shows variances → `post_cycle_count()` →
accounting picks up the adjustment moves (§4.4). Posting also emits an
`audit_events` row.

### 2.2 Landed costs (التكلفة الشاملة)

Extra costs (freight, customs, clearing) allocated onto PO receipt lines so
COGS and margins are true.

```sql
-- 0026_landed_costs_warranty.sql (part 1)
create table if not exists po_costs (
  id        uuid primary key default gen_random_uuid(),
  po_id     uuid not null references purchase_orders(id) on delete cascade,
  kind      text not null,                       -- 'freight'|'customs'|'clearance'|'other'
  amount    numeric(12,3) not null check (amount >= 0),
  allocation text not null default 'by_value',   -- by_value|by_qty
  note      text,
  created_at timestamptz not null default now()
);

alter table purchase_order_items
  add column if not exists landed_unit_cost numeric(12,3);  -- unit_cost + allocated costs/unit

-- Moving-average cost cache per variant (feeds COGS posting + margin reports).
alter table product_variants
  add column if not exists avg_cost numeric(12,3) not null default 0;

create or replace function allocate_landed_costs(p_po uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_total_value numeric; v_total_qty int;
begin
  select coalesce(sum(qty_ordered * unit_cost),0), coalesce(sum(qty_ordered),0)
    into v_total_value, v_total_qty
    from purchase_order_items where po_id = p_po;
  update purchase_order_items i set landed_unit_cost = i.unit_cost +
    coalesce((select sum(case when c.allocation='by_qty'
                  then c.amount / nullif(v_total_qty,0)
                  else c.amount * (i.unit_cost / nullif(v_total_value,0)) end)
        from po_costs c where c.po_id = p_po), 0)
  where i.po_id = p_po;
end; $$;
```

On **receive** (existing receiving flow writes `purchase` stock moves): call
`allocate_landed_costs` first, then update the moving average:
`avg_cost = (on_hand_before*avg_cost + qty_received*landed_unit_cost) / (on_hand_before+qty_received)`
— implemented inside a new `receive_po_item(p_po_item, p_qty, p_serials text[])`
RPC that wraps `apply_stock_move`, serial inserts, avg-cost update, and PO
status rollup (`partial`/`received`) in one transaction. Admin: a "تكاليف
الشحن" tab on the PO page.

### 2.3 Reorder policies + auto-PO (سياسات إعادة الطلب)

```sql
-- 0025 (part 2)
create table if not exists reorder_policies (
  variant_id   uuid not null references product_variants(id) on delete cascade,
  location_id  uuid not null references locations(id) on delete cascade,
  min_qty      int not null default 0,
  max_qty      int not null default 0 check (max_qty >= min_qty),
  supplier_id  uuid references suppliers(id) on delete set null,
  is_active    boolean not null default true,
  updated_at   timestamptz not null default now(),
  primary key (variant_id, location_id)
);

-- Draft POs for everything at/below min, grouped by supplier. Returns po ids.
create or replace function generate_reorder_pos(p_location uuid) returns setof uuid
language plpgsql security definer set search_path = public as $$
declare v_supplier uuid; v_po uuid;
begin
  if not is_ops() then raise exception 'forbidden'; end if;
  for v_supplier in
    select distinct rp.supplier_id from reorder_policies rp
      join inventory i on i.variant_id = rp.variant_id and i.location_id = rp.location_id
      where rp.location_id = p_location and rp.is_active
        and rp.supplier_id is not null and i.on_hand <= rp.min_qty
        -- skip variants already on an open PO for this location
        and not exists (select 1 from purchase_order_items pi
              join purchase_orders po on po.id = pi.po_id
              where pi.variant_id = rp.variant_id and po.location_id = rp.location_id
                and po.status in ('draft','ordered','partial'))
  loop
    insert into purchase_orders (supplier_id, location_id, status, note, created_by)
      values (v_supplier, p_location, 'draft', 'auto-reorder', auth.uid())
      returning id into v_po;
    insert into purchase_order_items (po_id, variant_id, qty_ordered, unit_cost)
      select v_po, rp.variant_id, rp.max_qty - i.on_hand,
             coalesce(v.avg_cost, 0)
        from reorder_policies rp
        join inventory i on i.variant_id = rp.variant_id and i.location_id = rp.location_id
        join product_variants v on v.id = rp.variant_id
        where rp.location_id = p_location and rp.supplier_id = v_supplier
          and rp.is_active and i.on_hand <= rp.min_qty;
    return next v_po;
  end loop;
end; $$;
```

Nightly cron (same scheduler as `daily-report`) runs
`generate_reorder_pos` per active location; drafts surface on
`/admin/purchasing` with a "مسودات تلقائية" badge and in the daily report.
**Auto-PO never auto-orders — a human flips draft→ordered** (also the HITL
boundary for the AI ops copilot, §5.2).

### 2.4 Van stock for technicians (مخزون السيارات)

No new ledger — vans are **locations**. Add to `locations`:
`kind text not null default 'store' check (kind in ('store','warehouse','van'))`
and `owner_id uuid references profiles(id)` (the technician/driver). Flows:
- **Load van:** `transfer_stock(variant, warehouse, van, qty)` from a new
  `/admin/dispatch/van-stock` screen (and mobile).
- **Consume on job:** completing an `installation_job` that used parts calls
  `apply_stock_move(variant, van_location, -qty, 'sale', order_number)`.
- **Return to warehouse:** `transfer_stock` back at end of day.
- Cycle counts (§2.1) work on vans unchanged. Reorder policies per van define
  the standard kit (min=kit qty) so `generate_reorder_pos` doubles as
  "restock the van" suggestions (supplier null → internal transfer suggestion
  list instead of PO; surfaced in the same admin screen).

### 2.5 Label printing — Code-128 (طباعة الملصقات)

Pure client-side; no schema. New page `/admin/catalog/labels`:
- Select variants (or "everything received on PO-x") → render labels with
  **`bwip-js`** (Code-128, supports the digits/uppercase SKUs we generate) into
  a print-CSS sheet (38×25 mm 3-up rolls + A4 grid presets).
- Label content: SKU barcode (Code-128 auto subset B/C), Arabic product name,
  price from `product_variants.price`, serial barcode variant for serialized
  items (`product_serials.serial`).
- POS (`/admin/cashier`) and cycle-count screens get a barcode input that
  resolves `sku` → variant (existing search RPC from 0009) or
  `serial` → `product_serials` row.

### 2.6 Serial → Warranty engine (محرك الضمان)

`product_serials` already tracks status/order linkage; `order_items` has
`warranty_expires_at`. Add the policy + claims glue:

```sql
-- 0026 (part 2)
alter table products add column if not exists warranty_months int not null default 12;

create table if not exists warranties (
  id          uuid primary key default gen_random_uuid(),
  serial_id   uuid not null references product_serials(id) on delete cascade,
  order_id    uuid references orders(id) on delete set null,
  customer_id uuid references profiles(id) on delete set null,
  starts_at   date not null,
  expires_at  date not null,
  status      text not null default 'active',  -- active|expired|voided|claimed
  unique (serial_id)
);
create index if not exists idx_warranties_expiry on warranties(expires_at) where status='active';

-- Activation: when an order completes, attach sold serials and open warranties.
create or replace function activate_warranties() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    insert into warranties (serial_id, order_id, customer_id, starts_at, expires_at)
    select ps.id, new.id, new.user_id, current_date,
           current_date + make_interval(months => p.warranty_months)
      from product_serials ps
      join product_variants v on v.id = ps.variant_id
      join products p on p.id = v.product_id
      where ps.order_id = new.id and ps.status = 'sold'
    on conflict (serial_id) do nothing;
  end if;
  return new;
end; $$;
```

POS/checkout fulfillment UI gets a "scan serial" step that marks
`product_serials.status='sold', order_id=…` (RPC `sell_serial(serial, order)` —
validates `in_stock` + variant matches an order item). `warranty_claims`
(0005) gains `warranty_id uuid references warranties` so support sees validity
instantly; the storefront `/warranty` page lets customers check by serial
(public RPC returning only status + expiry). `warranty.expiring:30` automation
trigger (§1.2) drives renewal/AMC upsell.

### 2.7 Admin pages

`/admin/inventory/counts` (cycle counts), `/admin/purchasing` gains landed-cost
tab + auto-draft badge, `/admin/inventory/reorder` (policy grid: variant ×
location min/max editable inline), `/admin/dispatch/van-stock`,
`/admin/catalog/labels`, `/admin/support/warranty` (serial lookup).

---

## 3. E-commerce — Pickup, Gift Cards, Bundles, Reviews, Wishlists

### 3.1 Pickup-at-store checkout (الاستلام من المحل)

`fulfillment_type` enum already has `'pickup'`; 0024 `appointments` has
`kind='pickup'`. Wire it end-to-end:

```sql
-- 0028_pickup_wishlist_reviews.sql (part 1)
alter table orders add column if not exists fulfillment text not null default 'delivery'
  check (fulfillment in ('delivery','pickup'));
alter table orders add column if not exists pickup_location_id uuid
  references locations(id) on delete set null;
alter table locations add column if not exists allows_pickup boolean not null default false;
create sequence if not exists pickup_code_seq start 1;
alter table orders add column if not exists pickup_code text;  -- short code, set on paid
```

**`checkout` edge function changes:** accept `{fulfillment:'pickup',
pickup_location_id}`; validate `allows_pickup`; set `delivery_fee=0`; skip
address requirement; reserve stock at the pickup location (sale move at that
location instead of default). **`payment-webhook`:** on paid pickup orders,
generate `pickup_code` (`'P-' || lpad(nextval(...)::text, 4, '0')`), create an
`appointments(kind='pickup')` row, and `notify` (WhatsApp template
`pickup_ready` once a new order status/event `ready_for_pickup` is set by ops).
Admin orders page gains a "جاهز للاستلام" action + code-verify field at
handover (compares `pickup_code`, flips to `completed`).

### 3.2 Gift cards (بطاقات الهدايا)

```sql
-- 0027_bundles_giftcards.sql (part 1)
create table if not exists gift_cards (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,            -- 'GC-' || 16 random base32 chars
  initial_value numeric(12,3) not null check (initial_value > 0),
  balance    numeric(12,3) not null,
  currency   text not null default 'KWD',
  purchaser_order_id uuid references orders(id) on delete set null,
  recipient_phone text,
  expires_at date,
  status     text not null default 'active',  -- active|depleted|expired|voided
  created_at timestamptz not null default now()
);

create table if not exists gift_card_transactions (
  id          bigint generated always as identity primary key,
  gift_card_id uuid not null references gift_cards(id) on delete cascade,
  order_id    uuid references orders(id) on delete set null,
  amount      numeric(12,3) not null,         -- + load, - redeem
  kind        text not null check (kind in ('issue','redeem','refund','adjust')),
  actor_id    uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create or replace function redeem_gift_card(p_code text, p_order uuid, p_amount numeric)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_card gift_cards; v_take numeric;
begin
  select * into v_card from gift_cards where code = upper(p_code)
    and status = 'active' and (expires_at is null or expires_at >= current_date)
    for update;
  if not found then raise exception 'gift card invalid'; end if;
  v_take := least(v_card.balance, p_amount);
  update gift_cards set balance = balance - v_take,
    status = case when balance - v_take <= 0 then 'depleted' else 'active' end
    where id = v_card.id;
  insert into gift_card_transactions (gift_card_id, order_id, amount, kind)
    values (v_card.id, p_order, -v_take, 'redeem');
  return v_take;
end; $$;
```

Selling: a virtual product (`products.kind='gift_card'` column added in this
migration: `alter table products add column if not exists kind text not null
default 'physical' check (kind in ('physical','service','gift_card'))`).
`payment-webhook` issues the card on paid (insert + WhatsApp the code to
`recipient_phone`). Redemption: `checkout` accepts `gift_card_code`, calls
`redeem_gift_card`, records it as a `payments` row with `method` extension —
**add `'gift_card'` and `'store_credit'` to `payment_method` enum** (`alter
type payment_method add value if not exists ...`). Accounting treats issuance
as a liability (§4.4 rule R7).

### 3.3 Bundles — product + installation auto-spawn (الميزة القاتلة)

A bundle = AC unit + installation service sold as one line, which on payment
**auto-spawns both a delivery task and an installation task + appointment**.

```sql
-- 0027 (part 2)
create table if not exists product_bundles (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete cascade, -- the sellable bundle product (kind='physical')
  name        text not null,
  bundle_price numeric(12,3),         -- null = sum of component prices
  is_active   boolean not null default true,
  unique (product_id)
);

create table if not exists bundle_components (
  id          uuid primary key default gen_random_uuid(),
  bundle_id   uuid not null references product_bundles(id) on delete cascade,
  component   text not null check (component in ('variant','service')),
  variant_id  uuid references product_variants(id) on delete restrict, -- when 'variant'
  service     text,                  -- 'installation'|'inspection' when 'service'
  qty         int not null default 1 check (qty > 0),
  price_part  numeric(12,3) not null default 0,  -- revenue split for accounting
  check ((component='variant') = (variant_id is not null))
);
```

**Flow (all server-side, in `payment-webhook` after marking paid):**
1. For each paid order item whose `variant_id` belongs to a bundle product →
   explode: decrement stock for each `variant` component (sale moves), and for
   each `service` component:
2. Insert `fulfillment_tasks(type='installation', order_id, status='pending')`
   **and** the standard `fulfillment_tasks(type='delivery')` (delivery spawns
   already exist today; installation is the addition), then call the existing
   `dispatch` auto-assign (least-loaded technician).
3. Insert `appointments(kind='installation', order_number, customer…,
   scheduled_at = order.delivery_slot upper bound or next business day)`.
4. Insert `installation_jobs` shell linked to the task (checklist template
   from `app_settings.notifications`-style jsonb: add
   `app_settings.install_checklist jsonb default '[]'`).
5. `notify` → WhatsApp template `install_scheduled` with date.

Storefront: bundle PDP shows components ("شامل التركيب"); cart treats it as
one line. Admin: `/admin/catalog/bundles` builder (pick product, attach
variants + services, set split prices — split must sum to bundle price; UI
enforces).

### 3.4 Reviews backend (التقييمات)

`reviews` exists (0005). Add moderation + verified purchase:

```sql
-- 0028 (part 2)
alter table reviews add column if not exists status text not null default 'pending'
  check (status in ('pending','approved','rejected'));
alter table reviews add column if not exists verified boolean not null default false;
alter table reviews add column if not exists reply text;        -- store's public reply
```

Insert policy: customer may review a product only with a completed order
containing it (RLS `with check` exists-subquery on orders+order_items);
`verified` set true by the same check in a before-insert trigger. Public reads
only `status='approved'`. Edge: `ticket.opened`-style automation
`order.status:completed` + 3-day delay → WhatsApp "قيّم مشترياتك" with deep
link. Support triage agent (§5.5) drafts replies to ≤2-star reviews as tickets.
Admin: `/admin/marketing/reviews` moderation queue. Product rating aggregate:
materialized in `products.rating_avg/rating_count` via trigger on approve.

### 3.5 Wishlists (المفضلة)

```sql
-- 0028 (part 3)
create table if not exists wishlist_items (
  user_id    uuid not null references profiles(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
-- RLS: owner all (using user_id = auth.uid()), ops read.
```

Heart icon on PDP/cards (web + Expo), `/account/wishlist` page. Automation
hooks: scan trigger `wishlist.price_drop` (price/sale change on a wished
product → WhatsApp/push) and `wishlist.back_in_stock` (on_hand 0→positive) —
both added to the §1.2 scan catalog, reading `wishlist_items`.

---

## 4. المحاسبة المتكاملة — Double-entry Accounting

### 4.1 Chart of accounts (دليل الحسابات)

```sql
-- 0032_chart_of_accounts.sql
create table if not exists accounts (
  id        uuid primary key default gen_random_uuid(),
  code      text not null unique,     -- '1000', '1100', …
  name_ar   text not null,
  name_en   text not null,
  type      text not null check (type in ('asset','liability','equity','income','expense')),
  parent_id uuid references accounts(id) on delete restrict,
  is_postable boolean not null default true,   -- false = header/rollup
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
```

**Seed (Kuwait retail; no VAT today — structure is tax-ready):**

| Code | Account | Type |
|---|---|---|
| 1000 | النقدية بالصندوق Cash on hand (POS) | asset |
| 1010 | البنك — حساب جاري Bank | asset |
| 1020 | KNET قيد التسوية (KNET clearing) | asset |
| 1030 | ذمم مندوبي التوصيل (COD courier clearing) | asset |
| 1100 | ذمم مدينة Accounts receivable | asset |
| 1200 | المخزون Inventory | asset |
| 1210 | بضاعة في الطريق Goods in transit | asset |
| 2000 | ذمم دائنة Accounts payable | liability |
| 2100 | التزام بطاقات الهدايا Gift card liability | liability |
| 2110 | التزام نقاط الولاء Loyalty liability | liability |
| 2200 | إيراد مؤجل (طلبات مدفوعة غير مكتملة) Deferred revenue | liability |
| 3000 | رأس المال Equity | equity |
| 3900 | أرباح مرحلة Retained earnings | equity |
| 4000 | إيراد المبيعات Sales revenue | income |
| 4010 | إيراد التركيب Installation revenue | income |
| 4020 | إيراد التوصيل Delivery revenue | income |
| 4900 | خصومات المبيعات Sales discounts (contra) | income |
| 5000 | تكلفة البضاعة المباعة COGS | expense |
| 5100 | فروقات الجرد Inventory shrinkage | expense |
| 6000–6900 | مصاريف تشغيلية (rent, salaries, marketing, gateway fees 6500) | expense |

### 4.2 Journal engine

```sql
-- 0033_posting_engine.sql
create sequence if not exists je_number_seq start 1;
create table if not exists journal_entries (
  id         uuid primary key default gen_random_uuid(),
  je_number  text not null unique default ('JE-' || nextval('je_number_seq')::text),
  entry_date date not null default current_date,
  memo       text,
  source_kind text not null,     -- 'order'|'payment'|'expense'|'po_receipt'|'return'|'count'|'manual'|'settlement'|'remittance'
  source_id  text not null,
  posted_by  uuid references profiles(id) on delete set null,  -- null = auto
  reversed_by uuid references journal_entries(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (source_kind, source_id)              -- idempotent auto-posting
);

create table if not exists journal_lines (
  id        bigint generated always as identity primary key,
  entry_id  uuid not null references journal_entries(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete restrict,
  debit     numeric(12,3) not null default 0 check (debit >= 0),
  credit    numeric(12,3) not null default 0 check (credit >= 0),
  check (debit = 0 or credit = 0)
);
create index if not exists idx_jl_account on journal_lines(account_id);

-- Balance enforcement: constraint trigger at tx end.
create or replace function assert_entry_balanced() returns trigger
language plpgsql as $$
declare v_diff numeric;
begin
  select coalesce(sum(debit),0) - coalesce(sum(credit),0) into v_diff
    from journal_lines where entry_id = coalesce(new.entry_id, old.entry_id);
  if v_diff <> 0 then raise exception 'journal entry unbalanced by %', v_diff; end if;
  return null;
end; $$;
create constraint trigger trg_jl_balanced
  after insert or update or delete on journal_lines
  deferrable initially deferred for each row execute function assert_entry_balanced();

-- Single entry point used by all auto-posters and the manual JE page.
create or replace function post_journal(
  p_source_kind text, p_source_id text, p_memo text,
  p_lines jsonb   -- [{account_code, debit, credit}]
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_je uuid; l jsonb;
begin
  insert into journal_entries (source_kind, source_id, memo)
    values (p_source_kind, p_source_id, p_memo)
    on conflict (source_kind, source_id) do nothing
    returning id into v_je;
  if v_je is null then return null; end if;   -- already posted (idempotent)
  for l in select * from jsonb_array_elements(p_lines) loop
    insert into journal_lines (entry_id, account_id, debit, credit)
    select v_je, a.id, coalesce((l->>'debit')::numeric,0), coalesce((l->>'credit')::numeric,0)
      from accounts a where a.code = l->>'account_code' and a.is_postable;
    if not found then raise exception 'unknown account %', l->>'account_code'; end if;
  end loop;
  return v_je;
end; $$;
```

### 4.3 Posting rules table (configurable, seeded)

```sql
create table if not exists posting_rules (
  id          text primary key,         -- 'R1'…
  event       text not null,            -- matches the trigger points below
  description text not null,
  debit_code  text not null,
  credit_code text not null,
  amount_expr text not null,            -- documentation of which amount field
  is_active   boolean not null default true
);
```

**Seeded rules (the canonical posting matrix):**

| # | Event (trigger point) | Debit | Credit | Amount |
|---|---|---|---|---|
| R1 | Payment captured — KNET (`payments.status→'paid'`, method knet/card/apple/google) | 1020 KNET clearing | 2200 Deferred revenue | `payments.amount` |
| R2 | Payment captured — POS cash | 1000 Cash | 2200 Deferred revenue | amount |
| R3 | COD order out for delivery | 1030 COD clearing | 2200 Deferred revenue | order total |
| R4 | Order **completed** (`order_events to_status='completed'`) — revenue recognition | 2200 Deferred revenue | 4000/4010/4020 split (items / installation_fee / delivery_fee), 4900 debit for discount_total | order totals |
| R5 | Order completed — COGS | 5000 COGS | 1200 Inventory | Σ qty × `variant.avg_cost` |
| R6 | Refund (`returns.status→'refunded'`) | 4000 (and 2200 if pre-completion) | 1020/1000 per original method | `refund_amount`; restock adds 1200 dr / 5000 cr at avg_cost |
| R7 | Gift card issued | 1020/1000 (tender) | 2100 GC liability | card value |
| R8 | Gift card redeemed | 2100 GC liability | 2200 Deferred revenue | redeemed amount |
| R9 | PO receipt (`receive_po_item`) | 1200 Inventory | 2000 AP | qty × landed_unit_cost |
| R10 | Supplier payment (new `supplier_payments` table: po_id, amount, method) | 2000 AP | 1010 Bank | amount |
| R11 | Expense (`expenses` insert) | 6xxx per `expenses.category`→account map | 1010/1000 | amount |
| R12 | Cycle-count/adjustment move (`stock_moves.kind='adjustment'`) | 5100 Shrinkage (or credit if gain) | 1200 Inventory | qty × avg_cost |
| R13 | KNET settlement matched (§4.5) | 1010 Bank + 6500 Gateway fees | 1020 KNET clearing | net + fee = gross |
| R14 | COD remittance received (§4.5) | 1000/1010 | 1030 COD clearing | remitted amount |
| R15 | Loyalty points awarded / redeemed | 4900 / 2110 | 2110 / 4000 | points × 0.005 KWD redemption rate (configurable in `app_settings`) |

**Implementation:** one edge function **`accounting-poster`** (cron every 5
min) consumes the same cursor pattern as `automation-runner` over
`order_events`, `payments`, `expenses`, `stock_moves`, `returns`,
`gift_card_transactions` and calls `post_journal` per rule (idempotent via the
`(source_kind, source_id)` unique key, e.g. `('payment','<payment_id>')`).
Postings are **async by design** (5-min lag is fine for books; the operational
tables remain the real-time truth). A manual "إعادة الترحيل" button replays a
date range safely thanks to idempotency.

### 4.4 Financial statements (views)

```sql
create or replace view v_account_balances as
  select a.id, a.code, a.name_ar, a.type,
         sum(jl.debit) as total_debit, sum(jl.credit) as total_credit,
         case when a.type in ('asset','expense')
              then coalesce(sum(jl.debit - jl.credit),0)
              else coalesce(sum(jl.credit - jl.debit),0) end as balance
  from accounts a
  left join journal_lines jl on jl.account_id = a.id
  group by a.id;

create or replace view v_profit_and_loss as     -- filter by je.entry_date in the page query
  select je.entry_date, a.type, a.code, a.name_ar,
         sum(case when a.type='income'  then jl.credit - jl.debit else 0 end) as income,
         sum(case when a.type='expense' then jl.debit - jl.credit else 0 end) as expense
  from journal_lines jl
  join journal_entries je on je.id = jl.entry_id
  join accounts a on a.id = jl.account_id
  where a.type in ('income','expense')
  group by 1,2,3,4;

create or replace view v_balance_sheet as
  select type, code, name_ar, balance from v_account_balances
  where type in ('asset','liability','equity');
```

`/admin/finance` upgrades from computed-from-orders to ledger-backed: trial
balance, P&L (period picker), balance sheet, JE browser with drill-down to
source (order/payment/PO links via `source_kind/source_id`). The old computed
view stays as a cross-check widget ("ledger vs operational delta" — should be
zero; a nonzero delta is an Insight-agent alert, §5.4).

### 4.5 KNET reconciliation + COD remittance

```sql
-- 0034_reconciliation.sql
create table if not exists knet_settlements (
  id          uuid primary key default gen_random_uuid(),
  settle_date date not null,
  gross       numeric(12,3) not null,
  fees        numeric(12,3) not null default 0,
  net         numeric(12,3) not null,
  bank_ref    text,
  file_name   text,                    -- uploaded statement file
  status      text not null default 'open',  -- open|matched|posted
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists knet_settlement_lines (
  id            bigint generated always as identity primary key,
  settlement_id uuid not null references knet_settlements(id) on delete cascade,
  gateway_ref   text not null,         -- matches payments.gateway_ref
  amount        numeric(12,3) not null,
  payment_id    uuid references payments(id) on delete set null,  -- set by matcher
  status        text not null default 'unmatched'  -- matched|unmatched|amount_mismatch|duplicate
);

create table if not exists cod_remittances (
  id          uuid primary key default gen_random_uuid(),
  driver_id   uuid not null references profiles(id) on delete restrict,
  amount      numeric(12,3) not null,
  order_ids   uuid[] not null default '{}',
  received_by uuid references profiles(id) on delete set null,
  method      text not null default 'cash',   -- cash|bank_transfer
  status      text not null default 'received', -- received|posted
  note        text,
  created_at  timestamptz not null default now()
);
```

**KNET flow:** finance uploads the bank/gateway settlement CSV on
`/admin/finance/reconciliation` → parser (client) inserts settlement + lines →
RPC `match_knet_settlement(p_settlement)` joins lines to `payments` by
`gateway_ref` (exact ref + amount; flags mismatch/duplicate) → review screen of
exceptions → "ترحيل" posts R13 once all lines matched or manually resolved.
**COD flow:** driver hands cash at end of day; ops opens
`/admin/finance/cod` which lists each driver's delivered-COD orders not yet in
any remittance (query over `orders` method `cod` + `fulfillment_tasks`
completed), checks them off → insert `cod_remittances` → auto-post R14.
Outstanding COD per driver = 1030 sub-balance shown per driver (group
`journal_lines` memo or simpler: live query of unremitted orders). Variance
(short cash) posts to 6xxx "عجز صندوق" via a manual JE shortcut.

---

## 5. الذكاء الاصطناعي والوكلاء — AI Agent Architecture

### 5.1 Shared agent runtime (one pattern, four agents)

Today `_shared/anthropic.ts` is text-only. Extend it (additive, keeps
`askClaude` untouched) with tool use:

```ts
// _shared/anthropic.ts additions
export interface ToolDef { name: string; description: string; input_schema: object; }
export async function runAgentTurn(opts: {
  system: string;
  messages: AnthropicMessage[];        // now supports content blocks
  tools: ToolDef[];
  maxTokens?: number;
}): Promise<{ text: string | null; toolCalls: {id:string; name:string; input:unknown}[]; stop: string }>
```

The **agent loop** lives in each edge function: call `runAgentTurn` →
execute returned tool calls against allow-listed local executors (each tool =
a thin wrapper over an existing RPC/query using `supabaseAdmin`) → append
`tool_result` blocks → repeat (max **6 iterations**, hard `max_tokens` cap,
30 s budget). Every turn is persisted:

```sql
-- 0035_agent_actions.sql
create table if not exists agent_actions (
  id          uuid primary key default gen_random_uuid(),
  agent       text not null,         -- 'sales'|'ops'|'insight'|'triage'
  session_id  uuid not null,         -- groups a conversation
  tool        text not null,
  input       jsonb not null,
  output      jsonb,
  status      text not null default 'executed', -- executed|proposed|approved|rejected|failed
  risk        text not null default 'read',     -- read|write|sensitive
  proposed_to uuid references profiles(id) on delete set null, -- HITL approver
  decided_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);
create index if not exists idx_agent_actions_pending on agent_actions(status) where status='proposed';
```

**Guardrail tiers (uniform across agents):**

| Tier | Examples | Behavior |
|---|---|---|
| `read` | search catalog, get order, snapshot | execute immediately, log |
| `write` | draft PO, create task, send WA reply within window | execute immediately **but only into draft/pending states**, log |
| `sensitive` | refund, discount > 10%, price change, send marketing template, PO ordered | **never executed by the agent** — row written `status='proposed'`, surfaces in `/admin/approvals`; human approve runs the executor, reject records reason |

Additional global guardrails: agents run with a **dedicated executor module**
(never raw SQL / never service-role passthrough to arbitrary tables); per-agent
allow-list of tools; per-session spend cap (tokens) and action cap (writes ≤ 10
/session); all prompts instruct Arabic-first replies; PII minimization (tools
return phone-masked rows except where needed to send).

### 5.2 (a) Sales agent on WhatsApp — وكيل المبيعات

**Entry:** `whatsapp-webhook` change — if the inbound thread has no open human
assignment and `app_settings.payments`-style flag `ai.sales_agent=true`,
forward the message to a new edge function **`agent-sales`** with the thread
history (last 20 `wa_messages` for the phone). The agent replies in-session
(24h window ⇒ free-text allowed). A human typing in `/admin/inbox` flips the
ticket to `human` and mutes the agent for that thread.

**Tools:**

```json
[
 {"name":"search_catalog","description":"Search products by Arabic/English text, category, price range. Returns top 5 with price, sale price, stock.",
  "input_schema":{"type":"object","properties":{"query":{"type":"string"},"max_price":{"type":"number"},"category":{"type":"string"}},"required":["query"]}},
 {"name":"get_product_details","input_schema":{"type":"object","properties":{"product_id":{"type":"string"}},"required":["product_id"]},
  "description":"Full details incl. variants, warranty months, bundle (with-install) option, delivery fee for a zone."},
 {"name":"check_stock_and_eta","input_schema":{"type":"object","properties":{"variant_id":{"type":"string"},"area":{"type":"string"}},"required":["variant_id"]},
  "description":"On-hand across locations + delivery zone fee/ETA from delivery_zones."},
 {"name":"create_cart_link","description":"Create a prefilled cart and return a short checkout URL to send the customer.",
  "input_schema":{"type":"object","properties":{"items":{"type":"array","items":{"type":"object","properties":{"variant_id":{"type":"string"},"qty":{"type":"integer"}},"required":["variant_id","qty"]}}},"required":["items"]}},
 {"name":"get_customer_context","description":"Loyalty points, tier, open orders for this phone (masked).",
  "input_schema":{"type":"object","properties":{},"required":[]}},
 {"name":"handoff_to_human","description":"Open/flag the ticket for a human when the customer asks, is angry, or requests discount/refund.",
  "input_schema":{"type":"object","properties":{"reason":{"type":"string"}},"required":["reason"]}}
]
```

`create_cart_link` implementation: insert `carts` + `cart_items` with a
`claim_token`, return `https://<store>/cart/claim/<token>` (new storefront
route that attaches the cart to the visitor). Risk tiers: all `read` except
`create_cart_link` (`write`) and `handoff_to_human` (`write`). **The agent
never quotes discounts, never promises delivery dates beyond zone ETA, never
discusses refunds — system prompt + `handoff_to_human` for all three.**

### 5.3 (b) Ops copilot extensions — act, not just answer

`ai-copilot` gains tools (same UI at `/admin` copilot drawer). All writes land
in draft/pending states or HITL proposals:

| Tool | Maps to | Risk |
|---|---|---|
| `get_snapshot` | existing `buildSnapshot()` | read |
| `query_low_stock` | `inventory` + `reorder_policies` | read |
| `draft_purchase_order` | `generate_reorder_pos` / insert draft PO with given lines | write (draft only — human flips to `ordered`) |
| `assign_task` | existing dispatch auto-assign RPC, or explicit `{task_id, assignee_id}` update where status='pending' | write |
| `create_customer_task` | `customer_notes(kind='task')` | write |
| `update_order_status` | allowed transitions `processing→ready_for_pickup` etc. (allow-list) | write |
| `create_discount_code` | insert `discounts` | **sensitive** (proposed) |
| `create_rma` | insert `returns(status='requested')` | write |
| `send_whatsapp_template` | `whatsapp-send` | **sensitive** for marketing category, write for utility |

JSON schemas mirror the table columns (e.g. `draft_purchase_order`:
`{supplier_id, location_id, items:[{variant_id, qty, unit_cost?}]}`); each
executor validates against RLS-equivalent checks before insert. Replies cite
which actions ran vs. were proposed ("سويت مسودة أمر شراء PO-1042 — تحتاج
موافقتك للإرسال").

### 5.4 (c) Insight agent — daily anomaly detection

Extends `daily-report`. A pre-pass computes deterministic anomaly candidates
(SQL, no LLM): z-score on 28-day daily revenue/orders/AOV per channel; refund
rate spike; `stock_moves` adjustment volume per location vs trailing mean;
negative-margin sales (`unit_price < avg_cost`); ledger-vs-operational delta
(§4.4); unremitted COD > 3 days; serials sold without warranty rows. Claude
then gets the candidate JSON + snapshot and **ranks, explains, and recommends**
(tool `propose_action` writes `agent_actions(status='proposed')` rows for
fixes like "draft transfer 5 units to الشويخ"). Output: `ai_reports` row +
sections in the daily WhatsApp/notify digest. Tools: `query_metric` (parametric
read over a whitelisted view set), `propose_action` (sensitive). No direct
writes ever.

### 5.5 (d) Support auto-triage on tickets

New edge function **`agent-triage`**, invoked by DB webhook on `tickets`
insert (and on ≤2★ review approve). Tools: `get_ticket_thread`,
`get_customer_360`, `lookup_warranty` (by serial/order), `lookup_order`,
`set_ticket_fields` (`{priority, kind, assignee_role}` — write),
`draft_reply` (writes an **internal** `ticket_messages` row flagged
`is_draft=true` — add `alter table ticket_messages add column if not exists
is_draft boolean not null default false`; drafts visible only to ops, one
click to send), `escalate` (write). Classification rubric in the system
prompt: warranty (serial present + valid → attach `warranty_id`), complaint
(negative sentiment → priority high + human), return (→ suggest RMA draft),
general (FAQ answer draft from `app_settings` + policies). Auto-send is **off**
in v1 — every reply is a draft (HITL), revisit after eval gates pass.

### 5.6 Eval strategy

```sql
-- 0036_agent_evals.sql
create table if not exists agent_eval_cases (
  id uuid primary key default gen_random_uuid(),
  agent text not null, name text not null,
  input jsonb not null,                 -- message/thread/ticket fixture
  expected jsonb not null,              -- {must_call_tools[], must_not[], assert_text_contains[], expected_classification}
  is_active boolean not null default true
);
create table if not exists agent_eval_runs (
  id bigint generated always as identity primary key,
  case_id uuid references agent_eval_cases(id) on delete cascade,
  model text not null, passed boolean not null, detail jsonb,
  created_at timestamptz not null default now()
);
```

- **Golden sets:** ≥30 cases/agent seeded from real (anonymized) WhatsApp
  threads and tickets; assertions are mechanical (tool-call presence/absence,
  classification match, Arabic response, no-discount-promise regex).
- **Runner:** `scripts/eval-agents.ts` hits the deployed functions in a
  `dry_run=true` mode (executors stubbed to fixtures); CI job runs it nightly
  and on any prompt/tool change; merge gate = no regression vs last green.
- **Online metrics (weekly review):** sales agent — handoff rate, cart-link
  CTR, conversion; triage — draft acceptance rate (sent unedited / edited /
  discarded); copilot — proposal approval rate; insight — alert precision
  (ops marks each alert صحيح/خاطئ, stored in `ai_reports.meta`).
- **Kill switches:** per-agent boolean in `app_settings` (`ai` jsonb), checked
  at function entry.

---

## 6. خطة البناء — Build Phases (migrations 0025+)

> Ordering rationale: ERP + commerce first (they create the economic events),
> CRM second (consumes events), accounting third (posts events — wants gift
> cards/bundles/landed costs to exist), agents last (act on everything).
> Each phase ships behind its admin nav item; nothing blocks the live app.

### Phase 1 — ERP core + Commerce killer features (Weeks 1–3)

| Migration | Contents |
|---|---|
| `0025_reorder_cycle_counts.sql` | `cycle_counts`, `cycle_count_items`, `post_cycle_count()`, `reorder_policies`, `generate_reorder_pos()`, `locations.kind/owner_id` (van stock) |
| `0026_landed_costs_warranty.sql` | `po_costs`, `landed_unit_cost`, `variants.avg_cost`, `allocate_landed_costs()`, `receive_po_item()`, `products.warranty_months`, `warranties`, `activate_warranties` trigger, `sell_serial()` |
| `0027_bundles_giftcards.sql` | `products.kind`, `product_bundles`, `bundle_components`, `gift_cards`, `gift_card_transactions`, `redeem_gift_card()`, `payment_method` enum additions |
| `0028_pickup_wishlist_reviews.sql` | `orders.fulfillment/pickup_location_id/pickup_code`, `locations.allows_pickup`, reviews moderation columns + verified trigger, `wishlist_items` |

**Files:** edge `checkout` (pickup + gift card redeem + bundle pricing),
`payment-webhook` (bundle explode → tasks/appointments, gift card issue,
pickup code), admin pages `inventory/counts`, `inventory/reorder`,
`dispatch/van-stock`, `catalog/labels` (bwip-js), `catalog/bundles`,
`marketing/reviews`, storefront wishlist + `/cart/claim/[token]` + pickup
option in checkout UI + `/warranty` lookup.

**Acceptance tests (Phase 1):**
1. Cycle count on مخزن الشويخ with a forced ±2 variance → posting writes
   exactly 2 `adjustment` moves with `ref=CC-xxx`; `inventory.on_hand` matches
   counted; re-posting is rejected.
2. PO with 600 KWD freight `by_value` → `landed_unit_cost` allocation sums to
   item value + 600 (±0.001); receiving 10 units updates `avg_cost` to the
   weighted formula value; receiving again is idempotent per qty.
3. Variant at `on_hand=min_qty` → nightly run creates exactly one draft PO for
   `max−on_hand`; running twice creates no duplicate (open-PO guard).
4. Paid bundle order (AC + تركيب) → 1 delivery task + 1 installation task +
   1 appointment + installation_job exist within the webhook transaction;
   stock decremented for the variant component only.
5. Pickup checkout: no address required, `delivery_fee=0`, stock decremented
   at the chosen store; paid → `pickup_code` set + appointment(kind='pickup');
   wrong code at handover rejected.
6. Gift card: buy 20 KWD card (paid) → card active, WhatsApp sent; redeem 15
   on an order → `payments` row method `gift_card`, balance 5; over-redeem
   capped at balance.
7. Review insert without a completed order containing the product → RLS
   rejects; with one → `verified=true`, hidden until approved.
8. Serial scanned at POS → `status='sold'`; order completes → `warranties`
   row with `expires_at = +warranty_months`; storefront lookup returns it.

### Phase 2 — CRM (Weeks 4–6)

| Migration | Contents |
|---|---|
| `0029_crm_pipeline.sql` | pipelines, stages, deals, deal events + trigger, seed default pipeline |
| `0030_automation_engine.sql` | workflows, runs, cursors |
| `0031_whatsapp_center.sql` | `wa_messages`, `wa_templates`, `wa_window_open()`, `ticket_messages.is_draft` |

**Files:** edge `automation-runner` (new, cron 5 min), `whatsapp-send` (new),
`whatsapp-webhook` (upsert wa_messages + status callbacks), admin
`/admin/crm`, `/admin/marketing/automations`, `/admin/inbox`(+templates).

**Acceptance tests (Phase 2):**
1. Drag deal across stages → `crm_deal_events` rows with correct from/to;
   won deal links `order_id`.
2. Workflow `order.status:completed` + condition `order.total ≥ 50` + action
   `whatsapp_template` → completing a 60 KWD order creates exactly one run
   (unique key proven by re-running the cursor) and one `wa_messages` out row;
   a 30 KWD order is `skipped`.
3. Win-back: customer with `last order = now()−31d` → inactive:30 fires once;
   does not re-fire within cooldown (assert on second scan).
4. `whatsapp-send` free text with no inbound in 24h → 422 forces template;
   with a fresh inbound → session message sent.
5. Inbox: inbound webhook payload creates/updates thread; Meta status
   callback flips `wa_messages.status` to `delivered` then `read`.

### Phase 3 — Accounting (Weeks 7–9)

| Migration | Contents |
|---|---|
| `0032_chart_of_accounts.sql` | `accounts` + full seed table from §4.1 |
| `0033_posting_engine.sql` | `journal_entries`, `journal_lines`, balanced-entry constraint trigger, `post_journal()`, `posting_rules` + seed R1–R15, `supplier_payments` |
| `0034_reconciliation.sql` | `knet_settlements(+lines)`, `match_knet_settlement()`, `cod_remittances`, statement views `v_account_balances`, `v_profit_and_loss`, `v_balance_sheet` |

**Files:** edge `accounting-poster` (new, cron), admin `/admin/finance`
(ledger-backed P&L/BS/trial balance/JE browser), `/admin/finance/
reconciliation`, `/admin/finance/cod`, `/admin/approvals` shell (used in
Phase 4 too).

**Acceptance tests (Phase 3):**
1. Unbalanced manual JE insert → constraint trigger aborts the transaction.
2. KNET payment paid → R1 entry; same payment replayed → no second entry
   (unique source). Order completes → R4 splits revenue exactly into
   4000/4010/4020 with 4900 for discount, and R5 COGS = Σ qty×avg_cost.
3. Full lifecycle property test: seed 20 mixed orders (KNET/COD/cash/gift
   card, one refund, one bundle) → trial balance nets to zero; 2200 balance
   equals paid-not-completed order totals.
4. Settlement CSV with 1 amount mismatch + 1 unknown ref → matcher flags
   exactly those two; posting blocked until resolved; after resolve, R13 posts
   net+fees=gross.
5. COD: driver with 3 delivered COD orders → remittance screen lists exactly
   those; posting R14 zeroes that driver's 1030 exposure.
6. Ledger-vs-operational delta widget reads 0.000 after the property test.

### Phase 4 — AI agents (Weeks 10–13)

| Migration | Contents |
|---|---|
| `0035_agent_actions.sql` | `agent_actions` + pending index, `carts.claim_token` |
| `0036_agent_evals.sql` | `agent_eval_cases`, `agent_eval_runs` + seed golden sets |

**Files:** `_shared/anthropic.ts` (`runAgentTurn` tool-use additions),
`_shared/agent.ts` (loop + executor registry + guardrail tiers — new), edge
`agent-sales` (new), `agent-triage` (new), `ai-copilot` (tools added),
`daily-report` (anomaly pre-pass + `propose_action`), `whatsapp-webhook`
(route to agent-sales), admin `/admin/approvals` (HITL queue),
`scripts/eval-agents.ts`, CI job `agent-evals`, storefront `/cart/claim/[token]`
(if not shipped in Phase 1).

**Acceptance tests (Phase 4):**
1. WhatsApp "أبي مكيف 1.5 طن تحت 150 دينار" fixture → agent calls
   `search_catalog` then `create_cart_link`; reply is Arabic, contains the
   claim URL; `agent_actions` rows logged with session grouping.
2. Customer asks for a discount → agent calls `handoff_to_human`, sends no
   price concession (regex assert), ticket flagged.
3. Copilot "اطلب كل النواقص من مورد X" → draft PO created (`status='draft'`),
   reply cites PO number; `create_discount_code` request lands as `proposed`
   and appears in `/admin/approvals`; approval executes the insert, rejection
   does not.
4. Insight: seed a 4σ revenue drop + a negative-margin sale → both appear in
   `ai_reports` candidates; proposed transfer action is `proposed`, never
   executed.
5. Triage: warranty-keyword ticket with valid serial → `kind='warranty'`,
   `warranty_id` attached, draft reply exists with `is_draft=true` and is not
   visible to the customer role (RLS assert).
6. Eval gate: `scripts/eval-agents.ts` green on all seeded cases in CI; kill
   switch `ai.sales_agent=false` makes `whatsapp-webhook` skip the agent.

---

## ملاحظات ختامية — Cross-cutting decisions

1. **Idempotency everywhere:** every auto-poster/runner keys on a unique
   `(source_kind, source_id)`; replays are free. This is the single most
   important invariant — it makes crons, webhooks, and backfills safe.
2. **Drafts as the HITL boundary:** auto-PO, agent writes, triage replies all
   land in draft/pending/proposed states. Humans promote; the system never
   silently commits money or external messages beyond utility notifications.
3. **The ledger pattern generalizes:** `stock_moves` (0019) proved it;
   `journal_lines`, `gift_card_transactions`, `wa_messages`, `agent_actions`
   are the same shape — immutable, indexed, source-referenced.
4. **No new infra:** everything runs on Supabase (tables, RPCs, RLS, cron,
   edge functions) + the existing Claude key. Cloudflare/queues deferred.
5. **Out of scope for these 4 phases:** payroll/HR, multi-currency, VAT
   (schema is ready via posting_rules if Kuwait introduces it), customer-facing
   AI beyond the WhatsApp sales agent, Shopify retirement cut-over (tracked in
   ROADMAP.md).

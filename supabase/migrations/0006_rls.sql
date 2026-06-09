-- Elite v1 — 0006 Row Level Security
-- Enforce role boundaries in the database. UI is a convenience; this is the wall.

alter table profiles            enable row level security;
alter table addresses           enable row level security;
alter table staff_zones         enable row level security;
alter table locations           enable row level security;
alter table categories          enable row level security;
alter table products            enable row level security;
alter table product_variants    enable row level security;
alter table product_media       enable row level security;
alter table inventory           enable row level security;
alter table carts               enable row level security;
alter table cart_items          enable row level security;
alter table orders              enable row level security;
alter table order_items         enable row level security;
alter table payments            enable row level security;
alter table discounts           enable row level security;
alter table fulfillment_tasks   enable row level security;
alter table driver_locations    enable row level security;
alter table proof_of_delivery   enable row level security;
alter table installation_jobs   enable row level security;
alter table tickets             enable row level security;
alter table ticket_messages     enable row level security;
alter table warranty_claims     enable row level security;
alter table reviews             enable row level security;
alter table notifications       enable row level security;
alter table push_tokens         enable row level security;
alter table audit_events        enable row level security;

-- ── Profiles ─────────────────────────────────────────────
create policy "profiles self read"   on profiles for select using (id = auth.uid() or is_ops());
create policy "profiles self update" on profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles admin all"   on profiles for all using (is_admin()) with check (is_admin());

-- ── Addresses ────────────────────────────────────────────
create policy "addresses owner" on addresses for all
  using (user_id = auth.uid() or is_ops()) with check (user_id = auth.uid() or is_ops());

-- ── Staff zones ──────────────────────────────────────────
create policy "zones self read" on staff_zones for select using (staff_id = auth.uid() or is_ops());
create policy "zones admin"     on staff_zones for all using (is_admin()) with check (is_admin());

-- ── Catalog (public read of active, ops write) ───────────
create policy "categories read" on categories for select using (is_active or is_ops());
create policy "categories write" on categories for all using (is_ops()) with check (is_ops());
create policy "products read"   on products for select using (is_active or is_ops());
create policy "products write"  on products for all using (is_ops()) with check (is_ops());
create policy "variants read"   on product_variants for select using (is_active or is_ops());
create policy "variants write"  on product_variants for all using (is_ops()) with check (is_ops());
create policy "media read"      on product_media for select using (true);
create policy "media write"     on product_media for all using (is_ops()) with check (is_ops());
create policy "locations read"  on locations for select using (is_staff());
create policy "locations write" on locations for all using (is_admin()) with check (is_admin());

-- Inventory: staff read, ops/service-role write
create policy "inventory read"  on inventory for select using (is_staff());
create policy "inventory write" on inventory for all using (is_ops()) with check (is_ops());

-- ── Cart ─────────────────────────────────────────────────
create policy "carts owner" on carts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "cart_items owner" on cart_items for all
  using (exists (select 1 from carts c where c.id = cart_id and c.user_id = auth.uid()))
  with check (exists (select 1 from carts c where c.id = cart_id and c.user_id = auth.uid()));

-- ── Orders ───────────────────────────────────────────────
create policy "orders owner read" on orders for select
  using (user_id = auth.uid() or is_ops()
    or exists (select 1 from fulfillment_tasks t where t.order_id = orders.id and t.assignee_id = auth.uid()));
create policy "orders owner insert" on orders for insert
  with check (user_id = auth.uid() or is_ops());
create policy "orders ops update" on orders for update using (is_ops()) with check (is_ops());

create policy "order_items read" on order_items for select
  using (exists (select 1 from orders o where o.id = order_id
    and (o.user_id = auth.uid() or is_ops()
      or exists (select 1 from fulfillment_tasks t where t.order_id = o.id and t.assignee_id = auth.uid()))));
create policy "order_items ops write" on order_items for all using (is_ops()) with check (is_ops());

create policy "payments read" on payments for select
  using (exists (select 1 from orders o where o.id = order_id and (o.user_id = auth.uid() or is_ops())));
create policy "payments ops write" on payments for all using (is_ops()) with check (is_ops());

create policy "discounts read" on discounts for select using (is_active or is_ops());
create policy "discounts write" on discounts for all using (is_ops()) with check (is_ops());

-- ── Fulfillment tasks ────────────────────────────────────
create policy "tasks read" on fulfillment_tasks for select
  using (assignee_id = auth.uid() or is_ops()
    or exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid()));
create policy "tasks assignee update" on fulfillment_tasks for update
  using (assignee_id = auth.uid() or is_ops()) with check (assignee_id = auth.uid() or is_ops());
create policy "tasks ops write" on fulfillment_tasks for all using (is_ops()) with check (is_ops());

-- ── Driver locations ─────────────────────────────────────
create policy "driver loc insert" on driver_locations for insert
  with check (driver_id = auth.uid() and current_role_is('driver'));
create policy "driver loc read" on driver_locations for select
  using (driver_id = auth.uid() or is_ops()
    or exists (select 1 from fulfillment_tasks t join orders o on o.id = t.order_id
      where t.id = task_id and o.user_id = auth.uid()));

-- ── Proof of delivery / installation jobs ───────────────
create policy "pod read" on proof_of_delivery for select
  using (is_ops() or exists (select 1 from fulfillment_tasks t join orders o on o.id = t.order_id
    where t.id = task_id and (o.user_id = auth.uid() or t.assignee_id = auth.uid())));
create policy "pod assignee write" on proof_of_delivery for all
  using (exists (select 1 from fulfillment_tasks t where t.id = task_id and t.assignee_id = auth.uid()) or is_ops())
  with check (exists (select 1 from fulfillment_tasks t where t.id = task_id and t.assignee_id = auth.uid()) or is_ops());

create policy "install read" on installation_jobs for select
  using (is_ops() or exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid())
    or exists (select 1 from fulfillment_tasks t where t.id = task_id and t.assignee_id = auth.uid()));
create policy "install assignee write" on installation_jobs for all
  using (exists (select 1 from fulfillment_tasks t where t.id = task_id and t.assignee_id = auth.uid()) or is_ops())
  with check (exists (select 1 from fulfillment_tasks t where t.id = task_id and t.assignee_id = auth.uid()) or is_ops());

-- ── Tickets & messages ───────────────────────────────────
create policy "tickets owner" on tickets for all
  using (user_id = auth.uid() or is_ops()) with check (user_id = auth.uid() or is_ops());
create policy "ticket msgs participant" on ticket_messages for all
  using (exists (select 1 from tickets t where t.id = ticket_id and (t.user_id = auth.uid() or is_ops())))
  with check (sender_id = auth.uid() and exists (select 1 from tickets t where t.id = ticket_id and (t.user_id = auth.uid() or is_ops())));

create policy "warranty read" on warranty_claims for select
  using (is_ops() or exists (select 1 from order_items oi join orders o on o.id = oi.order_id
    where oi.id = order_item_id and o.user_id = auth.uid()));
create policy "warranty ops write" on warranty_claims for all using (is_ops()) with check (is_ops());

-- ── Reviews ──────────────────────────────────────────────
create policy "reviews read" on reviews for select using (is_published or user_id = auth.uid() or is_ops());
create policy "reviews owner write" on reviews for all
  using (user_id = auth.uid() or is_ops()) with check (user_id = auth.uid());

-- ── Notifications & push tokens ──────────────────────────
create policy "notifications owner" on notifications for select using (user_id = auth.uid());
create policy "notifications owner update" on notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push tokens owner" on push_tokens for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Audit (admin read only; writes via service role) ────
create policy "audit admin read" on audit_events for select using (is_admin());

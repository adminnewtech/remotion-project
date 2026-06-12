-- NewTech OS — 0014 Omnichannel support
--
-- Extends the existing support layer (0005) so every customer conversation —
-- in-app, WhatsApp, later Instagram / email via Chatwoot — lands in ONE inbox
-- bound to the customer/order.
--
-- LIVE-SAFE: this migration is applied to the production database. Every change
-- is additive and idempotent (IF NOT EXISTS / guarded DO $$ ... $$). It does NOT
-- drop or rewrite any existing column, policy, or data.

-- ── 1. tickets: channel support ──────────────────────────────────────────────
alter table tickets
  add column if not exists channel text not null default 'in_app';

-- Guarded check constraint (only add once).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tickets_channel_check'
  ) then
    alter table tickets
      add constraint tickets_channel_check
      check (channel in ('in_app','whatsapp','instagram','email','chatwoot'));
  end if;
end $$;

alter table tickets
  add column if not exists external_id text;
alter table tickets
  add column if not exists customer_phone text;

-- Channel tickets (WhatsApp / Chatwoot) may have no auth user until the phone is
-- matched to a profile. Allow NULL user_id (guarded; 0005 created it NOT NULL).
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tickets'
      and column_name = 'user_id'
      and is_nullable = 'NO'
  ) then
    alter table tickets alter column user_id drop not null;
  end if;
end $$;

-- Bind an inbound conversation to its source thread (wa_id / Chatwoot conv id).
create index if not exists idx_tickets_channel_external
  on tickets(channel, external_id);

-- ── 2. ticket_messages: direction + external id ──────────────────────────────
alter table ticket_messages
  add column if not exists direction text not null default 'inbound';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ticket_messages_direction_check'
  ) then
    alter table ticket_messages
      add constraint ticket_messages_direction_check
      check (direction in ('inbound','outbound'));
  end if;
end $$;

alter table ticket_messages
  add column if not exists external_id text;

-- Channel messages (from WhatsApp / Chatwoot) may have no auth user. Drop the
-- NOT NULL on sender_id if it is still enforced. The FK stays (ON DELETE SET
-- NULL would be ideal but the original FK cascades; we keep it and simply allow
-- NULL — service-role inserts pass sender_id = null for inbound channel msgs).
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ticket_messages'
      and column_name = 'sender_id'
      and is_nullable = 'NO'
  ) then
    alter table ticket_messages alter column sender_id drop not null;
  end if;
end $$;

-- ── 3. RLS — channel-aware ───────────────────────────────────────────────────
-- 0006 already created:
--   "tickets owner"            on tickets         (owner OR is_ops)
--   "ticket msgs participant"  on ticket_messages (participant; check sender = self)
-- That keeps customers scoped to their own tickets and lets ops manage all of
-- them, which already covers channel tickets bound to a user_id. We ADD policies
-- so that (a) the service_role (webhooks) can write channel tickets/messages
-- that have NO auth user, and (b) ops can post outbound messages with a NULL or
-- self sender_id. Existing policies are left intact.

-- Service-role bypasses RLS by default in Supabase, so these policies are a
-- belt-and-braces guard and also document intent. Guarded create (drop-if-exists
-- then create) keeps the migration re-runnable.

drop policy if exists "tickets service_role write" on tickets;
create policy "tickets service_role write" on tickets for all
  to service_role using (true) with check (true);

drop policy if exists "ticket msgs service_role write" on ticket_messages;
create policy "ticket msgs service_role write" on ticket_messages for all
  to service_role using (true) with check (true);

-- Let ops post messages on any ticket regardless of sender_id (the original
-- participant policy requires sender_id = auth.uid(), which blocks ops posting
-- an outbound message on a channel ticket they don't "own"). This adds, not
-- replaces — Postgres RLS is permissive (OR) across policies for the same cmd.
drop policy if exists "ticket msgs ops write" on ticket_messages;
create policy "ticket msgs ops write" on ticket_messages for insert
  to authenticated
  with check (
    is_ops()
    and exists (select 1 from tickets t where t.id = ticket_id)
  );

drop policy if exists "ticket msgs ops read" on ticket_messages;
create policy "ticket msgs ops read" on ticket_messages for select
  to authenticated
  using (is_ops());

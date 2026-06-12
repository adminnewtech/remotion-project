-- Elite v1 — 0032: WhatsApp message store + templates + is_draft on ticket_messages
-- Additive, idempotent.

-- WhatsApp message log (inbound + outbound, delivery status)
create table if not exists wa_messages (
  id          uuid primary key default gen_random_uuid(),
  wa_id       text unique,
  ticket_id   uuid references tickets(id) on delete set null,
  customer_id uuid references profiles(id) on delete set null,
  phone       text not null,
  direction   text not null check (direction in ('in','out')),
  kind        text not null default 'text'
    check (kind in ('text','template','image','document','interactive')),
  body        text,
  template    text,
  media_url   text,
  status      text not null default 'sent'
    check (status in ('received','sent','delivered','read','failed')),
  sent_by     uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_wa_phone on wa_messages(phone, created_at desc);
create index if not exists idx_wa_ticket on wa_messages(ticket_id, created_at desc);

-- WhatsApp template registry
create table if not exists wa_templates (
  name       text primary key,
  language   text not null default 'ar',
  category   text not null default 'utility'
    check (category in ('utility','marketing','authentication')),
  body       text not null,
  params     int  not null default 0,
  is_active  boolean not null default true
);

-- 24h customer-service window
create or replace function wa_window_open(p_phone text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from wa_messages
     where phone = p_phone
       and direction = 'in'
       and created_at > now() - interval '24 hours'
  );
$$;
revoke execute on function wa_window_open(text) from public, anon, authenticated;
grant  execute on function wa_window_open(text) to service_role, authenticated;

-- is_draft on ticket_messages (for triage agent drafts — not visible to customers)
alter table ticket_messages
  add column if not exists is_draft boolean not null default false;

-- RLS
alter table wa_messages  enable row level security;
alter table wa_templates enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='wa_messages' and policyname='wa_messages ops all') then
    create policy "wa_messages ops all" on wa_messages for all using (is_ops()) with check (is_ops());
  end if;
  if not exists (select 1 from pg_policies where tablename='wa_templates' and policyname='wa_templates ops all') then
    create policy "wa_templates ops all" on wa_templates for all using (is_ops()) with check (is_ops());
  end if;
end $$;

-- Seed default WhatsApp templates
insert into wa_templates (name, language, category, body, params) values
  ('order_paid',       'ar', 'utility',    'أهلاً {{1}}، تم تأكيد طلبك رقم {{2}} بنجاح. سيصلك قريباً.', 2),
  ('order_shipped',    'ar', 'utility',    'طلبك رقم {{1}} في الطريق إليك. المندوب سيتصل بك قريباً.', 1),
  ('order_delivered',  'ar', 'utility',    'تم تسليم طلبك رقم {{1}} بنجاح. شكراً لثقتك بنيوتك!', 1),
  ('install_scheduled','ar', 'utility',    'تم تحديد موعد تركيب طلبك {{1}} يوم {{2}}. فريقنا سيكون معك.', 2),
  ('pickup_ready',     'ar', 'utility',    'طلبك جاهز للاستلام. رمز الاستلام: {{1}}. تفضل لأقرب فرع.', 1),
  ('welcome_vip',      'ar', 'marketing',  'مبروك {{1}}! انضممت لبرنامج نيوتك VIP. استمتع بمزايا حصرية.', 1),
  ('winback_30',       'ar', 'marketing',  'اشتقنالك {{1}}! 😊 تصفح أحدث عروضنا وعد إلينا.', 1)
on conflict (name) do nothing;

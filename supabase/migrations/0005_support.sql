-- Elite v1 — 0005 support, warranty, reviews, notifications, audit

create table tickets (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid references orders(id) on delete set null,
  user_id      uuid not null references profiles(id) on delete cascade,
  kind         ticket_kind not null default 'general',
  status       ticket_status not null default 'open',
  subject      text not null,
  assignee_id  uuid references profiles(id) on delete set null,
  zoho_desk_id text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger trg_tickets_updated before update on tickets
  for each row execute function set_updated_at();
create index idx_tickets_user on tickets(user_id);
create index idx_tickets_status on tickets(status);

create table ticket_messages (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references tickets(id) on delete cascade,
  sender_id   uuid not null references profiles(id) on delete cascade,
  body        text not null,
  attachments text[] not null default '{}',
  created_at  timestamptz not null default now()
);
create index idx_ticket_messages_ticket on ticket_messages(ticket_id, created_at);

create table warranty_claims (
  id            uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references order_items(id) on delete cascade,
  ticket_id     uuid references tickets(id) on delete set null,
  status        text not null default 'open',
  resolution    text,
  job_task_id   uuid references fulfillment_tasks(id) on delete set null,
  created_at    timestamptz not null default now()
);

create table reviews (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references products(id) on delete cascade,
  user_id       uuid not null references profiles(id) on delete cascade,
  order_item_id uuid references order_items(id) on delete set null,
  rating        int not null check (rating between 1 and 5),
  body          text,
  is_published  boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (product_id, user_id, order_item_id)
);
create index idx_reviews_product on reviews(product_id);

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  kind       text not null,
  title_ar   text,
  title_en   text,
  body_ar    text,
  body_en    text,
  data       jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index idx_notifications_user on notifications(user_id, created_at desc);

create table push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  expo_token text not null unique,
  platform   text check (platform in ('ios','android','web')),
  created_at timestamptz not null default now()
);

create table audit_events (
  id         bigint generated always as identity primary key,
  actor_id   uuid references profiles(id) on delete set null,
  action     text not null,
  entity     text not null,
  entity_id  text,
  before     jsonb,
  after      jsonb,
  created_at timestamptz not null default now()
);
create index idx_audit_entity on audit_events(entity, entity_id);

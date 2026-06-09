-- Elite v1 — 0004 logistics & field service

create table fulfillment_tasks (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  type          fulfillment_type not null,
  status        task_status not null default 'unassigned',
  assignee_id   uuid references profiles(id) on delete set null,  -- driver or technician
  area          text,
  scheduled_for date,
  window_start  timestamptz,
  window_end    timestamptz,
  sequence      int,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_tasks_updated before update on fulfillment_tasks
  for each row execute function set_updated_at();
create index idx_tasks_order on fulfillment_tasks(order_id);
create index idx_tasks_assignee on fulfillment_tasks(assignee_id);
create index idx_tasks_status on fulfillment_tasks(status);

-- High-write GPS stream for live driver tracking
create table driver_locations (
  id          bigint generated always as identity primary key,
  driver_id   uuid not null references profiles(id) on delete cascade,
  task_id     uuid references fulfillment_tasks(id) on delete cascade,
  lat         double precision not null,
  lng         double precision not null,
  heading     double precision,
  speed       double precision,
  recorded_at timestamptz not null default now()
);
create index idx_driver_locations_task on driver_locations(task_id, recorded_at desc);
create index idx_driver_locations_driver on driver_locations(driver_id, recorded_at desc);

create table proof_of_delivery (
  id             uuid primary key default gen_random_uuid(),
  task_id        uuid not null unique references fulfillment_tasks(id) on delete cascade,
  photo_url      text,
  signature_url  text,
  otp_verified   boolean not null default false,
  recipient_name text,
  cash_collected numeric(10,3),
  delivered_at   timestamptz not null default now()
);

create table installation_jobs (
  id                    uuid primary key default gen_random_uuid(),
  task_id               uuid not null unique references fulfillment_tasks(id) on delete cascade,
  order_id              uuid not null references orders(id) on delete cascade,
  checklist             jsonb not null default '[]'::jsonb,
  before_photos         text[] not null default '{}',
  after_photos          text[] not null default '{}',
  customer_signature_url text,
  notes                 text,
  completed_at          timestamptz
);
create index idx_install_order on installation_jobs(order_id);

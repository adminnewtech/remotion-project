-- Elite v1 — 0037: AI agent kill switches in app_settings
-- Additive, idempotent.
alter table app_settings
  add column if not exists ai jsonb not null default '{}';

comment on column app_settings.ai is
  'AI agent kill switches: {"sales_agent": false} disables the WhatsApp sales agent';

-- Elite v1 — 0035: AI agent actions log + HITL approvals + cart claim tokens
-- Additive, idempotent.

create table if not exists agent_actions (
  id          uuid primary key default gen_random_uuid(),
  agent       text not null check (agent in ('sales','ops','insight','triage')),
  session_id  uuid not null,
  tool        text not null,
  input       jsonb not null default '{}',
  output      jsonb,
  status      text not null default 'executed'
    check (status in ('executed','proposed','approved','rejected','failed')),
  risk        text not null default 'read'
    check (risk in ('read','write','sensitive')),
  proposed_to uuid references profiles(id) on delete set null,
  decided_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);
create index if not exists idx_agent_actions_pending on agent_actions(status) where status = 'proposed';
create index if not exists idx_agent_actions_session on agent_actions(session_id, created_at);

-- Cart claim tokens (for sales agent cart links)
do $$ begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'carts') then
    alter table carts
      add column if not exists claim_token text unique,
      add column if not exists claimed_by  uuid references profiles(id) on delete set null,
      add column if not exists claimed_at  timestamptz;
  end if;
end $$;

-- Public function to claim a cart by token (called from storefront)
create or replace function claim_cart_by_token(p_token text, p_user_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_cart_id uuid;
begin
  select id into v_cart_id from carts
   where claim_token = p_token
     and claimed_by is null
   for update;
  if not found then raise exception 'cart token invalid or already claimed'; end if;
  update carts set claimed_by = p_user_id, claimed_at = now()
   where id = v_cart_id;
  return v_cart_id;
end; $$;
revoke execute on function claim_cart_by_token(text, uuid) from public, anon;
grant  execute on function claim_cart_by_token(text, uuid) to authenticated;

alter table agent_actions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='agent_actions' and policyname='agent_actions ops all') then
    create policy "agent_actions ops all" on agent_actions for all using (is_ops()) with check (is_ops());
  end if;
end $$;

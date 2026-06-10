-- Elite v1 — 0011 triggers: fire notifications on key order / task transitions.
--
-- SAFE to apply to the live DB: `create or replace function`, and triggers are
-- (re)created with a guarded drop-if-exists. No table/column changes.
--
-- Strategy:
--   The `notifications` table is the durable system of record for the bell feed
--   (see notify Edge Function). DB triggers below insert the in-app row directly
--   on milestone transitions so the record exists even if no Edge Function runs.
--   They ALSO best-effort fan out to the `notify` Edge Function (push + email +
--   WhatsApp) via pg_net *if* that extension + the required GUCs are present;
--   otherwise they silently skip the fan-out (the in-app row is already written).
--
-- Required (optional) settings for HTTP fan-out, set per-project:
--   alter database postgres set app.functions_base_url = 'https://<ref>.functions.supabase.co';
--   alter database postgres set app.service_role_key  = '<service-role-key>';
-- If unset, only the in-app insert happens (safe in sandbox).

-- ── Helper: enqueue a notification (in-app insert + optional Edge fan-out) ──
create or replace function enqueue_notification(
  p_user_id  uuid,
  p_kind     text,
  p_title_ar text,
  p_title_en text,
  p_body_ar  text,
  p_body_en  text,
  p_data     jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text := current_setting('app.functions_base_url', true);
  v_key  text := current_setting('app.service_role_key', true);
  v_has_pg_net boolean;
begin
  if p_user_id is null then
    return;
  end if;

  -- 1) Durable in-app record (the contract).
  insert into notifications (user_id, kind, title_ar, title_en, body_ar, body_en, data)
  values (p_user_id, p_kind, p_title_ar, p_title_en, p_body_ar, p_body_en, coalesce(p_data, '{}'::jsonb));

  -- 2) Best-effort fan-out to the notify Edge Function (push/email/WhatsApp).
  --    Only if pg_net is installed AND the base URL + key GUCs are configured.
  select exists (
    select 1 from pg_extension where extname = 'pg_net'
  ) into v_has_pg_net;

  if v_has_pg_net and v_base is not null and v_base <> '' and v_key is not null and v_key <> '' then
    begin
      perform net.http_post(
        url     := v_base || '/notify',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_key
        ),
        body    := jsonb_build_object(
          'user_id', p_user_id,
          'kind',    p_kind,
          'title_ar', p_title_ar,
          'title_en', p_title_en,
          'body_ar',  p_body_ar,
          'body_en',  p_body_en,
          'data',     coalesce(p_data, '{}'::jsonb),
          -- in-app already written here; let the function handle push/email/WA.
          'channels', jsonb_build_object('inApp', false)
        )
      );
    exception when others then
      -- Never fail the originating transaction on a fan-out hiccup.
      raise warning 'enqueue_notification: edge fan-out failed: %', sqlerrm;
    end;
  end if;
end;
$$;

revoke execute on function enqueue_notification(uuid, text, text, text, text, text, jsonb)
  from anon, authenticated;
grant execute on function enqueue_notification(uuid, text, text, text, text, text, jsonb)
  to service_role;

-- ── Order status transitions → customer notifications ───────────────────────
create or replace function trg_order_status_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_num text := new.order_number;
begin
  if new.status is distinct from old.status then
    case new.status
      when 'paid' then
        perform enqueue_notification(new.user_id, 'order_paid',
          'تم تأكيد الدفع', 'Payment confirmed',
          'تم استلام دفعة طلبك ' || v_num || ' بنجاح.',
          'We received payment for your order ' || v_num || '.',
          jsonb_build_object('order_id', new.id, 'order_number', v_num));
      when 'out_for_delivery' then
        perform enqueue_notification(new.user_id, 'order_out_for_delivery',
          'طلبك في الطريق', 'Out for delivery',
          'طلبك ' || v_num || ' في الطريق إليك الآن.',
          'Your order ' || v_num || ' is on its way.',
          jsonb_build_object('order_id', new.id, 'order_number', v_num));
      when 'delivered' then
        perform enqueue_notification(new.user_id, 'order_delivered',
          'تم التوصيل', 'Delivered',
          'تم توصيل طلبك ' || v_num || '. شكراً لتسوقك مع نيوتك.',
          'Your order ' || v_num || ' has been delivered. Thank you for shopping with Newtech.',
          jsonb_build_object('order_id', new.id, 'order_number', v_num));
      when 'installing' then
        perform enqueue_notification(new.user_id, 'order_installing',
          'جاري التركيب', 'Installation in progress',
          'الفني يقوم بتركيب طلبك ' || v_num || ' الآن.',
          'Our technician is installing your order ' || v_num || '.',
          jsonb_build_object('order_id', new.id, 'order_number', v_num));
      when 'completed' then
        perform enqueue_notification(new.user_id, 'order_completed',
          'اكتمل طلبك', 'Order completed',
          'اكتمل طلبك ' || v_num || ' بنجاح.',
          'Your order ' || v_num || ' is now complete.',
          jsonb_build_object('order_id', new.id, 'order_number', v_num));
      else
        -- other statuses (draft/processing/cancelled/refunded) handled elsewhere
        null;
    end case;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_status_notify on orders;
create trigger trg_orders_status_notify
  after update of status on orders
  for each row execute function trg_order_status_notify();

-- ── Task status transitions → customer notifications + order status sync ────
-- When a delivery task goes en_route → customer "out_for_delivery"; when a
-- delivery completes → "delivered"; when an installation starts → "installing";
-- completes → "completed". We notify the order's customer (not the assignee).
create or replace function trg_task_status_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_num  text;
begin
  if new.status is distinct from old.status then
    select o.user_id, o.order_number into v_user, v_num
    from orders o where o.id = new.order_id;

    if v_user is null then
      return new;
    end if;

    if new.type = 'delivery' and new.status = 'en_route' then
      perform enqueue_notification(v_user, 'task_out_for_delivery',
        'طلبك في الطريق', 'Out for delivery',
        'طلبك ' || v_num || ' في الطريق إليك الآن.',
        'Your order ' || v_num || ' is on its way.',
        jsonb_build_object('order_id', new.order_id, 'task_id', new.id, 'type', new.type));

    elsif new.type = 'installation' and new.status = 'in_progress' then
      perform enqueue_notification(v_user, 'task_installing',
        'جاري التركيب', 'Installation in progress',
        'الفني يقوم بتركيب طلبك ' || v_num || ' الآن.',
        'Our technician is installing your order ' || v_num || '.',
        jsonb_build_object('order_id', new.order_id, 'task_id', new.id, 'type', new.type));

    elsif new.status = 'completed' then
      if new.type = 'delivery' then
        perform enqueue_notification(v_user, 'task_delivered',
          'تم التوصيل', 'Delivered',
          'تم توصيل طلبك ' || v_num || '.',
          'Your order ' || v_num || ' has been delivered.',
          jsonb_build_object('order_id', new.order_id, 'task_id', new.id, 'type', new.type));
      elsif new.type = 'installation' then
        perform enqueue_notification(v_user, 'task_install_completed',
          'اكتمل التركيب', 'Installation completed',
          'تم تركيب طلبك ' || v_num || ' بنجاح.',
          'Installation for your order ' || v_num || ' is complete.',
          jsonb_build_object('order_id', new.order_id, 'task_id', new.id, 'type', new.type));
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tasks_status_notify on fulfillment_tasks;
create trigger trg_tasks_status_notify
  after update of status on fulfillment_tasks
  for each row execute function trg_task_status_notify();

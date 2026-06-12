// Elite v1 — automation-runner (Blueprint Phase 2)
// Deno runtime. Executes active CRM workflows (migration 0026):
//   trigger 'order_status'      → scans order_events past the workflow cursor,
//                                  matches conditions {to_status}, acts per order.
//   trigger 'customer_at_risk'  → customers whose last order is >120d old.
// Actions: 'whatsapp_template' (via shared sender; sandbox = log) and
//          'create_task' (customer_notes). Runs are idempotent per
//          (workflow, subject). Ops-gated (admin/employee JWT) or service key.
import { serve } from "https://deno.land/std/http/server.ts";
import { handlePreflight, json, jsonError } from "../_shared/cors.ts";
import { getAdminClient, getUserFromRequest } from "../_shared/supabaseAdmin.ts";
import { sendTemplate } from "../_shared/whatsapp.ts";

interface Workflow {
  id: string;
  name: string;
  trigger_kind: string;
  conditions: Record<string, unknown>;
  action_kind: string;
  action_params: Record<string, unknown>;
  cursor_id: number;
}

interface Summary {
  workflows: number;
  fired: number;
  skipped: number;
  errors: number;
}

async function recordRun(
  db: ReturnType<typeof getAdminClient>,
  wf: Workflow,
  subjectKind: string,
  subjectId: string,
  status: string,
  detail: string | null,
): Promise<boolean> {
  // unique(workflow, subject) makes reruns idempotent.
  const { error } = await db.from("automation_runs").insert({
    workflow_id: wf.id,
    subject_kind: subjectKind,
    subject_id: subjectId,
    status,
    detail,
  });
  return !error; // duplicate → already handled
}

async function act(
  db: ReturnType<typeof getAdminClient>,
  wf: Workflow,
  customerId: string | null,
  phone: string | null,
): Promise<{ ok: boolean; detail: string }> {
  if (wf.action_kind === "create_task") {
    if (!customerId) return { ok: false, detail: "no customer" };
    const dueDays = Number(wf.action_params.due_days ?? 3);
    const due = new Date(Date.now() + dueDays * 86_400_000).toISOString().slice(0, 10);
    const { error } = await db.from("customer_notes").insert({
      customer_id: customerId,
      kind: "task",
      body: String(wf.action_params.body ?? wf.name),
      due_at: due,
    });
    return { ok: !error, detail: error?.message ?? `task due ${due}` };
  }
  if (wf.action_kind === "whatsapp_template") {
    if (!phone) return { ok: false, detail: "no phone" };
    try {
      const res = await sendTemplate({
        to: phone,
        template: String(wf.action_params.template ?? "order_update"),
        language: String(wf.action_params.lang ?? "ar"),
        bodyParams: [],
      });
      return { ok: true, detail: res.sent ? "sent" : `skipped:${res.skipped ?? ""}` };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : "wa failed" };
    }
  }
  return { ok: false, detail: `unknown action ${wf.action_kind}` };
}

async function run(): Promise<Summary> {
  const db = getAdminClient();
  const sum: Summary = { workflows: 0, fired: 0, skipped: 0, errors: 0 };

  const { data: wfs } = await db
    .from("automation_workflows")
    .select("id, name, trigger_kind, conditions, action_kind, action_params, cursor_id")
    .eq("is_active", true);

  for (const wf of (wfs ?? []) as Workflow[]) {
    sum.workflows += 1;

    if (wf.trigger_kind === "order_status") {
      const wanted = String(wf.conditions.to_status ?? "");
      const { data: events } = await db
        .from("order_events")
        .select("id, order_id, to_status")
        .gt("id", wf.cursor_id)
        .order("id", { ascending: true })
        .limit(200);
      let maxId = wf.cursor_id;
      for (const ev of (events ?? []) as { id: number; order_id: string; to_status: string | null }[]) {
        maxId = Math.max(maxId, ev.id);
        if (wanted && ev.to_status !== wanted) continue;
        const { data: ord } = await db
          .from("orders")
          .select("user_id, order_number, profiles:user_id(phone)")
          .eq("id", ev.order_id)
          .maybeSingle();
        const o = ord as unknown as { user_id: string | null; profiles: { phone: string | null } | null } | null;
        const inserted = await recordRun(db, wf, "order", ev.order_id, "ok", null);
        if (!inserted) { sum.skipped += 1; continue; }
        const res = await act(db, wf, o?.user_id ?? null, o?.profiles?.phone ?? null);
        await db.from("automation_runs")
          .update({ status: res.ok ? "ok" : "error", detail: res.detail })
          .eq("workflow_id", wf.id).eq("subject_kind", "order").eq("subject_id", ev.order_id);
        res.ok ? (sum.fired += 1) : (sum.errors += 1);
      }
      if (maxId > wf.cursor_id) {
        await db.from("automation_workflows").update({ cursor_id: maxId }).eq("id", wf.id);
      }
    }

    if (wf.trigger_kind === "customer_at_risk") {
      // Customers whose LAST order is older than 120 days.
      const cutoff = new Date(Date.now() - 120 * 86_400_000).toISOString();
      const { data: rows } = await db
        .from("orders")
        .select("user_id, created_at")
        .not("user_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1000);
      const last = new Map<string, string>();
      for (const r of (rows ?? []) as { user_id: string; created_at: string }[]) {
        if (!last.has(r.user_id)) last.set(r.user_id, r.created_at);
      }
      for (const [cust, lastAt] of last) {
        if (lastAt >= cutoff) continue;
        const inserted = await recordRun(db, wf, "customer", cust, "ok", null);
        if (!inserted) { sum.skipped += 1; continue; }
        const { data: prof } = await db.from("profiles").select("phone").eq("id", cust).maybeSingle();
        const res = await act(db, wf, cust, (prof as { phone: string | null } | null)?.phone ?? null);
        await db.from("automation_runs")
          .update({ status: res.ok ? "ok" : "error", detail: res.detail })
          .eq("workflow_id", wf.id).eq("subject_kind", "customer").eq("subject_id", cust);
        res.ok ? (sum.fired += 1) : (sum.errors += 1);
      }
    }
  }
  return sum;
}

serve(async (req: Request): Promise<Response> => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return jsonError("Method not allowed", 405);
  try {
    const user = await getUserFromRequest(req);
    if (user.role !== "admin" && user.role !== "employee") {
      return jsonError("Forbidden — ops only", 403);
    }
  } catch {
    return jsonError("Unauthorized", 401);
  }
  try {
    const summary = await run();
    return json({ ok: true, ...summary });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "runner failed", 500);
  }
});

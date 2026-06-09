// Elite v1 — dispatch Edge Function.
// Deno + TypeScript (Supabase Edge Functions).
//
// Input: { order_id }
//
// Flow (see ARCHITECTURE.md 3.4 Fulfillment):
//   load order + address (area) + items
//   → always create one 'delivery' fulfillment_task
//   → if any order_item.with_installation, create one 'installation' task
//   → auto-assign each task to the least-loaded available staff member whose
//     staff_zones.area matches the order's area AND whose role matches the task
//     (driver → delivery, technician → installation); else leave 'unassigned'.
//   → return the created tasks.
//
// This function is privileged (service role): assignment is service-role-only
// per the security model. It is invoked by the payment-webhook after an order
// is paid, or directly by admin tooling. Callers must be trusted (service role
// JWT) — there is no end-user identity binding here.

import { serve } from "https://deno.land/std/http/server.ts";
import { handlePreflight, json, jsonError } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabaseAdmin.ts";

interface DispatchRequest {
  order_id: string;
  // Optional pre-scheduled slots (otherwise null → admin/staff schedule later).
  delivery_date?: string; // YYYY-MM-DD
  installation_date?: string; // YYYY-MM-DD
}

type Role = "driver" | "technician";

serve(async (req: Request): Promise<Response> => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405);
  }

  let body: DispatchRequest;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }
  if (!body?.order_id) {
    return jsonError("order_id is required", 400);
  }

  const admin = getAdminClient();

  try {
    // ── Load the order + its delivery address area ───────────────────────
    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select("id, status, address_id, addresses:address_id ( area )")
      .eq("id", body.order_id)
      .maybeSingle();
    if (orderErr) throw orderErr;
    if (!order) return jsonError("Order not found", 404);

    const area: string | null = (order as any).addresses?.area ?? null;

    // ── Idempotency: if tasks already exist for this order, return them ───
    const { data: existing, error: existErr } = await admin
      .from("fulfillment_tasks")
      .select("id, type, status, assignee_id, area")
      .eq("order_id", order.id);
    if (existErr) throw existErr;
    if (existing && existing.length > 0) {
      return json({ ok: true, idempotent: true, order_id: order.id, tasks: existing });
    }

    // ── Determine which tasks are needed ─────────────────────────────────
    const { data: items, error: itemsErr } = await admin
      .from("order_items")
      .select("with_installation")
      .eq("order_id", order.id);
    if (itemsErr) throw itemsErr;

    const needsInstallation = (items ?? []).some((i) => i.with_installation === true);

    // tasks to create: always delivery; installation if any line wants it.
    const plan: { type: "delivery" | "installation"; role: Role; date?: string }[] = [
      { type: "delivery", role: "driver", date: body.delivery_date },
    ];
    if (needsInstallation) {
      plan.push({ type: "installation", role: "technician", date: body.installation_date });
    }

    // ── Auto-assign and insert each task ─────────────────────────────────
    const created: any[] = [];
    for (const t of plan) {
      const assigneeId = area ? await pickLeastLoadedStaff(admin, area, t.role) : null;

      const { data: task, error: taskErr } = await admin
        .from("fulfillment_tasks")
        .insert({
          order_id: order.id,
          type: t.type,
          status: assigneeId ? "assigned" : "unassigned",
          assignee_id: assigneeId,
          area,
          scheduled_for: t.date ?? null,
        })
        .select("id, type, status, assignee_id, area, scheduled_for")
        .single();
      if (taskErr) throw taskErr;
      created.push(task);

      // For installation tasks, spawn the installation_jobs shell so the
      // technician app has a row to fill in (checklist/photos/sign-off).
      if (t.type === "installation") {
        await admin
          .from("installation_jobs")
          .insert({ task_id: task.id, order_id: order.id })
          .then(({ error }) => {
            if (error) console.error("[dispatch] installation_jobs insert failed", error);
          });
      }

      // Notify the assignee (best-effort) that they have a new task.
      if (assigneeId) {
        await invokeNotify({
          user_id: assigneeId,
          kind: t.type === "delivery" ? "task_delivery_assigned" : "task_installation_assigned",
          title_ar: t.type === "delivery" ? "مهمة توصيل جديدة" : "مهمة تركيب جديدة",
          title_en: t.type === "delivery" ? "New delivery task" : "New installation task",
          body_ar: `تم إسناد مهمة ${t.type === "delivery" ? "توصيل" : "تركيب"} إليك في منطقة ${area}.`,
          body_en: `A ${t.type} task in ${area} has been assigned to you.`,
          data: { task_id: task.id, order_id: order.id, type: t.type },
        }).catch((e) => console.error("[dispatch] notify failed", e));
      }
    }

    return json({ ok: true, order_id: order.id, area, tasks: created }, 201);
  } catch (err) {
    console.error("[dispatch] error", err);
    return jsonError("Dispatch failed", 500, {
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

/**
 * Pick the least-loaded active staff member of `role` who serves `area`.
 * Load = count of open (non-terminal) fulfillment_tasks currently assigned.
 * Returns null if no eligible staff (→ task stays 'unassigned' for manual
 * dispatch in admin).
 */
async function pickLeastLoadedStaff(
  admin: ReturnType<typeof getAdminClient>,
  area: string,
  role: Role,
): Promise<string | null> {
  // Staff serving this area.
  const { data: zoneRows, error: zoneErr } = await admin
    .from("staff_zones")
    .select("staff_id")
    .eq("area", area);
  if (zoneErr) throw zoneErr;

  const candidateIds = [...new Set((zoneRows ?? []).map((z) => z.staff_id))];
  if (candidateIds.length === 0) return null;

  // Filter to active staff with the matching role.
  const { data: profiles, error: profErr } = await admin
    .from("profiles")
    .select("id")
    .in("id", candidateIds)
    .eq("role", role)
    .eq("is_active", true);
  if (profErr) throw profErr;

  const eligible = (profiles ?? []).map((p) => p.id);
  if (eligible.length === 0) return null;

  // Current open-task load per candidate. Terminal statuses don't count.
  const terminal = ["completed", "failed", "cancelled"];
  const { data: openTasks, error: loadErr } = await admin
    .from("fulfillment_tasks")
    .select("assignee_id")
    .in("assignee_id", eligible)
    .not("status", "in", `(${terminal.join(",")})`);
  if (loadErr) throw loadErr;

  const load = new Map<string, number>();
  for (const id of eligible) load.set(id, 0);
  for (const row of openTasks ?? []) {
    if (row.assignee_id) load.set(row.assignee_id, (load.get(row.assignee_id) ?? 0) + 1);
  }

  // Least-loaded wins (ties broken by candidate order — deterministic enough).
  let best: string | null = null;
  let bestLoad = Number.POSITIVE_INFINITY;
  for (const id of eligible) {
    const l = load.get(id) ?? 0;
    if (l < bestLoad) {
      bestLoad = l;
      best = id;
    }
  }
  return best;
}

const FUNCTIONS_BASE_URL =
  Deno.env.get("SUPABASE_FUNCTIONS_URL") ??
  (Deno.env.get("SUPABASE_URL") ? `${Deno.env.get("SUPABASE_URL")}/functions/v1` : "");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

/** Invoke the notify Edge Function (best-effort). */
async function invokeNotify(body: unknown): Promise<void> {
  if (!FUNCTIONS_BASE_URL) {
    console.warn("[dispatch] FUNCTIONS base URL unset — cannot invoke notify");
    return;
  }
  const res = await fetch(`${FUNCTIONS_BASE_URL}/notify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`notify returned ${res.status}: ${text}`);
  }
}

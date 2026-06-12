// Elite v1 — accounting-poster Edge Function
// Cron (5 min): scans recent payments/expenses/stock_moves and idempotently posts
// any missed journal entries. Safe to run repeatedly (post_journal is idempotent).

import { serve } from "https://deno.land/std/http/server.ts";
import { handlePreflight, json, jsonError } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabaseAdmin.ts";

serve(async (req: Request): Promise<Response> => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  // Allow GET (cron) and POST (manual trigger)
  const admin = getAdminClient();
  const results: Record<string, number> = {};

  // Re-post payments not yet in journal_entries
  const { data: unmatchedPayments } = await admin
    .from("payments")
    .select("id, amount, method, status")
    .in("status", ["paid", "refunded"])
    .limit(500);

  let paymentPosted = 0;
  for (const p of unmatchedPayments ?? []) {
    const { data: exists } = await admin
      .from("journal_entries")
      .select("id")
      .eq("source_kind", p.status === "refunded" ? "refund" : "payment")
      .eq("source_id", p.id)
      .single();
    if (exists) continue;

    const cashAccount = p.method === "knet" ? "1010"
      : p.method === "cod" ? "1020" : "1000";
    const amt = Math.abs(p.amount);
    const lines = p.status === "paid"
      ? [{ account: cashAccount, debit: amt, credit: 0 }, { account: "4000", debit: 0, credit: amt }]
      : [{ account: "4000", debit: amt, credit: 0 }, { account: cashAccount, debit: 0, credit: amt }];

    await admin.rpc("post_journal", {
      p_source_kind: p.status === "refunded" ? "refund" : "payment",
      p_source_id: p.id,
      p_memo: p.status === "paid" ? "تحصيل دفعة" : "استرداد",
      p_lines: lines,
    });
    paymentPosted++;
  }
  results.payments_posted = paymentPosted;

  return json({ ok: true, ...results, timestamp: new Date().toISOString() });
});

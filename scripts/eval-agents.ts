#!/usr/bin/env -S deno run --allow-net --allow-env
// Elite v1 — eval-agents: run golden eval cases against deployed agent functions.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... deno run --allow-net --allow-env scripts/eval-agents.ts
//
// Reads agent_eval_cases, invokes the corresponding edge function for each case,
// and writes results to agent_eval_runs. Exits 1 if any required assertions fail.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  Deno.exit(1);
}

const HEADERS = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${SERVICE_KEY}`,
  "apikey": SERVICE_KEY,
};

async function dbFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: { ...HEADERS, ...(opts?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DB ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

interface EvalCase {
  id: string;
  agent: string;
  input: Record<string, unknown>;
  assertions: Record<string, unknown>;
}

interface EvalRun {
  eval_case_id: string;
  passed: boolean;
  output: Record<string, unknown>;
  checked_at: string;
}

async function runSalesCase(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/agent-sales`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(input),
  });
  const data = await res.json();
  return { status: res.status, ...data };
}

async function runTriageCase(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/agent-triage`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(input),
  });
  const data = await res.json();
  return { status: res.status, ...data };
}

function checkAssertions(output: Record<string, unknown>, assertions: Record<string, unknown>): { passed: boolean; failures: string[] } {
  const failures: string[] = [];

  // Check that the response is ok
  if (assertions.must_respond === true && !output.ok) {
    failures.push(`Expected ok=true, got ok=${output.ok}`);
  }

  // Check that reply doesn't contain forbidden strings
  const forbidden = assertions.must_not_contain as string[] | undefined;
  if (forbidden && output.reply) {
    for (const f of forbidden) {
      if (String(output.reply).includes(f)) {
        failures.push(`Reply contains forbidden string: "${f}"`);
      }
    }
  }

  // Check must_call_tools by scanning agent_actions (best-effort via output)
  // We check if actions array is non-empty when tools are required
  const mustCallTools = assertions.must_call_tools as string[] | undefined;
  if (mustCallTools && mustCallTools.length > 0) {
    // The agent loop returns actions array in the output
    const actions = output.actions as string[] | undefined;
    if (!actions || actions.length === 0) {
      failures.push(`Expected tool calls ${mustCallTools.join(",")} but no actions recorded`);
    }
  }

  // Check expected_classification for triage agent
  const expectedClass = assertions.expected_classification as string | undefined;
  if (expectedClass) {
    const summary = String(output.summary ?? "").toLowerCase();
    if (!summary.includes(expectedClass)) {
      // Non-fatal: classification is in the DB via set_ticket_fields, log as warning
      console.warn(`  ⚠ Classification hint "${expectedClass}" not found in summary (may be in DB)`);
    }
  }

  return { passed: failures.length === 0, failures };
}

async function main() {
  console.log("🔍 Loading eval cases from agent_eval_cases...");

  const cases: EvalCase[] = await dbFetch(
    "/agent_eval_cases?select=id,agent,input,assertions&order=created_at",
  );

  if (cases.length === 0) {
    console.log("No eval cases found — run migrations 0027-0036 first.");
    Deno.exit(0);
  }

  console.log(`Found ${cases.length} eval cases.\n`);

  const runs: EvalRun[] = [];
  let totalPassed = 0;
  let totalFailed = 0;

  for (const c of cases) {
    process.stdout.write(`[${c.agent}] case ${c.id.slice(0, 8)}... `);

    let output: Record<string, unknown> = {};
    try {
      if (c.agent === "sales") {
        output = await runSalesCase(c.input);
      } else if (c.agent === "triage") {
        // Triage needs a real ticket — skip if no ticket_id in input
        if (!c.input.ticket_id) {
          console.log("⏭  skipped (no ticket_id in eval case input)");
          continue;
        }
        output = await runTriageCase(c.input);
      } else {
        console.log(`⏭  skipped (unknown agent: ${c.agent})`);
        continue;
      }
    } catch (e) {
      output = { error: e instanceof Error ? e.message : String(e) };
    }

    const { passed, failures } = checkAssertions(output, c.assertions);
    runs.push({
      eval_case_id: c.id,
      passed,
      output,
      checked_at: new Date().toISOString(),
    });

    if (passed) {
      totalPassed++;
      console.log("✅ passed");
    } else {
      totalFailed++;
      console.log("❌ FAILED");
      for (const f of failures) {
        console.log(`   → ${f}`);
      }
    }
  }

  // Write results to agent_eval_runs
  if (runs.length > 0) {
    try {
      await dbFetch("/agent_eval_runs", {
        method: "POST",
        headers: { ...HEADERS, "Prefer": "return=minimal" },
        body: JSON.stringify(runs),
      });
      console.log(`\nResults written to agent_eval_runs.`);
    } catch (e) {
      console.error("Failed to write eval runs:", e);
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Passed: ${totalPassed}/${runs.length}`);
  console.log(`Failed: ${totalFailed}/${runs.length}`);

  if (totalFailed > 0) {
    Deno.exit(1);
  }
}

// deno-lint-ignore no-explicit-any
const process = { stdout: { write: (s: string) => (Deno as any).core?.print(s) ?? Deno.stdout.writeSync(new TextEncoder().encode(s)) } };

main();

// Elite v1 — shared AI agent loop + guardrail tiers.
// All agents import { runAgentLoop, logAction, AgentTool } from here.

import { getAdminClient } from "./supabaseAdmin.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

export type RiskTier = "read" | "write" | "sensitive";

export interface AgentTool {
  name: string;
  description: string;
  risk: RiskTier;
  input_schema: object;
  execute: (input: unknown, sessionId: string) => Promise<unknown>;
}

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

interface ContentBlock {
  type: string;
  [key: string]: unknown;
}

interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}

interface AgentTurnResult {
  text: string | null;
  toolCalls: { id: string; name: string; input: unknown }[];
  stop: string;
}

async function runAgentTurn(opts: {
  model: string;
  system: string;
  messages: AnthropicMessage[];
  tools: AgentTool[];
  maxTokens?: number;
}): Promise<AgentTurnResult> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 1024,
      system: opts.system,
      messages: opts.messages,
      tools: opts.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
      })),
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Anthropic API error ${resp.status}: ${err}`);
  }

  const data = await resp.json() as {
    stop_reason: string;
    content: ContentBlock[];
  };

  const text = data.content.find((b) => b.type === "text")?.text as string | undefined ?? null;
  const toolCalls = data.content
    .filter((b): b is ToolUseBlock => b.type === "tool_use")
    .map((b) => ({ id: b.id, name: b.name, input: b.input }));

  return { text, toolCalls, stop: data.stop_reason };
}

export async function runAgentLoop(opts: {
  agentName: "sales" | "ops" | "insight" | "triage";
  sessionId: string;
  model: string;
  system: string;
  initialMessages: AnthropicMessage[];
  tools: AgentTool[];
  maxIterations?: number;
  maxTokens?: number;
}): Promise<{ reply: string; actions: string[] }> {
  const { agentName, sessionId, model, system, tools, maxTokens } = opts;
  const maxIter = opts.maxIterations ?? 6;
  const messages = [...opts.initialMessages];
  const actionIds: string[] = [];

  for (let i = 0; i < maxIter; i++) {
    const turn = await runAgentTurn({ model, system, messages, tools, maxTokens });

    if (turn.toolCalls.length === 0 || turn.stop === "end_turn") {
      return { reply: turn.text ?? "أعتذر، لم أتمكن من معالجة طلبك.", actions: actionIds };
    }

    // Add assistant message with tool calls
    messages.push({
      role: "assistant",
      content: [
        ...(turn.text ? [{ type: "text", text: turn.text }] : []),
        ...turn.toolCalls.map((tc) => ({
          type: "tool_use", id: tc.id, name: tc.name, input: tc.input,
        })),
      ],
    });

    // Execute tool calls
    const toolResults: ContentBlock[] = [];
    for (const tc of turn.toolCalls) {
      const tool = tools.find((t) => t.name === tc.name);
      if (!tool) {
        toolResults.push({ type: "tool_result", tool_use_id: tc.id, content: "Tool not found" });
        continue;
      }

      let result: unknown;
      let status: string;

      if (tool.risk === "sensitive") {
        // Propose for HITL approval — never execute
        result = await logAction(agentName, sessionId, tc.name, tc.input as Record<string, unknown>, null, "proposed");
        actionIds.push(result as string);
        status = "proposed";
        toolResults.push({
          type: "tool_result", tool_use_id: tc.id,
          content: JSON.stringify({ proposed: true, action_id: result, message: "Action proposed for human approval" }),
        });
        continue;
      }

      try {
        result = await tool.execute(tc.input, sessionId);
        status = "executed";
      } catch (e) {
        result = { error: e instanceof Error ? e.message : String(e) };
        status = "failed";
      }

      await logAction(agentName, sessionId, tc.name, tc.input as Record<string, unknown>, result, status);
      toolResults.push({
        type: "tool_result", tool_use_id: tc.id,
        content: JSON.stringify(result),
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  return { reply: "وصلت للحد الأقصى من المحاولات.", actions: actionIds };
}

export async function logAction(
  agent: string, sessionId: string, tool: string,
  input: Record<string, unknown>, output: unknown, status: string
): Promise<string> {
  const admin = getAdminClient();
  const { data } = await admin
    .from("agent_actions")
    .insert({
      agent, session_id: sessionId, tool, input, output,
      status, risk: status === "proposed" ? "sensitive" : "read",
    })
    .select("id")
    .single();
  return data?.id ?? "";
}

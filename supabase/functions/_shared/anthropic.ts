// NewTech OS — minimal Anthropic (Claude) Messages API client (Deno).
//
// Optional layer: every AI Edge Function MUST work without ANTHROPIC_API_KEY.
// When the key is present, `askClaude` enhances output via Claude; otherwise
// callers fall back to deterministic templates.
//
// Model: claude-sonnet-4-6 (override via ANTHROPIC_MODEL). Uses the Messages
// API directly over fetch (no SDK needed in Deno).

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-6";
const ANTHROPIC_VERSION = "2023-06-01";

export function hasClaude(): boolean {
  return ANTHROPIC_API_KEY.length > 0;
}

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Call the Claude Messages API. Returns the assistant's text, or null on any
 * error / when no key is configured (callers degrade gracefully).
 */
export async function askClaude(opts: {
  system: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
}): Promise<string | null> {
  if (!ANTHROPIC_API_KEY) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: opts.maxTokens ?? 800,
        system: opts.system,
        messages: opts.messages,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[anthropic] ${res.status}: ${text}`);
      return null;
    }
    const data = await res.json();
    const block = Array.isArray(data?.content)
      ? data.content.find((b: { type: string }) => b.type === "text")
      : null;
    return (block?.text as string) ?? null;
  } catch (err) {
    console.error("[anthropic] request failed", err);
    return null;
  }
}

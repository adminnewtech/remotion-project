# Newtech OS — AI session grounding

**Start here, always:**
1. Invoke the project skill **`newtech-os`** (`.claude/skills/newtech-os/SKILL.md`) — module codegraph, hard rules, build workflow, gotchas.
2. Forward plan: **`docs/INTEGRATED_OS_BLUEPRINT.md`** (CRM/ERP/commerce/accounting/AI-agents, phases → migrations 0025–0036; 0025 accounting + 0026 automation already live).
3. Live state: `docs/STATUS.md` · setup: `docs/DEVELOPMENT.md`.

Non-negotiables (full list in the skill): stock only via `apply_stock_move`/`transfer_stock`; KWD = numeric(10,3); every new table gets RLS; migrations sequential + applied live via Supabase MCP; gates before every push: `pnpm typecheck && pnpm lint && pnpm test && pnpm --filter @elite/web build`.

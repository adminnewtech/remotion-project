# NewTech OS — Architecture Decision (FINAL)

**Decision (approved by owner):** Elite v1 is the CORE of NewTech OS. We do NOT
migrate to Frappe/ERPNext+Medusa; we layer the missing capabilities on top of
the live, working system.

## Why (vs. rebuilding on Frappe/Medusa)
Elite v1 already covers — live in production — exactly what an off-the-shelf
stack can't: the unified commerce → delivery → installation → warranty →
support flow with RLS security, realtime tracking, KNET payment wiring, a
world-class storefront, and field apps. A Frappe/Medusa rebuild would spend
months re-implementing what already works, across two new runtimes.

## The stack (NewTech OS)
| Layer | Tool | Status |
|---|---|---|
| Core (commerce, field service, delivery, admin, mobile) | **Elite v1** (Next.js + Expo + Supabase) | ✅ live — keep developing |
| CEO dashboard + AI agents (support copilot, inventory sentinel, daily report) | Elite layer on Supabase (+ Claude API when key provided) | 🔨 building |
| Omnichannel support (WhatsApp/IG/email inbox) | **Chatwoot** (self-host later) + WhatsApp Cloud webhook into Elite | 🔨 integration layer building |
| Deep back-office (accounting, HR/payroll, procurement) | **Zoho** (already connected) now → **ERPNext** later if/when self-hosting | 🟡 |
| Automation | **n8n** (internal-only, locked down) | 🔴 later |
| Analytics/product | PostHog · Marketing: Mautic/Meta feeds | 🔴 later |

## Rules
1. Never break the live core; every layer integrates via Supabase/Edge Functions + adapters in `@elite/core/integrations`.
2. Secrets via env/Supabase secrets only.
3. Each layer ships with migrations + RLS review + docs.

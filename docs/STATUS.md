# Elite v1 — Live Status

_Last updated: 2026-06-12 (phases 0027–0037 fully live — all migrations applied to production DB)_

This page tracks what is **actually live** right now (versus the plan in
`ROADMAP.md`). It is the quick "is it up, and where" reference.

## TL;DR

| Area | Status |
|---|---|
| Web storefront + admin | 🟢 Live on Vercel |
| Admin dashboard (OSALPHA Gold) | 🟢 Every nav item live: overview, orders (+status→notify), catalog (+Shopify sync), **cashier/POS**, **workshop**, dispatch (+**live driver map**), **customers**, support, marketing, finance, staff, analytics, CEO — no "coming soon" left |
| Native-first (drop Zoho/Shopify) | 🟢 Finance + Marketing run on our own tables (no Zoho Books / Meta-only / Shopify reads); dispatch + staff fully native |
| Quality gates (typecheck+lint+**test 55**+build) | 🟢 CI-enforced · +16 admin e2e |
| **Accounting (double-entry, auto-posting)** | 🟢 Live — migration 0025, P&L on /admin/finance |
| **CRM automation engine + runner** | 🟢 Live — migration 0026, /admin/automation |
| **ERP: cycle counts + reorder + van stock** | 🟢 Live — migration 0027 applied |
| **ERP: landed costs + warranties** | 🟢 Live — migration 0028 applied |
| **Commerce: bundles + gift cards** | 🟢 Live — migration 0029 applied |
| **Commerce: pickup + wishlists + reviews** | 🟢 Live — migration 0030 applied |
| **CRM: pipeline kanban (crm_deals)** | 🟢 Live — migration 0031 applied |
| **WhatsApp inbox + templates** | 🟢 Live — migration 0032 applied (7 templates seeded) |
| **Accounting: COGS + supplier payments + posting rules** | 🟢 Live — migration 0033 applied |
| **Finance: KNET reconciliation + COD remittances** | 🟢 Live — migration 0034 applied |
| **AI agents: sales + triage + HITL approvals + kill switches** | 🟢 Live — migrations 0035+0036+0037 applied; 7 edge functions ACTIVE |
| Supabase project | 🟢 Provisioned (schema + RLS + seed) |
| Catalog | 🟢 Seeded from `newtechq8.com` (24 products) |
| Auth (phone OTP + email/password) | 🟢 Live |
| Checkout (KNET sandbox) | 🟡 Working in sandbox; production keys pending |
| Mobile (Expo) | 🟡 Builds locally; EAS preview builds pending |
| Custom domain | 🔴 Not yet (using the Vercel URL) |
| Cloudflare (DNS/CDN/WAF) | 🔴 Not yet |

## Deployed URL

- Production (Vercel): **https://remotion-project-6dvr.vercel.app**
- Every push to `master` produces a Vercel preview URL automatically.

## Supabase (live project)

| | |
|---|---|
| Project name | `elite-v1` |
| Project ref | `wslvotaodwdftmexkfpd` |
| Region | `eu-central-1` (Frankfurt) |
| API URL | `https://wslvotaodwdftmexkfpd.supabase.co` |
| Publishable (anon) key | public-safe, RLS-protected (see `DEPLOYMENT.md`) |
| Service role key | secret — Vercel/edge env only |

**Applied:** migrations `0001`–`0037` — all phases live (commerce, logistics, omnichannel, AI layer, finance/marketing, settings/zones, order audit trail, inventory ledger+purchasing+serials, security hardenings, returns/RMA, channels+loyalty, CRM notes, appointments, double-entry accounting, automation engine, ERP cycle counts+warranties+landed costs, bundles+gift cards, pickup+wishlists+reviews, CRM pipeline kanban, WhatsApp inbox, accounting completion, KNET reconciliation, AI agent actions+evals+kill switches).

## Catalog (seeded)

Imported from the live Shopify store `newtechq8.com`:

- 4 categories
- 24 products / 30 variants
- inventory levels + product media
- one discount code: `NEWTECH10`

> This is a **seed slice**, not the full catalog. Full catalog sync is tracked
> in `ROADMAP.md` (Phase 1 → "full catalog sync").

## Vercel environment

- `NEXT_PUBLIC_SUPABASE_URL` — set
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — set
- Root directory: `apps/web` (Next.js, monorepo auto-detected)

## Shared packages powering the live app

- `@elite/ui` — design tokens (deep-indigo primary + electric-cyan accent,
  semantic shadows, z-index scale) + `@elite/ui/web` React components.
- `@elite/i18n` — Arabic-first (RTL) + English dictionaries with full key parity.
- `@elite/types`, `@elite/core`, `@elite/config` — contracts, logic, Tailwind preset.

## CI / quality gates

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and PR:

- **`checks`** — `pnpm typecheck` + `pnpm lint` across all 8 packages.
- **`build`** — production `next build` of `@elite/web`.

All green as of 2026-06-12. Web app uses real ESLint (`eslint-config-next`);
mobile/packages keep lightweight lint stubs. `turbo.json` passes through the
proxy/CA env vars so `next/font` (Google Fonts) resolves behind the sandbox's
TLS-intercepting proxy.

## Vercel projects

Two Vercel projects are connected to this repo:

| Project | Root dir | Status | Notes |
|---|---|---|---|
| `remotion-project-6dvr` | `apps/web` | 🟢 The real deploy | This is the live app. |
| `remotion-project` | _(repo root)_ | 🔴 Errors until reconfigured | Legacy/duplicate. Its Root Directory must be set to `apps/web` — a per-project setting, not a repo file. Run the **Configure Vercel projects** workflow (`.github/workflows/configure-vercel.yml`, manual / `workflow_dispatch`, needs the `VERCEL_TOKEN` secret), or delete this project in the Vercel dashboard. A repo-root `vercel.json` does **not** work here: Vercel applies it to every connected project and breaks the apps/web-rooted one. |

## Native-first strategy (replacing Zoho One + Shopify)

The goal is to run the business entirely on this platform and retire external
SaaS. Progress:

- **Finance** (`/admin/finance`) — computed from our own `orders` + `payments`
  and a native `expenses` table (migration 0016). No Zoho Books dependency.
- **Marketing** (`/admin/marketing`) — campaigns stored first-party in
  `marketing_campaigns`; the catalog feed (`/feeds/*`) is exported from our own
  `products`, not Shopify.
- **Catalog sync** (`supabase/functions/sync-catalog` + the "مزامنة من Shopify"
  button on `/admin/catalog`) — idempotent Shopify→our-DB import that adds new
  products and refreshes price/sale/stock/images while **preserving our curated
  categories**. Lets us keep pulling the live catalog into our own data while we
  build toward independence. Needs `SHOPIFY_STORE` + `SHOPIFY_ADMIN_TOKEN`
  function secrets.
- **Dispatch** (`/admin/dispatch`) — live `fulfillment_tasks` with native
  auto-assign (least-loaded driver/technician), no third-party logistics.
- **Staff** (`/admin/staff`) — native role management over `profiles`; no
  external HR. Utilization is a real metric from active tasks.
- **Cashier / POS** (`/admin/cashier`) — native in-store sales: ticket → cash/
  KNET → creates a completed order + items + captured payment and decrements
  inventory. Replaces any external POS.
- **Customers** (`/admin/customers`) — CRM-lite from our own profiles + orders
  (order count, lifetime spend, last order). No external CRM.
- **Workshop** (`/admin/workshop`) — installation-job execution over
  fulfillment_tasks + installation_jobs (checklist, photos, completion).
- **Live ops map** (on `/admin/dispatch`) — Leaflet/OSM web map streaming
  driver GPS from `driver_locations` over Supabase Realtime; the web
  counterpart of the mobile MapTracker. No Google Maps key needed.
- **Order status → customer notify** — admin status changes fire the `notify`
  Edge Function (in-app, push, WhatsApp, email) automatically.

Still external by necessity (no replacement intended yet): the **ad platforms
themselves** (Meta/Google) consume our exported feeds; **payment gateway**
(KNET/MyFatoorah). The legacy Zoho Books/Desk/Gmail/Meta adapter stubs in
`packages/core/src/integrations` are now optional, not on the critical path.

## Known limitations / sandbox notes

- The Claude execution sandbox blocks outbound `*.supabase.co`, so a **local**
  run shows sample-data fallbacks; on Vercel (open network) the same build reads
  the live catalog.
- Payments run against the **KNET sandbox**; production gateway keys + webhooks
  are not yet configured.

See `DEPLOYMENT.md` for how to deploy/redeploy and `ROADMAP.md` for what's next.

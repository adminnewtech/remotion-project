# Elite v1 — Live Status

_Last updated: 2026-06-12_

This page tracks what is **actually live** right now (versus the plan in
`ROADMAP.md`). It is the quick "is it up, and where" reference.

## TL;DR

| Area | Status |
|---|---|
| Web storefront + admin | 🟢 Live on Vercel |
| Admin dashboard (OSALPHA Gold) | 🟢 Overview, catalog, orders, analytics, dispatch, support, CEO, staff |
| Quality gates (typecheck + lint + build) | 🟢 Green across all 8 packages in CI |
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

**Applied:** migrations `0001`–`0008` (schema, RLS, atomic stock RPCs, security
hardening).

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

## Known limitations / sandbox notes

- The Claude execution sandbox blocks outbound `*.supabase.co`, so a **local**
  run shows sample-data fallbacks; on Vercel (open network) the same build reads
  the live catalog.
- Payments run against the **KNET sandbox**; production gateway keys + webhooks
  are not yet configured.

See `DEPLOYMENT.md` for how to deploy/redeploy and `ROADMAP.md` for what's next.

# Elite v1 — Roadmap

## Phase 0 — Foundation (this session) ✅ in progress
- Monorepo (pnpm + Turborepo), shared `types`, `core`, `ui`, `i18n`, `config` packages.
- Full Supabase schema + RLS as migrations (the contract).
- App scaffolds: Next.js web (storefront + admin), Expo mobile (customer/driver/technician).
- Integration adapter stubs (Zoho Books, Zoho Desk, Gmail, Meta Ads, Cloudflare).
- Docs: architecture, data model, features, roadmap. `.env.example`.

## Phase 1 — Vertical slice (provision + first real flow)
- Provision Supabase project + Vercel; load migrations; seed catalog from current newtechq8.com products.
- Auth (phone OTP) live across web + mobile.
- Customer: browse → product detail → cart → checkout (KNET sandbox) → order created.
- Admin: see orders live, manage catalog/inventory.
- Notifications: order confirmation (push + email).

## Phase 2 — Logistics & field service
- Dispatch Edge Function (auto-assign by zone + manual override).
- Driver app: task queue, live GPS, proof of delivery → customer live map.
- Technician app: installation job flow, checklist, before/after photos, sign-off.
- Real-time order/delivery/installation tracking for customers.

## Phase 3 — Support, warranty & finance
- In-app support chat + warranty claims, synced to Zoho Desk.
- Digital warranty cards; warranty → repair/installation job.
- Zoho Books sync: invoices, payments, expenses.

## Phase 4 — Growth & intelligence
- Meta Ads: catalog feed + campaign/audience automation from admin.
- Loyalty, referrals, wishlist, reviews surfacing.
- AI layer: recommendations, support copilot, demand forecasting, smart dispatch.
- Production hardening: load testing, observability, EAS production builds, store submission.

## Cross-cutting (every phase)
- RLS coverage + security review before each provisioning step.
- Arabic/English parity and RTL QA.
- Analytics dashboards kept in sync with new modules.

## Provisioning checklist (when ready to go live)
1. Create Supabase project → set keys in `.env.local` / Vercel / EAS.
2. `pnpm db:push` migrations; run `db:seed`.
3. Configure payment gateway (MyFatoorah/Tap) keys + webhooks.
4. Connect Zoho Books, Zoho Desk, Gmail, Meta Ads, Cloudflare credentials.
5. Deploy web to Vercel; build mobile with EAS; smoke-test the vertical slice.
